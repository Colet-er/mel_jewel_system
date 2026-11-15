"use server";

import type { Order } from "@/types";
import { describeDbError, fetchOrderById } from "@/lib/supabase/queries";

export type LoadInvoiceResult =
  | { ok: true; order: Order }
  | { ok: false; message: string };

/** Loads one order for the floating invoice modal (RLS applies via the server client). */
export async function loadInvoiceOrder(orderId: string): Promise<LoadInvoiceResult> {
  if (typeof orderId !== "string" || orderId.trim() === "") {
    return { ok: false, message: "Missing order reference." };
  }

  try {
    const order = await fetchOrderById(orderId);
    if (!order) {
      return { ok: false, message: "This order does not exist or was archived." };
    }
    return { ok: true, order };
  } catch (error) {
    return { ok: false, message: describeDbError(error).description };
  }
}
