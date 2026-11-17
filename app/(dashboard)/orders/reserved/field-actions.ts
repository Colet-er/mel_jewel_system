"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type OrderFieldResult = { ok: true } | { ok: false; message: string };

/** Maps a Postgres/RPC error from the order field functions to a staff-facing message. */
function fieldErrorMessage(error: { code?: string; message?: string }, fallback: string): string {
  const message = error.message ?? "";
  if (error.code === "42501" || /not authorized/i.test(message)) {
    return "You are not authorized to update this order.";
  }
  if (/already used by another order/i.test(message)) return "That claim code is already used by another order.";
  if (/only be set on COD orders/i.test(message)) return "This setting only applies to COD orders.";
  if (/must be 50 characters/i.test(message)) return "Claim code must be 50 characters or fewer.";
  if (/must be live or chat/i.test(message)) return "Order source must be Live or Chat.";
  if (/function .* does not exist|could not find the function/i.test(message)) {
    return "This feature is not set up in the database yet. Apply migration 0031 first.";
  }
  return fallback;
}

function revalidateOrderLists() {
  revalidatePath("/orders/booking");
  revalidatePath("/orders/shipped");
  revalidatePath("/orders/claimed");
  revalidatePath("/orders/branch-collect");
  revalidatePath("/orders");
}

/** Sets Live / Chat on an order. Pass null to clear it. */
export async function setOrderSource(
  orderId: string,
  source: "live" | "chat" | null
): Promise<OrderFieldResult> {
  if (!UUID_PATTERN.test(orderId)) return { ok: false, message: "Invalid order id." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_source", {
    p_order_id: orderId,
    p_source: source,
  });
  if (error) return { ok: false, message: fieldErrorMessage(error, "Could not save the order source.") };

  revalidateOrderLists();
  return { ok: true };
}

/** Marks (or unmarks) a COD order as Pasabuy. */
export async function setOrderPasabuyCod(orderId: string, value: boolean): Promise<OrderFieldResult> {
  if (!UUID_PATTERN.test(orderId)) return { ok: false, message: "Invalid order id." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_pasabuy_cod", {
    p_order_id: orderId,
    p_value: value,
  });
  if (error) return { ok: false, message: fieldErrorMessage(error, "Could not save the Pasabuy COD flag.") };

  revalidateOrderLists();
  return { ok: true };
}

/** Saves (or clears) the COD claim code. Staff type it in; it must be unique. */
export async function setOrderClaimCode(orderId: string, rawClaimCode: string): Promise<OrderFieldResult> {
  if (!UUID_PATTERN.test(orderId)) return { ok: false, message: "Invalid order id." };
  const claimCode = rawClaimCode.trim();
  if (claimCode.length > 50) return { ok: false, message: "Claim code must be 50 characters or fewer." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_claim_code", {
    p_order_id: orderId,
    p_claim_code: claimCode || null,
  });
  if (error) return { ok: false, message: fieldErrorMessage(error, "Could not save the claim code.") };

  revalidateOrderLists();
  return { ok: true };
}
