import { OrdersView } from "@/components/orders/orders-view";

export const metadata = { title: "All Orders" };

export default function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <OrdersView
      title="All Orders"
      description="Every order across all statuses."
      emptyTitle="No orders yet"
      emptyDescription="Orders you create will show up here."
      searchParams={searchParams}
    />
  );
}
