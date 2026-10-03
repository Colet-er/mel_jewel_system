"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateCustomerInput, type CustomerInput } from "@/lib/utils/customer-validation";

export interface CustomerActionResult {
  ok: boolean;
  message?: string;
}

function revalidateCustomerPaths() {
  revalidatePath("/customers");
  revalidatePath("/orders/reserved");
  revalidatePath("/orders/paid");
  revalidatePath("/orders/shipped");
  revalidatePath("/orders/claimed");
  revalidatePath("/orders/cancelled");
  revalidatePath("/orders/rto");
  revalidatePath("/dashboard");
}

export async function saveCustomer(input: CustomerInput): Promise<CustomerActionResult> {
  const errorMsg = validateCustomerInput(input);
  if (errorMsg) return { ok: false, message: errorMsg };

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "Your session expired. Sign in and try again." };
  }

  const values = {
    name: input.name.trim(),
    fb_name: input.fbName?.trim() || null,
    address: input.address?.trim() || null,
    phone: input.phone?.trim() || null,
    notes: input.notes?.trim() || null,
    is_archived: false,
    updated_at: new Date().toISOString(),
  };

  const operation = input.id
    ? supabase.from("customers").update(values).eq("id", input.id)
    : supabase.from("customers").insert({ ...values, created_by: user.id });

  const { error } = await operation;

  if (error) {
    if (error.code === "42501" || /row-level security|not authorized/i.test(error.message)) {
      return { ok: false, message: "You are not authorized to manage customers." };
    }
    return { ok: false, message: "Could not save customer. Please try again." };
  }

  revalidateCustomerPaths();
  return {
    ok: true,
    message: input.id
      ? "Customer changes successfully saved."
      : "Customer successfully added.",
  };
}

export async function deleteCustomer(id: string): Promise<CustomerActionResult> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return { ok: false, message: "Invalid customer ID." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ is_archived: true })
    .eq("id", id);

  if (error) {
    if (error.code === "42501" || /row-level security|not authorized/i.test(error.message)) {
      return { ok: false, message: "You are not authorized to delete customers." };
    }
    return { ok: false, message: "Could not delete customer." };
  }

  revalidateCustomerPaths();
  return { ok: true, message: "Customer successfully deleted." };
}

export async function deleteMultipleCustomers(ids: string[]): Promise<CustomerActionResult> {
  const validIds = ids.filter((id) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
  if (validIds.length === 0) {
    return { ok: false, message: "No valid customer IDs provided." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({ is_archived: true })
    .in("id", validIds);

  if (error) {
    if (error.code === "42501" || /row-level security|not authorized/i.test(error.message)) {
      return { ok: false, message: "You are not authorized to delete customers." };
    }
    return { ok: false, message: "Could not delete selected customers." };
  }

  revalidateCustomerPaths();
  return {
    ok: true,
    message: `Successfully deleted ${validIds.length} customer${validIds.length === 1 ? "" : "s"}.`,
  };
}
