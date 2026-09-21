"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface MoissaniteInventoryInput {
  id?: string;
  itemNumber: string;
  itemDescription: string;
  price: number;
  cost?: number;
  categoryId: string;
  setting: string;
}

export type MoissaniteInventoryResult =
  | { ok: true }
  | { ok: false; message: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateInput(input: MoissaniteInventoryInput): string | null {
  if (!input.itemNumber.trim()) return "Item number is required.";
  if (!input.itemDescription.trim()) return "Item description is required.";
  if (!Number.isFinite(input.price) || input.price < 0) return "Price must be zero or greater.";
  if (input.cost !== undefined && (!Number.isFinite(input.cost) || input.cost < 0)) {
    return "Cost must be zero or greater.";
  }
  if (!UUID_PATTERN.test(input.categoryId)) return "Please select a valid category.";
  if (input.id && !UUID_PATTERN.test(input.id)) return "Invalid inventory item.";
  return null;
}

function revalidateInventory() {
  revalidatePath("/moissanite/sku");
  revalidatePath("/moissanite/sold");
  revalidatePath("/orders/reserved");
  revalidatePath("/dashboard");
}

export async function saveMoissaniteInventory(
  input: MoissaniteInventoryInput
): Promise<MoissaniteInventoryResult> {
  const validationError = validateInput(input);
  if (validationError) return { ok: false, message: validationError };

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, message: "Your session expired. Sign in and try again." };

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id, name")
    .eq("id", input.categoryId)
    .maybeSingle();

  if (categoryError || !category) {
    return { ok: false, message: "Please select a valid category." };
  }

  const cost = input.cost !== undefined ? Math.round(input.cost * 100) / 100 : 0;

  const values = {
    sku: input.itemNumber.trim(),
    item_name: input.itemDescription.trim(),
    description: input.itemDescription.trim(),
    selling_price: Math.round(input.price * 100) / 100,
    cost,
    category_id: input.categoryId,
    setting: input.setting.trim() || null,
    status: "active" as const,
  };

  const operation = input.id
    ? supabase.from("moissanite_skus").update(values).eq("id", input.id).neq("status", "archived")
    : supabase.from("moissanite_skus").insert({ ...values, created_by: user.id });
  const { error } = await operation;

  if (error) {
    if (error.code === "23505" || /unique|duplicate/i.test(error.message)) {
      return { ok: false, message: "That item number already exists." };
    }
    if (error.code === "42501" || /row-level security|not authorized/i.test(error.message)) {
      return { ok: false, message: "You are not authorized to manage inventory." };
    }
    return { ok: false, message: "Could not save the inventory item. Please try again." };
  }

  revalidateInventory();
  return { ok: true };
}

export async function deleteMoissaniteInventory(id: string): Promise<MoissaniteInventoryResult> {
  if (!UUID_PATTERN.test(id)) return { ok: false, message: "Invalid inventory item." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("moissanite_skus")
    .update({ status: "archived" })
    .eq("id", id);
  if (error) {
    if (error.code === "42501" || /row-level security|not authorized/i.test(error.message)) {
      return { ok: false, message: "You are not authorized to delete inventory items." };
    }
    return { ok: false, message: "Could not delete the inventory item." };
  }
  revalidateInventory();
  return { ok: true };
}
