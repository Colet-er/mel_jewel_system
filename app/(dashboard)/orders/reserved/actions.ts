"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ReservationInput, ReservationLineItemInput } from "@/types";
import { validateReservationInput, round2, mapRpcError } from "@/lib/utils/reservation-validation";
import { isDeliveryStatus } from "@/lib/utils/delivery-status";
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

export type { ReservationInput, ReservationLineItemInput };

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
  if (order.status === "cancelled") {
    return { ok: false, message: "Payments cannot be recorded for cancelled orders." };
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

export type PaymentChangeResult =
  | { ok: true; totalPaid: number; remainingBalance: number }
  | { ok: false; message: string };

function paymentChangeErrorMessage(error: { code?: string; message?: string } | null): string {
  const message = error?.message ?? "";
  if (error?.code === "42501" || /row-level security|not authorized/i.test(message)) {
    return "You are not authorized to change payments.";
  }
  if (/cancelled orders/i.test(message)) return "Payments cannot be changed on cancelled orders.";
  if (/Payment not found/i.test(message)) return "This payment no longer exists. Refresh and try again.";
  if (/exceed.*remaining balance/i.test(message)) {
    return "The new amount would make total payments exceed the order total.";
  }
  if (/payment method/i.test(message)) return "Select a valid payment method.";
  if (/function .* does not exist|could not find the function/i.test(message)) {
    return "Payment editing is not set up in the database yet. Apply migration 0027 first.";
  }
  return "Could not update the payment. Please try again.";
}

/** Corrects the amount, method, reference, or notes of one recorded payment. */
export async function updateReservationPayment(
  paymentId: string,
  input: { amount: number; method: string; referenceNumber?: string; notes?: string }
): Promise<PaymentChangeResult> {
  if (!UUID_PATTERN.test(paymentId)) return { ok: false, message: "Invalid payment id." };

  const amount = roundPaymentAmount(Number(input.amount));
  const method = String(input.method ?? "").trim();
  if (!Number.isFinite(amount) || amount < 0) {
    return { ok: false, message: "Payment amount cannot be negative." };
  }
  if (!method) return { ok: false, message: "Select a payment method." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_order_payment", {
    p_payment_id: paymentId,
    p_amount: amount,
    p_payment_method: method,
    p_reference_number: input.referenceNumber?.trim() || null,
    p_notes: input.notes?.trim() || null,
  });

  if (error || !data?.[0]) return { ok: false, message: paymentChangeErrorMessage(error) };

  const row = data[0] as { order_id: string; total_paid: number; remaining_balance: number };
  revalidateReservationPaths();
  revalidatePath(`/orders/${row.order_id}`);
  return { ok: true, totalPaid: Number(row.total_paid), remainingBalance: Number(row.remaining_balance) };
}

/** Deletes one recorded payment and its uploaded proof-of-payment images. */
export async function deleteReservationPayment(paymentId: string): Promise<PaymentChangeResult> {
  if (!UUID_PATTERN.test(paymentId)) return { ok: false, message: "Invalid payment id." };

  const supabase = await createClient();

  // Collect evidence file paths before the cascade removes their metadata rows.
  const { data: evidenceRows } = await supabase
    .from("payment_evidence")
    .select("storage_path")
    .eq("payment_id", paymentId);

  const { data, error } = await supabase.rpc("delete_order_payment", { p_payment_id: paymentId });
  if (error || !data?.[0]) {
    return {
      ok: false,
      message: paymentChangeErrorMessage(error).replace("update the payment", "delete the payment"),
    };
  }

  const paths = (evidenceRows ?? []).map((row) => row.storage_path as string).filter(Boolean);
  if (paths.length > 0) {
    // Best effort: the ledger row is already gone, so a storage hiccup only leaves an orphaned file.
    await supabase.storage.from(PAYMENT_EVIDENCE_BUCKET).remove(paths);
  }

  const row = data[0] as { order_id: string; total_paid: number; remaining_balance: number };
  revalidateReservationPaths();
  revalidatePath(`/orders/${row.order_id}`);
  return { ok: true, totalPaid: Number(row.total_paid), remainingBalance: Number(row.remaining_balance) };
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
  revalidatePath("/orders/paid");
  revalidatePath("/orders/booking");
  revalidatePath("/orders/shipped");
  revalidatePath("/orders/claimed");
  revalidatePath("/orders");
  revalidatePath("/collections");
  revalidatePath("/dashboard");
}

