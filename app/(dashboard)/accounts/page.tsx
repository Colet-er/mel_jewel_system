import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isDeveloperEmail } from "@/lib/auth/developer";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import {
  AccountManager,
  type ManagedAccount,
  type ActivityLogItem,
} from "@/components/accounts/account-manager";

export const metadata = { title: "Developer Portal - Account Management" };

export default async function AccountsPage() {
  const { user, profile } = await getCurrentProfile();
  const isDev = isDeveloperEmail(user.email);
  if (!isDev) {
    notFound();
  }

  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  let accounts: ManagedAccount[] = [];
  let activityLogs: ActivityLogItem[] = [];

  if (hasServiceRoleKey) {
    try {
      const admin = createAdminClient();
      const [
        { data: usersData, error: usersError },
        { data: profiles, error: profilesError },
        { data: historyData, error: historyError },
      ] = await Promise.all([
        admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        admin.from("profiles").select("id, email, full_name, role, created_at"),
        admin
          .from("order_status_history")
          .select(`
            id,
            order_id,
            from_status,
            to_status,
            notes,
            created_at,
            changed_by,
            orders (
              order_number,
              customer:customers (
                name
              )
            )
          `)
          .order("created_at", { ascending: false })
          .limit(300),
      ]);

      if (usersError) console.error("Error fetching auth users:", usersError.message);
      if (profilesError) console.error("Error fetching profiles:", profilesError.message);
      if (historyError) console.error("Error fetching history:", historyError.message);

      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

      accounts = (usersData?.users ?? []).map((account) => {
        const p = profileById.get(account.id);
        return {
          id: account.id,
          email: account.email ?? p?.email ?? "No email",
          fullName: p?.full_name ?? (account.user_metadata?.full_name as string | undefined) ?? null,
          role: (p?.role ?? "viewer") as ManagedAccount["role"],
          createdAt: formatDate(p?.created_at ?? account.created_at),
          confirmedAt: account.email_confirmed_at ? formatDate(account.email_confirmed_at) : "Pending",
          lastSignInAt: account.last_sign_in_at ? formatDate(account.last_sign_in_at) : "Never",
        };
      });

      activityLogs = (historyData ?? []).map((item) => {
        const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
        const customer = order?.customer
          ? Array.isArray(order.customer)
            ? order.customer[0]
            : order.customer
          : null;
        const changer = item.changed_by ? profileById.get(item.changed_by) : null;

        return {
          id: item.id,
          orderId: item.order_id,
          orderCode: order?.order_number ?? item.order_id.slice(0, 8),
          customerName: customer?.name ?? null,
          fromStatus: item.from_status,
          toStatus: item.to_status,
          notes: item.notes,
          createdAt: formatDateTime(item.created_at),
          rawCreatedAt: item.created_at,
          changedBy: changer
            ? {
                id: changer.id,
                fullName: changer.full_name,
                email: changer.email,
                role: changer.role,
              }
            : null,
        };
      });
    } catch (err) {
      console.error("Admin client load error:", err);
    }
  }

  // Fallback if service role key is not configured or admin query returned empty
  if (accounts.length === 0) {
    try {
      const supabase = await createClient();
      const [
        { data: profiles, error: profilesError },
        { data: historyData, error: historyError },
      ] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, role, created_at"),
        supabase
          .from("order_status_history")
          .select(`
            id,
            order_id,
            from_status,
            to_status,
            notes,
            created_at,
            changed_by,
            orders (
              order_number,
              customer:customers (
                name
              )
            )
          `)
          .order("created_at", { ascending: false })
          .limit(300),
      ]);

      if (profilesError) console.error("Fallback profiles error:", profilesError.message);
      if (historyError) console.error("Fallback history error:", historyError.message);

      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

      accounts = (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email ?? "No email",
        fullName: p.full_name ?? null,
        role: (p.role ?? "viewer") as ManagedAccount["role"],
        createdAt: formatDate(p.created_at),
        confirmedAt: "Active",
        lastSignInAt: "—",
      }));

      activityLogs = (historyData ?? []).map((item) => {
        const order = Array.isArray(item.orders) ? item.orders[0] : item.orders;
        const customer = order?.customer
          ? Array.isArray(order.customer)
            ? order.customer[0]
            : order.customer
          : null;
        const changer = item.changed_by ? profileById.get(item.changed_by) : null;

        return {
          id: item.id,
          orderId: item.order_id,
          orderCode: order?.order_number ?? item.order_id.slice(0, 8),
          customerName: customer?.name ?? null,
          fromStatus: item.from_status,
          toStatus: item.to_status,
          notes: item.notes,
          createdAt: formatDateTime(item.created_at),
          rawCreatedAt: item.created_at,
          changedBy: changer
            ? {
                id: changer.id,
                fullName: changer.full_name,
                email: changer.email,
                role: changer.role,
              }
            : null,
        };
      });
    } catch (err) {
      console.error("Fallback client load error:", err);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="DEVELOPER PORTAL"
        description="Developer-only workspace to manage system user credentials, roles, and audit activity logs."
      />

      <AccountManager
        accounts={accounts}
        activityLogs={activityLogs}
        currentUserId={user.id}
        currentUserRole={profile?.role ?? "viewer"}
        isDeveloper={isDev}
        serviceRoleConfigured={hasServiceRoleKey}
      />
    </div>
  );
}
