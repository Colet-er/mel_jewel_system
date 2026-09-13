import { StatusOrdersView } from "@/components/orders/status-orders-view";

export const metadata = { title: "Shipped Orders" };

export default function ShippedOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <StatusOrdersView kind="shipped" searchParams={searchParams} />;
}
