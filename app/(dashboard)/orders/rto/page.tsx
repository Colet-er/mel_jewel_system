import { StatusOrdersView } from "@/components/orders/status-orders-view";

export const metadata = { title: "RTO Orders" };

export default function RtoOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <StatusOrdersView kind="rto" searchParams={searchParams} />;
}