import { StatusOrdersView } from "@/components/orders/status-orders-view";

export const metadata = { title: "Booking" };

/** Orders booked with a courier: add the tracking no., then Mark as Shipped. */
export default function BookingOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <StatusOrdersView kind="booked" searchParams={searchParams} />;
}
