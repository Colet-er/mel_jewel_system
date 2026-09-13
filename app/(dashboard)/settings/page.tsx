import { getCurrentProfile } from "@/lib/supabase/auth";
import { formatDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleBadge } from "@/components/ui/status-badge";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user, profile } = await getCurrentProfile();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your account and workspace preferences." />

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Your sign-in details and role.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Full name</dt>
              <dd className="mt-1 text-sm text-foreground">{profile?.full_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Email</dt>
              <dd className="mt-1 text-sm text-foreground">{user.email}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Role</dt>
              <dd className="mt-1">
                <RoleBadge role={profile?.role ?? "unknown"} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted">Member since</dt>
              <dd className="mt-1 text-sm text-foreground">
                {profile?.created_at ? formatDate(profile.created_at) : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
          <CardDescription>Store details, taxes, and team management.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-pink-light">
            Workspace settings are planned for an upcoming phase.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
