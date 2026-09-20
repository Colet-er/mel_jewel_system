"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDeveloperEmail } from "@/lib/auth/developer";
import type { UserRole } from "@/types";

const roleSchema = z.enum(["owner", "admin", "staff", "viewer"]);
const accountIdSchema = z.string().uuid();

export interface AccountActionResult {
  success: boolean;
  error?: string;
}

async function requireDeveloper() {
  const { user, profile } = await getCurrentProfile();
  const isDev = isDeveloperEmail(user.email);
  if (!isDev) {
    throw new Error("Developer portal access is required.");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured in .env.local. Please add your Supabase service role secret key."
    );
  }
  return { user, profile, isDev, admin: createAdminClient() };
}

export async function createAccount(input: {
  email: string;
  fullName: string;
  password: string;
  role: UserRole;
}): Promise<AccountActionResult> {
  const parsed = z
    .object({
      email: z.string().trim().email(),
      fullName: z.string().trim().min(1, "Full name is required.").max(120),
      password: z.string().min(8, "Password must be at least 8 characters.").max(128),
      role: roleSchema,
    })
    .safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid account details.",
    };
  }

  try {
    const { admin } = await requireDeveloper();
    const { data, error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.fullName },
    });
    if (error) return { success: false, error: error.message };

    const { error: profileError } = await admin
      .from("profiles")
      .update({ full_name: parsed.data.fullName, role: parsed.data.role })
      .eq("id", data.user.id);

    if (profileError) {
      await admin.auth.admin.deleteUser(data.user.id);
      return { success: false, error: profileError.message };
    }

    revalidatePath("/accounts");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Account creation failed.",
    };
  }
}

export async function updateAccountRole(
  accountId: string,
  role: UserRole
): Promise<AccountActionResult> {
  const parsedId = accountIdSchema.safeParse(accountId);
  const parsedRole = roleSchema.safeParse(role);
  if (!parsedId.success || !parsedRole.success) {
    return { success: false, error: "Invalid account or role." };
  }

  try {
    const { isDev, admin } = await requireDeveloper();
    const { data: existing, error: lookupError } = await admin.auth.admin.getUserById(
      parsedId.data
    );
    if (lookupError) return { success: false, error: lookupError.message };

    if (isDeveloperEmail(existing.user.email) && !isDev) {
      return {
        success: false,
        error: "Developer accounts can only be modified by developer admins.",
      };
    }

    const { error } = await admin
      .from("profiles")
      .update({ role: parsedRole.data })
      .eq("id", parsedId.data);
    if (error) return { success: false, error: error.message };
    revalidatePath("/accounts");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Role update failed.",
    };
  }
}

export async function updateAccountCredentials(input: {
  accountId: string;
  email: string;
  fullName: string;
  password?: string;
  role?: UserRole;
}): Promise<AccountActionResult> {
  const parsed = z
    .object({
      accountId: accountIdSchema,
      email: z.string().trim().email(),
      fullName: z.string().trim().min(1, "Full name is required.").max(120),
      password: z
        .string()
        .min(8, "Password must be at least 8 characters.")
        .max(128)
        .optional()
        .or(z.literal("")),
      role: roleSchema.optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid credentials.",
    };
  }

  try {
    const { isDev, admin } = await requireDeveloper();
    const { data: existing, error: lookupError } = await admin.auth.admin.getUserById(
      parsed.data.accountId
    );
    if (lookupError) return { success: false, error: lookupError.message };

    const oldEmail = existing.user.email ?? "";
    const oldFullName =
      typeof existing.user.user_metadata?.full_name === "string"
        ? existing.user.user_metadata.full_name
        : "";

    if (isDeveloperEmail(oldEmail) && !isDev) {
      return {
        success: false,
        error: "Developer accounts can only be edited by developer admins.",
      };
    }

    if (isDeveloperEmail(oldEmail) && !isDeveloperEmail(parsed.data.email)) {
      return {
        success: false,
        error: "Add the new email to DEVELOPER_EMAILS before changing a developer account.",
      };
    }

    const authUpdates: {
      email: string;
      email_confirm: boolean;
      user_metadata: Record<string, unknown>;
      password?: string;
    } = {
      email: parsed.data.email,
      email_confirm: true,
      user_metadata: { ...existing.user.user_metadata, full_name: parsed.data.fullName },
    };

    if (parsed.data.password && parsed.data.password.trim().length >= 8) {
      authUpdates.password = parsed.data.password.trim();
    }

    const { error: authError } = await admin.auth.admin.updateUserById(
      parsed.data.accountId,
      authUpdates
    );
    if (authError) return { success: false, error: authError.message };

    const profileUpdates: { email: string; full_name: string; role?: UserRole } = {
      email: parsed.data.email,
      full_name: parsed.data.fullName,
    };
    if (parsed.data.role) {
      profileUpdates.role = parsed.data.role;
    }

    const { error: profileError } = await admin
      .from("profiles")
      .update(profileUpdates)
      .eq("id", parsed.data.accountId);

    if (profileError) {
      await admin.auth.admin.updateUserById(parsed.data.accountId, {
        email: oldEmail,
        email_confirm: true,
        user_metadata: { ...existing.user.user_metadata, full_name: oldFullName },
      });
      return { success: false, error: profileError.message };
    }

    revalidatePath("/accounts");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Credential update failed.",
    };
  }
}

export async function resetAccountPassword(
  accountId: string,
  password: string
): Promise<AccountActionResult> {
  const parsed = z
    .object({
      accountId: accountIdSchema,
      password: z.string().min(8, "Password must be at least 8 characters.").max(128),
    })
    .safeParse({ accountId, password });
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid password.",
    };
  }

  try {
    const { isDev, admin } = await requireDeveloper();
    const { data: existing, error: lookupError } = await admin.auth.admin.getUserById(
      parsed.data.accountId
    );
    if (lookupError) return { success: false, error: lookupError.message };

    if (isDeveloperEmail(existing.user.email) && !isDev) {
      return {
        success: false,
        error: "Developer account passwords can only be reset by developers.",
      };
    }

    const { error } = await admin.auth.admin.updateUserById(parsed.data.accountId, {
      password: parsed.data.password,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Password reset failed.",
    };
  }
}

export async function deleteAccount(accountId: string): Promise<AccountActionResult> {
  const parsedId = accountIdSchema.safeParse(accountId);
  if (!parsedId.success) return { success: false, error: "Invalid account." };

  try {
    const { user, isDev, admin } = await requireDeveloper();
    if (user.id === parsedId.data) {
      return { success: false, error: "You cannot delete your own signed-in account." };
    }

    const { data, error: lookupError } = await admin.auth.admin.getUserById(parsedId.data);
    if (lookupError) return { success: false, error: lookupError.message };
    if (isDeveloperEmail(data.user.email) && !isDev) {
      return { success: false, error: "Developer accounts cannot be deleted here." };
    }

    const { error } = await admin.auth.admin.deleteUser(parsedId.data);
    if (error) return { success: false, error: error.message };
    revalidatePath("/accounts");
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Account deletion failed.",
    };
  }
}
