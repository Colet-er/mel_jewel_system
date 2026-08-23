import type { ReactNode } from "react";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, profile } = await getCurrentProfile();

  return (
    <DashboardShell email={user.email ?? ""} fullName={profile.full_name} role={profile.role}>
      {children}
    </DashboardShell>
  );
}
