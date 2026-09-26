"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { isDeveloperEmail } from "@/lib/auth/developer";

const commissionRecordSchema = z.object({
  workerName: z.string().trim().min(1, "Employee name is required.").max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "A valid date is required."),
  relatedOrderId: z.string().uuid("Select a valid order."),
  amount: z.number().finite().min(0, "Commission cannot be negative."),
  status: z.enum(["paid", "unpaid"]),
  notes: z.string().trim().max(500).optional(),
});

export interface CreateCommissionRecordInput {
  workerName: string;
  date: string;
  relatedOrderId: string;
  amount: number;
  status: "paid" | "unpaid";
  notes?: string;
}

export interface CommissionActionResult {
  success: boolean;
  error?: string;
}

export async function createCommissionRecord(
  input: CreateCommissionRecordInput
): Promise<CommissionActionResult> {
  const parsed = commissionRecordSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid commission record." };
  }

  const { user, profile } = await getCurrentProfile();
  if (profile?.role !== "owner" && !isDeveloperEmail(user.email)) {
    return { success: false, error: "Only business owners can create commission records." };
  }

  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id")
    .eq("id", parsed.data.relatedOrderId)
    .is("archived_at", null)
    .maybeSingle();

  if (orderError || !order) {
    return { success: false, error: "The selected order is unavailable." };
  }

  const { error } = await supabase.from("commissions").insert({
    worker_name: parsed.data.workerName,
    date: parsed.data.date,
    related_order_id: parsed.data.relatedOrderId,
    description: "Customer assistance",
    amount: parsed.data.amount,
    status: parsed.data.status,
    notes: parsed.data.notes || null,
    created_by: user.id,
  });

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/commission");
  return { success: true };
}

export async function updateCommissionStatus(
  commissionId: string,
  status: "paid" | "unpaid"
): Promise<CommissionActionResult> {
  const parsedId = z.string().uuid().safeParse(commissionId);
  const parsedStatus = z.enum(["paid", "unpaid"]).safeParse(status);
  if (!parsedId.success || !parsedStatus.success) {
    return { success: false, error: "Invalid commission update parameters." };
  }

  const { user, profile } = await getCurrentProfile();
  if (profile?.role !== "owner" && !isDeveloperEmail(user.email)) {
    return { success: false, error: "Only business owners can update commission status." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("commissions")
    .update({ status: parsedStatus.data })
    .eq("id", parsedId.data);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/commission");
  return { success: true };
}

export async function deleteCommissionRecord(
  commissionId: string
): Promise<CommissionActionResult> {
  const parsedId = z.string().uuid().safeParse(commissionId);
  if (!parsedId.success) {
    return { success: false, error: "Invalid commission record ID." };
  }

  const { user, profile } = await getCurrentProfile();
  if (profile?.role !== "owner" && !isDeveloperEmail(user.email)) {
    return { success: false, error: "Only business owners can delete commission records." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("commissions")
    .delete()
    .eq("id", parsedId.data);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/commission");
  return { success: true };
}
