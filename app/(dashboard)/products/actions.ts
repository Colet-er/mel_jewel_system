"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateProductInput, type ProductInput } from "@/lib/utils/product-validation";

export interface ProductActionResult {
  ok: boolean;
  message?: string;
}

function revalidateProductPaths() {
  revalidatePath("/products");
  revalidatePath("/categories");
  revalidatePath("/orders/new");
  revalidatePath("/orders/reserved");
  revalidatePath("/dashboard");
}

export async function saveProduct(input: ProductInput): Promise<ProductActionResult> {
  const errorMsg = validateProductInput(input);
  if (errorMsg) return { ok: false, message: errorMsg };

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Your session expired. Sign in and try again." };
  }

  const sku = input.sku?.trim() ? input.sku.trim() : null;
  const categoryId = input.categoryId?.trim() ? input.categoryId.trim() : null;
  const cost = input.cost !== undefined ? Math.round(input.cost * 100) / 100 : 0;
  const stock = input.stock !== undefined ? Math.floor(input.stock) : 0;
  const isActive = input.isActive !== undefined ? Boolean(input.isActive) : true;

  const values = {
    name: input.name.trim(),
    sku,
    category_id: categoryId,
    price: Math.round(input.price * 100) / 100,
    cost,
    stock,
    is_active: isActive,
    is_archived: false,
  };

  const operation = input.id
    ? supabase.from("products").update(values).eq("id", input.id)
    : supabase.from("products").insert({ ...values, created_by: user.id });

  const { error } = await operation;

  if (error) {
    if (error.code === "23505" || /unique|duplicate/i.test(error.message)) {
      return { ok: false, message: "That SKU already exists." };
    }
    if (error.code === "42501" || /row-level security|not authorized/i.test(error.message)) {
      return { ok: false, message: "You are not authorized to manage products." };
    }
    return { ok: false, message: "Could not save product. Please try again." };
  }

  revalidateProductPaths();
  return { ok: true };
}

export async function deleteProduct(id: string): Promise<ProductActionResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, message: "Invalid product ID." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_archived: true, is_active: false })
    .eq("id", id);

  if (error) {
    if (error.code === "42501" || /row-level security|not authorized/i.test(error.message)) {
      return { ok: false, message: "You are not authorized to delete products." };
    }
    return { ok: false, message: "Could not delete product." };
  }

  revalidateProductPaths();
  return { ok: true };
}
