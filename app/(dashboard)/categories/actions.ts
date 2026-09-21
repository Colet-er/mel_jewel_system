"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateCategoryInput, type CategoryInput } from "@/lib/utils/category-validation";

export interface CategoryActionResult {
  ok: boolean;
  message?: string;
}

function revalidateCategoryPaths() {
  revalidatePath("/categories");
  revalidatePath("/products");
  revalidatePath("/products/categories");
  revalidatePath("/moissanite/sku");
  revalidatePath("/orders/new");
  revalidatePath("/orders/reserved");
  revalidatePath("/dashboard");
}

export async function saveCategory(input: CategoryInput): Promise<CategoryActionResult> {
  const errorMsg = validateCategoryInput(input);
  if (errorMsg) return { ok: false, message: errorMsg };

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Your session expired. Sign in and try again." };
  }

  const name = input.name.trim();
  const description = input.description?.trim() || null;

  // Check duplicate name
  const existingQuery = supabase
    .from("categories")
    .select("id, name")
    .ilike("name", name);

  const { data: existing } = await existingQuery;
  if (existing && existing.length > 0) {
    const isDifferentCategory = !input.id || existing.some((c) => c.id !== input.id);
    if (isDifferentCategory) {
      return { ok: false, message: "A category with that name already exists." };
    }
  }

  const values = {
    name,
    description,
  };

  const operation = input.id
    ? supabase.from("categories").update(values).eq("id", input.id)
    : supabase.from("categories").insert(values);

  const { error } = await operation;

  if (error) {
    if (error.code === "23505" || /unique|duplicate/i.test(error.message)) {
      return { ok: false, message: "A category with that name already exists." };
    }
    if (error.code === "42501" || /row-level security|not authorized/i.test(error.message)) {
      return { ok: false, message: "You are not authorized to manage categories." };
    }
    return { ok: false, message: "Could not save category. Please try again." };
  }

  revalidateCategoryPaths();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<CategoryActionResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, message: "Invalid category ID." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("categories").delete().eq("id", id);

  if (error) {
    if (error.code === "23503" || /foreign key|violates foreign key/i.test(error.message)) {
      return {
        ok: false,
        message: "Cannot delete this category because products or inventory items are currently assigned to it.",
      };
    }
    if (error.code === "42501" || /row-level security|not authorized/i.test(error.message)) {
      return { ok: false, message: "You are not authorized to delete categories." };
    }
    return { ok: false, message: "Could not delete category." };
  }

  revalidateCategoryPaths();
  return { ok: true };
}