export async function createReservation(
  input: ReservationInput
): Promise<ReservationFormResult> {
  if (input.compileTargetOrderId) {
    return updateReservation(input.compileTargetOrderId, input);
  }

  const validationError = validateReservationInput(input);
  if (validationError) return { ok: false, message: validationError };
  if (input.downpayment > 0 && !input.downpaymentMethod) {
    return { ok: false, message: "Select a payment method for the initial downpayment." };
  }

  const supabase = await createClient();

  try {
    const hasItemsArray = Array.isArray(input.items) && input.items.length > 0;
    const firstItem = hasItemsArray ? input.items![0] : null;
    const totalQuantity = hasItemsArray
      ? input.items!.reduce((sum, item) => sum + Math.max(1, Math.floor(item.quantity)), 0)
      : Math.max(1, Math.floor(input.quantity ?? 1));
    const rawUnitPrice = hasItemsArray
      ? round2(firstItem!.unitPrice)
      : round2(input.amount / totalQuantity);

    const itemsPayload = hasItemsArray
      ? input.items!.map((it) => ({
          item_name: it.itemName.trim(),
          item_code: it.itemCode?.trim() || null,
          category_name: it.category?.trim() || null,
          quantity: Math.max(1, Math.floor(it.quantity)),
          price: round2(it.unitPrice),
        }))
      : null;

    const customerNameVal =
      input.customerName?.trim() || input.fbName?.trim() || "Guest Customer";

    const payload = {
      p_fb_name: input.fbName?.trim() || null,
      p_customer_name: customerNameVal,
      p_customer_address: input.customerAddress?.trim() || null,
      p_phone: input.phone?.trim() || null,
      p_item_name: (firstItem?.itemName ?? input.itemName ?? "").trim(),
      p_item_code: (firstItem?.itemCode ?? input.itemCode ?? "").trim() || null,
      p_category_name: (firstItem?.category ?? input.category ?? "").trim() || null,
      p_quantity: totalQuantity,
      p_price: rawUnitPrice,
      p_discount: round2(input.discount),
      p_shipping_fee: round2(input.shippingFee),
      p_downpayment: round2(input.downpayment),
      p_downpayment_method:
        input.downpayment > 0 ? input.downpaymentMethod : null,
      p_type: input.type,
      p_items: itemsPayload,
    };

    const { data, error } = await supabase.rpc("create_reservation", payload);

    if (error) {
      return { ok: false, message: mapRpcError(error) };
    }

    if (!data || data.length === 0) {
      return { ok: false, message: "Reservation created but no order ID returned." };
    }

    const result = data[0] as { order_id: string; order_number: string };
    if (input.orderSource !== undefined) {
      // The order already exists, so a failure here must not look like a failed create.
      const { error: sourceError } = await supabase.rpc("set_order_source", {
        p_order_id: result.order_id,
        p_source: input.orderSource,
      });
      if (sourceError) console.error("Failed to save order source:", sourceError.message);
    }
    revalidateReservationPaths();
    return { ok: true, orderId: result.order_id, orderNumber: result.order_number };
  } catch (error) {
    return {
      ok: false,
      message: mapRpcError(error),
    };
  }
}

export interface ImportReservationsResult {
  created: number;
  failed: { fbName: string; message: string }[];
}

/**
 * Creates one reservation per parsed CSV group. Each input is re-validated on
 * the server by createReservation, so a tampered client payload cannot bypass
 * the normal checks. Runs sequentially so one bad row never blocks the rest.
 */
