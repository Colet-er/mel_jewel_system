import type { ReactNode } from "react";
import { getUserOrNull } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { UnauthorizedState } from "@/components/ui/unauthorized-state";

export const dynamic = "force-dynamic";

/**
 * The layout must always render the shell. Auth is enforced by the proxy, so
 * a missing session here renders an explicit unauthorized state instead of
 * redirecting (which could loop with the proxy). A missing or unreadable
 * profile row falls back to the auth user's metadata — never a redirect,
 * hang, or blank page.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getUserOrNull();

  if (!user) {
    return <UnauthorizedState />;
  }

  const supabase = await createClient();
  let profile: { full_name: string | null; role: string } | null = null;
  try {
    const result = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", user.id)
      .abortSignal(AbortSignal.timeout(10_000))
      .maybeSingle();
    profile = result.data;
  } catch (error) {
    console.error("Failed to load profile:", error);
  }

  const email = user.email ?? "";
  const fullName = profile?.full_name ?? user.user_metadata?.full_name ?? null;
  const role = profile?.role ?? user.user_metadata?.role ?? "unknown";

  return (
    <DashboardShell email={email} fullName={fullName} role={role}>
      {children}
    </DashboardShell>
  );
}
