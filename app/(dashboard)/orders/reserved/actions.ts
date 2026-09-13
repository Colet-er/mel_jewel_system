"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ReservationType } from "@/types";
import { validateReservationInput, round2, mapRpcError } from "@/lib/utils/reservation-validation";
import {
  PAYMENT_EVIDENCE_BUCKET,
  calculatePaymentBalance,
  roundPaymentAmount,
  validatePaymentInput,
} from "@/lib/utils/payment-validation";

export interface BulkActionResult {
  succeeded: string[];
  failed: { id: string; message: string }[];
}

export type ReservationFormResult =
  | { ok: true; orderId?: string; orderNumber?: string }
  | { ok: false; message: string };

export type PaymentFormResult =
  | {
      ok: true;
      totalPaid: number;
      remainingBalance: number;
      fullyPaid: boolean;
      evidenceCount: number;
    }
  | { ok: false; message: string; paymentRecorded?: boolean };

export type RtoActionResult =
  | { ok: true }
  | { ok: false; message: string };

export interface ReservationInput {
  /** Blank on create — the database assigns the next daily number. */
  invoiceNumber?: string;
  fbName?: string;
  customerName: string;
  customerAddress: string;
  phone: string;
  itemName: string;
  itemCode: string;
  category: string;
  quantity: number;
  amount: number;
  discount: number;
  shippingFee: number;
  downpayment: number;
  downpaymentMethod: string;
  type: ReservationType;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter((id) => UUID_PATTERN.test(id))));
}

function paymentErrorMessage(error: { code?: string; message?: string } | null): string {
  const message = error?.message ?? "";
  if (error?.code === "42501" || /row-level security|not authorized/i.test(message)) {
    return "You are not authorized to record payments.";
  }
  if (/payment_method/i.test(message)) {
    return "Select a valid payment method.";
  }
  if (/amount/i.test(message) && /check constraint|greater than/i.test(message)) {
    return "Payment amount must be greater than zero.";
  }
  if (/exceed.*remaining balance/i.test(message)) {
    return "Payment amount cannot exceed the current remaining balance.";
  }
  return "Could not record the payment. Please try again.";
}

function evidenceFileName(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return safe.slice(-80) || "evidence";
}

/**
 * Records one real ledger payment. The existing mark_order_paid RPC is called
 * only after the new ledger total covers the reservation total, preserving
 * paid_at and status-history behavior without asking that RPC to insert a
 * payment row with a null payment_method.
 */
export async function recordReservationPayment(
  orderId: string,
  formData: FormData
): Promise<PaymentFormResult> {
  if (!UUID_PATTERN.test(orderId)) {
    return { ok: false, message: "Invalid reservation id." };
  }

  const amount = roundPaymentAmount(Number(formData.get("amount")));
  const method = String(formData.get("payment_method") ?? "").trim();
  const referenceNumber = String(formData.get("reference_number") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const evidence = formData
    .getAll("evidence")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false, message: "Your session expired. Sign in and try again." };
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id, status, total_amount, shipping_fee")
    .eq("id", orderId)
    .is("archived_at", null)
    .maybeSingle();

  if (orderError) {
    return { ok: false, message: "Could not load the reservation balance." };
  }
  if (!order) {
    return { ok: false, message: "Reservation not found." };
  }
  if (order.status !== "reserved") {
    return { ok: false, message: "Payments can only be recorded for active reservations." };
  }

  const reservationTotal = roundPaymentAmount(
    Number(order.total_amount) + Number(order.shipping_fee ?? 0)
  );
  const { data: currentPayments, error: currentPaymentsError } = await supabase
    .from("order_payments")
    .select("amount")
    .eq("order_id", orderId);

  if (currentPaymentsError) {
    return { ok: false, message: "Could not load the current payment total." };
  }

  const currentBalance = calculatePaymentBalance(
    reservationTotal,
    currentPayments ?? []
  );
  const validationError = validatePaymentInput({
    amount,
    method,
    remainingBalance: currentBalance.remainingBalance,
    evidence,
  });
  if (validationError) return { ok: false, message: validationError };

  const paymentId = randomUUID();
  const uploadedPaths: string[] = [];

  for (const file of evidence) {
    const path = `${orderId}/${paymentId}/${randomUUID()}-${evidenceFileName(file.name)}`;
    const { error } = await supabase.storage
      .from(PAYMENT_EVIDENCE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });

    if (error) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from(PAYMENT_EVIDENCE_BUCKET).remove(uploadedPaths);
      }
      return {
        ok: false,
        message:
          /bucket not found/i.test(error.message)
            ? "Payment evidence storage is not configured yet."
            : "Could not upload the payment evidence. The payment was not recorded.",
      };
    }
    uploadedPaths.push(path);
  }

  const { data: paymentRows, error: insertError } = await supabase.rpc(
    "record_order_payment",
    {
      p_order_id: orderId,
      p_amount: amount,
      p_payment_method: method,
      p_reference_number: referenceNumber,
      p_notes: notes,
    }
  );

  if (insertError || !paymentRows?.[0]) {
    if (uploadedPaths.length > 0) {
      await supabase.storage.from(PAYMENT_EVIDENCE_BUCKET).remove(uploadedPaths);
    }
    return { ok: false, message: paymentErrorMessage(insertError) };
  }
  const payment = paymentRows[0] as {
    payment_id: string;
    total_paid: number;
    remaining_balance: number;
    fully_paid: boolean;
  };

  if (uploadedPaths.length > 0) {
    const evidenceRows = evidence.map((file, index) => ({
      payment_id: payment.payment_id,
      storage_path: uploadedPaths[index],
      mime_type: file.type,
      size_bytes: file.size,
      created_by: user.id,
    }));
    const { error: evidenceError } = await supabase.from("payment_evidence").insert(evidenceRows);
    if (evidenceError) {
      await supabase.storage.from(PAYMENT_EVIDENCE_BUCKET).remove(uploadedPaths);
      revalidateReservationPaths();
      return {
        ok: false,
        paymentRecorded: true,
        message: "Payment recorded, but its evidence metadata could not be saved.",
      };
    }
  }

  revalidateReservationPaths();
  if (payment.fully_paid) revalidatePath("/orders/paid");

  return {
    ok: true,
    totalPaid: Number(payment.total_paid),
    remainingBalance: Number(payment.remaining_balance),
    fullyPaid: payment.fully_paid,
    evidenceCount: uploadedPaths.length,
  };
}

