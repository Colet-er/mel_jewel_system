import { StatusOrdersView } from "@/components/orders/status-orders-view";

export const metadata = { title: "Branch Collect" };

/** COD orders with the Branch Collect status. Staff enter the claim code here. */
export default async function BranchCollectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <StatusOrdersView kind="branch_collect" searchParams={searchParams} />;
}
