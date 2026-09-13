import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types";
import { createClient } from "./server";

/** Never let a slow Supabase call block rendering the dashboard shell. */
const PROFILE_TIMEOUT_MS = 10_000;

/**
 * Resolves the signed-in user without redirecting. Returns null when there
 * is no session so callers can render an unauthorized state instead of
 * bouncing between /login and /dashboard.
 */
export async function getUserOrNull(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user ?? null;
}

export async function getAuthenticatedUser(): Promise<User> {
  const user = await getUserOrNull();

  if (!user) {
    redirect("/login");
  }

  return user;
}

export interface CurrentProfileResult {
  user: User;
  profile: Profile | null;
}

/**
 * Loads the profile row for the current user. A missing or unreadable
 * profile is NOT an auth failure, so it must never redirect to /login:
 * the proxy would immediately bounce an authenticated user back here,
 * creating an infinite redirect loop. Instead the profile is returned as
 * null and callers render a safe fallback.
 */
export async function getCurrentProfile(): Promise<CurrentProfileResult> {
  const user = await getAuthenticatedUser();
  const supabase = await createClient();

  // maybeSingle() returns null for zero rows instead of throwing PGRST116.
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .abortSignal(AbortSignal.timeout(PROFILE_TIMEOUT_MS))
    .maybeSingle();

  if (error) {
    console.error("Failed to load profile:", error.message);
    return { user, profile: null };
  }

  return { user, profile: (profile as Profile) ?? null };
}