/**
 * Soft-deletes (archives) the selected reservations by stamping archived_at.
 * RLS still applies: only staff/admin may update orders.
 */
export async function archiveSelectedOrders(rawIds: string[]): Promise<BulkActionResult> {
  const ids = sanitizeIds(rawIds);
  const supabase = await createClient();
  const archivedAt = new Date().toISOString();

  const succeeded: string[] = [];
  const failed: { id: string; message: string }[] = [];

  for (const id of ids) {
    const { error } = await supabase
      .from("orders")
      .update({ archived_at: archivedAt })
      .eq("id", id)
      .is("archived_at", null);
    if (error) {
      failed.push({ id, message: error.message });
    } else {
      succeeded.push(id);
    }
  }

  if (succeeded.length > 0) {
    revalidatePath("/orders/reserved");
    revalidatePath("/orders");
    revalidatePath("/dashboard");
  }

  return { succeeded, failed };
}

function revalidateReservationPaths() {
  revalidatePath("/orders/reserved");
  revalidatePath("/orders");
  revalidatePath("/dashboard");
}

export async function createReservation(
  input: ReservationInput
): Promise<ReservationFormResult> {
  const validationError = validateReservationInput(input);
  if (validationError) return { ok: false, message: validationError };
  if (input.downpayment > 0 && !input.downpaymentMethod) {
    return { ok: false, message: "Select a payment method for the initial downpayment." };
  }

  const supabase = await createClient();

  try {
    const quantity = Math.floor(input.quantity);
    // RPC expects p_price to be the raw unit price (before discount)
    const rawUnitPrice = round2(input.amount / quantity);

    const payload = {
      p_fb_name: input.fbName?.trim() || null,
      p_customer_name: input.customerName.trim(),
      p_customer_address: input.customerAddress.trim() || null,
      p_phone: input.phone.trim() || null,
      p_item_name: input.itemName.trim(),
      p_item_code: input.itemCode.trim() || null,
      p_category_name: input.category.trim() || null,
      p_quantity: quantity,
      p_price: rawUnitPrice,
      p_discount: round2(input.discount),
      p_shipping_fee: round2(input.shippingFee),
      p_downpayment: round2(input.downpayment),
      p_downpayment_method:
        input.downpayment > 0 ? input.downpaymentMethod : null,
      p_type: input.type,
    };

    const { data, error } = await supabase.rpc("create_reservation", payload);

    if (error) {
      return { ok: false, message: mapRpcError(error) };
    }

    if (!data || data.length === 0) {
      return { ok: false, message: "Reservation created but no order ID returned." };
    }

    const result = data[0] as { order_id: string; order_number: string };
    revalidateReservationPaths();
    return { ok: true, orderId: result.order_id, orderNumber: result.order_number };
  } catch (error) {
    return {
      ok: false,
      message: mapRpcError(error),
    };
  }
}

