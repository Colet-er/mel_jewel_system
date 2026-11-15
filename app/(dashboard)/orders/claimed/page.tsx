import { notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { isDeveloperEmail } from "@/lib/auth/developer";
import { StatusOrdersView } from "@/components/orders/status-orders-view";

export const metadata = { title: "Claimed Orders" };

/** Claimed orders are visible to the owner (and the developer account) only. */
export default async function ClaimedOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, profile } = await getCurrentProfile();
  const canView =
    profile?.role === "owner" || profile?.role === "developer" || isDeveloperEmail(user.email);
  if (!canView) notFound();

  return <StatusOrdersView kind="claimed" searchParams={searchParams} />;
}