export async function importReservations(
  inputs: ReservationInput[]
): Promise<ImportReservationsResult> {
  const MAX = 200;
  const list = Array.isArray(inputs) ? inputs.slice(0, MAX) : [];
  const failed: ImportReservationsResult["failed"] = [];
  let created = 0;

  for (const raw of list) {
    // Never let an import target an existing order.
    const input: ReservationInput = { ...raw, compileTargetOrderId: undefined, invoiceNumber: undefined };
    const fbName = input.fbName?.trim() || input.customerName?.trim() || "Unnamed";
    const result = await createReservation(input);
    if (result.ok) {
      created += 1;
    } else {
      failed.push({ fbName, message: result.message });
    }
  }

  if (Array.isArray(inputs) && inputs.length > MAX) {
    failed.push({ fbName: "—", message: `Only the first ${MAX} reservations were imported.` });
  }

  return { created, failed };
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
    const hasItemsArray = Array.isArray(input.items) && input.items.length > 0;
    const firstItem = hasItemsArray ? input.items![0] : null;
    const totalQuantity = hasItemsArray
      ? input.items!.reduce((sum, item) => sum + Math.max(1, Math.floor(item.quantity)), 0)
      : Math.max(1, Math.floor(input.quantity ?? 1));
    const rawUnitPrice = hasItemsArray
      ? round2(firstItem!.unitPrice)
      : round2(input.amount / totalQuantity);

    const itemsPayload = hasItemsArray
      ? input.items!.map((it) => ({
          item_name: it.itemName.trim(),
          item_code: it.itemCode?.trim() || null,
          category_name: it.category?.trim() || null,
          quantity: Math.max(1, Math.floor(it.quantity)),
          price: round2(it.unitPrice),
        }))
      : null;

    const customerNameVal =
      input.customerName?.trim() || input.fbName?.trim() || "Guest Customer";

    const { error } = await supabase.rpc("update_reservation", {
      p_order_id: orderId,
      p_fb_name: input.fbName?.trim() || null,
      p_customer_name: customerNameVal,
      p_customer_address: input.customerAddress?.trim() || null,
      p_phone: input.phone?.trim() || null,
      p_item_name: (firstItem?.itemName ?? input.itemName ?? "").trim(),
      p_item_code: (firstItem?.itemCode ?? input.itemCode ?? "").trim() || null,
      p_category_name: (firstItem?.category ?? input.category ?? "").trim() || null,
      p_quantity: totalQuantity,
      p_price: rawUnitPrice,
      p_discount: round2(input.discount),
      p_shipping_fee: round2(input.shippingFee),
      p_downpayment: round2(input.downpayment),
      p_downpayment_method: input.downpaymentMethod || null,
      p_type: input.type,
      p_items: itemsPayload,
    });
    if (error) return { ok: false, message: mapRpcError(error) };

    if (input.orderSource !== undefined) {
      const { error: sourceError } = await supabase.rpc("set_order_source", {
        p_order_id: orderId,
        p_source: input.orderSource,
      });
      if (sourceError) return { ok: false, message: mapRpcError(sourceError) };
    }

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
    revalidatePath("/orders/paid");
    revalidatePath("/orders/booking");
    revalidatePath("/orders/shipped");
    revalidatePath("/orders/rto");
    revalidatePath("/orders/cancelled");
    revalidatePath("/dashboard");
  }

  return { succeeded, failed };
}

/**
 * Moves each selected paid / reserved / RTO order to the Booking stage via the
 * mark_order_booked RPC (stamps booked_at and writes status history).
 */
export async function bookSelectedOrders(rawIds: string[]): Promise<BulkActionResult> {
  const ids = sanitizeIds(rawIds);
  const supabase = await createClient();

  const succeeded: string[] = [];
  const failed: { id: string; message: string }[] = [];

  for (const id of ids) {
    const { error } = await supabase.rpc("mark_order_booked", { p_order_id: id });
    if (error) {
      failed.push({ id, message: error.message });
    } else {
      succeeded.push(id);
    }
  }

  if (succeeded.length > 0) {
    revalidatePath("/orders/reserved");
    revalidatePath("/orders/paid");
    revalidatePath("/orders/booking");
    revalidatePath("/orders/rto");
    revalidatePath("/dashboard");
  }

  return { succeeded, failed };
}

export type BookWithTrackingResult =
  | { ok: true; trackingSaved: boolean; message: string }
  | { ok: false; message: string };

/**
 * Books one order and, when given, saves its tracking number in the same
 * request (used by the "Book Order" form on the Paid page).
 */