export async function updateReservation(
  orderId: string,
  input: ReservationInput
): Promise<ReservationFormResult> {
  if (!UUID_PATTERN.test(orderId)) {
    return { ok: false, message: "Invalid reservation id." };
  }

  const validationError = validateReservationInput(input);
  if (validationError) return { ok: false, message: validationError };

  const supabase = await createClient();

  try {
    const quantity = Math.floor(input.quantity);
    const rawUnitPrice = round2(input.amount / quantity);
    const { error } = await supabase.rpc("update_reservation", {
      p_order_id: orderId,
      p_fb_name: input.fbName?.trim() || null,
      p_customer_name: input.customerName.trim(),
      p_customer_address: input.customerAddress.trim() || null,
      p_phone: input.phone.trim() || null,
      p_item_name: input.itemName.trim(),
      p_item_code: input.itemCode.trim() || null,
      p_category_name: input.category.trim() || null,
      p_quantity: quantity,
      p_price: rawUnitPrice,
      p_discount: round2(input.discount),
      p_shipping_fee: round2(input.shippingFee),
      p_downpayment: round2(input.downpayment),
      p_downpayment_method: input.downpaymentMethod || null,
      p_type: input.type,
    });
    if (error) return { ok: false, message: mapRpcError(error) };

    revalidateReservationPaths();
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Could not update the reservation.",
    };
  }
}

/**
 * Cancels each selected reservation through the cancel_order RPC, which
 * guards status transitions, stamps cancelled_at, records the optional
 * cancellation reason, and writes status history.
 */
export async function cancelSelectedOrders(
  rawIds: string[],
  rawReason?: string
): Promise<BulkActionResult> {
  const ids = sanitizeIds(rawIds);
  const supabase = await createClient();
  const reason = rawReason?.trim() || undefined;

  const succeeded: string[] = [];
  const failed: { id: string; message: string }[] = [];

  for (const id of ids) {
    const { error } = await supabase.rpc("cancel_order", {
      p_order_id: id,
      ...(reason ? { p_reason: reason } : {}),
    });
    if (error) {
      failed.push({ id, message: error.message });
    } else {
      succeeded.push(id);
    }
  }

  if (succeeded.length > 0) {
    revalidatePath("/orders/reserved");
    revalidatePath("/orders/cancelled");
    revalidatePath("/dashboard");
  }

  return { succeeded, failed };
}

/**
 * Marks each selected paid order as shipped through the mark_order_shipped
 * RPC, which stamps shipped_at and writes status history.
 */
export async function shipSelectedOrders(rawIds: string[]): Promise<BulkActionResult> {
  const ids = sanitizeIds(rawIds);
  const supabase = await createClient();

  const succeeded: string[] = [];
  const failed: { id: string; message: string }[] = [];

  for (const id of ids) {
    const { error } = await supabase.rpc("mark_order_shipped", { p_order_id: id });
    if (error) {
      failed.push({ id, message: error.message });
    } else {
      succeeded.push(id);
    }
  }

  if (succeeded.length > 0) {
    revalidatePath("/orders/paid");
    revalidatePath("/orders/shipped");
    revalidatePath("/dashboard");
  }

  return { succeeded, failed };
}

/**
 * Marks each selected shipped order as claimed through the mark_order_claimed
 * RPC, which stamps claimed_at and writes status history.
 */
export async function claimSelectedOrders(rawIds: string[]): Promise<BulkActionResult> {
  const ids = sanitizeIds(rawIds);
  const supabase = await createClient();

  const succeeded: string[] = [];
  const failed: { id: string; message: string }[] = [];

  for (const id of ids) {
    const { error } = await supabase.rpc("mark_order_claimed", { p_order_id: id });
    if (error) {
      failed.push({ id, message: error.message });
    } else {
      succeeded.push(id);
    }
  }

  if (succeeded.length > 0) {
    revalidatePath("/orders/shipped");
    revalidatePath("/orders/claimed");
    revalidatePath("/dashboard");
  }

  return { succeeded, failed };
}

/** Moves one shipped order to RTO and preserves the reason/notes in its lifecycle record. */
export async function markOrderRto(
  orderId: string,
  rawReason: string,
  rawNotes: string
): Promise<RtoActionResult> {
  if (!UUID_PATTERN.test(orderId)) {
    return { ok: false, message: "Invalid order id." };
  }

  const reason = rawReason.trim();
  const notes = rawNotes.trim();
  if (!reason) return { ok: false, message: "RTO reason is required." };
  if (reason.length > 500) {
    return { ok: false, message: "RTO reason must be 500 characters or fewer." };
  }
  if (notes.length > 2_000) {
    return { ok: false, message: "RTO notes must be 2,000 characters or fewer." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_order_rto", {
    p_order_id: orderId,
    p_reason: reason,
    p_notes: notes || null,
  });

  if (error) {
    const message = error.message ?? "";
    if (error.code === "42501" || /not authorized/i.test(message)) {
      return { ok: false, message: "You are not authorized to mark orders as RTO." };
    }
    if (/Only paid or shipped/i.test(message)) {
      return { ok: false, message: "Only paid or shipped orders can be marked as RTO." };
    }
    return { ok: false, message: "Could not move this order to RTO. Please try again." };
  }

  revalidatePath("/orders/shipped");
  revalidatePath("/orders/rto");
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { ok: true };
}
