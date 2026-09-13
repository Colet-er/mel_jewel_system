import { StatusOrdersView } from "@/components/orders/status-orders-view";

export const metadata = { title: "Cancelled Orders" };

export default function CancelledOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <StatusOrdersView kind="cancelled" searchParams={searchParams} />;
}
