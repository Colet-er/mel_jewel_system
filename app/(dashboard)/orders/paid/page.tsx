import { StatusOrdersView } from "@/components/orders/status-orders-view";

export const metadata = { title: "Paid Orders" };

export default function PaidOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <StatusOrdersView kind="paid" searchParams={searchParams} />;
}