export async function bookOrderWithTracking(
  orderId: string,
  rawTrackingNumber: string
): Promise<BookWithTrackingResult> {
  if (!UUID_PATTERN.test(orderId)) return { ok: false, message: "Invalid order id." };
  const trackingNumber = rawTrackingNumber.trim();
  if (trackingNumber.length > 100) {
    return { ok: false, message: "Tracking number must be 100 characters or fewer." };
  }

  const booked = await bookSelectedOrders([orderId]);
  if (booked.succeeded.length === 0) {
    const message = booked.failed[0]?.message ?? "";
    if (/function .* does not exist|could not find the function/i.test(message)) {
      return { ok: false, message: "Booking is not set up in the database yet. Apply migration 0028 first." };
    }
    if (/downpayment is required/i.test(message)) {
      return { ok: false, message: "Record at least a downpayment before booking this order." };
    }
    if (/not authorized/i.test(message)) return { ok: false, message: "You are not authorized to book orders." };
    return { ok: false, message: "Could not book this order. It may have changed; refresh and try again." };
  }

  if (!trackingNumber) {
    return { ok: true, trackingSaved: false, message: "Order booked. Add the tracking no. on the Booking page." };
  }

  const saved = await setOrderTrackingNumber(orderId, trackingNumber);
  return saved.ok
    ? { ok: true, trackingSaved: true, message: `Order booked with tracking no. ${trackingNumber}.` }
    : { ok: true, trackingSaved: false, message: `Order booked, but the tracking no. was not saved: ${saved.message}` };
}

/** Sets (or clears) the delivery-status chip on an order. */
export async function setOrderDeliveryStatus(
  orderId: string,
  rawStatus: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!UUID_PATTERN.test(orderId)) return { ok: false, message: "Invalid order id." };
  const status = rawStatus.trim();
  if (status && !isDeliveryStatus(status)) return { ok: false, message: "Invalid status." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_delivery_status", {
    p_order_id: orderId,
    p_delivery_status: status || null,
  });
  if (error) {
    const message = error.message ?? "";
    if (error.code === "42501" || /not authorized/i.test(message)) {
      return { ok: false, message: "You are not authorized to change the status." };
    }
    if (/function .* does not exist|could not find the function/i.test(message)) {
      return { ok: false, message: "Apply migration 0030 to enable delivery statuses." };
    }
    return { ok: false, message: "Could not update the status. Please try again." };
  }

  revalidatePath("/orders/booking");
  revalidatePath("/orders/shipped");
  revalidatePath("/orders/claimed");
  revalidatePath("/orders/rto");
  revalidatePath("/orders/cancelled");
  return { ok: true };
}

export type TrackingNumberResult = { ok: true; trackingNumber: string | null } | { ok: false; message: string };

/** Saves (or clears) the courier tracking number on a booked/shipped order. */
export async function setOrderTrackingNumber(
  orderId: string,
  rawTrackingNumber: string
): Promise<TrackingNumberResult> {
  if (!UUID_PATTERN.test(orderId)) return { ok: false, message: "Invalid order id." };
  const trackingNumber = rawTrackingNumber.trim();
  if (trackingNumber.length > 100) {
    return { ok: false, message: "Tracking number must be 100 characters or fewer." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_tracking_number", {
    p_order_id: orderId,
    p_tracking_number: trackingNumber || null,
  });

  if (error) {
    const message = error.message ?? "";
    if (error.code === "42501" || /not authorized/i.test(message)) {
      return { ok: false, message: "You are not authorized to update tracking numbers." };
    }
    if (/only be set on booked or shipped/i.test(message)) {
      return { ok: false, message: "Tracking numbers can only be set on booked or shipped orders." };
    }
    if (/function .* does not exist|could not find the function/i.test(message)) {
      return { ok: false, message: "Booking is not set up in the database yet. Apply migration 0028 first." };
    }
    return { ok: false, message: "Could not save the tracking number. Please try again." };
  }

  revalidatePath("/orders/booking");
  revalidatePath("/orders/shipped");
  return { ok: true, trackingNumber: trackingNumber || null };
}

/**
 * Marks each selected BOOKED order as shipped through the mark_order_shipped
 * RPC, which requires a tracking number, stamps shipped_at and writes history.
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
    revalidatePath("/orders/reserved");
    revalidatePath("/orders/paid");
    revalidatePath("/orders/booking");
    revalidatePath("/orders/shipped");
    revalidatePath("/orders/rto");
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

/** Updates the transaction/reservation type (regular / pasabuy / cod) for an order. */
export async function updateOrderTransactionType(
  orderId: string,
  type: "regular" | "cod" | "pasabuy" | "pasabuy_cod"
): Promise<{ ok: boolean; message?: string }> {
  if (!UUID_PATTERN.test(orderId)) {
    return { ok: false, message: "Invalid order ID." };
  }
  if (!["regular", "cod", "pasabuy", "pasabuy_cod"].includes(type)) {
    return { ok: false, message: "Invalid transaction type." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ reservation_type: type })
    .eq("id", orderId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateReservationPaths();
  revalidatePath(`/orders/${orderId}/invoice`);
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}
