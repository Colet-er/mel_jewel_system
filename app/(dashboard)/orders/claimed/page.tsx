import { StatusOrdersView } from "@/components/orders/status-orders-view";

export const metadata = { title: "Claimed Orders" };

export default function ClaimedOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <StatusOrdersView kind="claimed" searchParams={searchParams} />;
}