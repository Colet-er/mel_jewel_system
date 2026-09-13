import Link from "next/link";
import { BarChart3, FileText } from "lucide-react";
import { computeTotals, describeDbError, fetchOrders } from "@/lib/supabase/queries";
import { formatCurrency, monthName } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { StatCard } from "@/components/ui/stat-card";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  let dbError: { title: string; description: string } | null = null;
  let totals = { orderCount: 0, itemsSold: 0, revenue: 0, profit: 0 };

  try {
    const orders = await fetchOrders({ month, year });
    totals = computeTotals(orders);
  } catch (error) {
    dbError = describeDbError(error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Business performance at a glance."
      />

      {dbError ? (
        <ErrorState title={dbError.title} description={dbError.description} />
      ) : (
        <>
          <section aria-label={`Summary for ${monthName(month)} ${year}`}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="Items Sold"
                value={totals.itemsSold.toLocaleString("en-US")}
                hint={`${monthName(month)} ${year}`}
                icon={<BarChart3 className="h-5 w-5" aria-hidden />}
              />
              <StatCard
                label="Revenue"
                value={formatCurrency(totals.revenue)}
                valueClassName="text-pink-light"
                hint={`${monthName(month)} ${year}`}
                icon={<BarChart3 className="h-5 w-5" aria-hidden />}
              />
              <StatCard
                label="Profit"
                value={formatCurrency(totals.profit)}
                hint={`${monthName(month)} ${year}`}
                icon={<FileText className="h-5 w-5" aria-hidden />}
              />
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Detailed reports</CardTitle>
              <CardDescription>
                Breakdowns by product, category, and customer are planned for an upcoming phase. For
                now you can filter and export the sold-orders data from the{" "}
                <Link href="/dashboard" className="text-pink-light hover:underline">
                  dashboard
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted">
                This page shows a live summary of the current month using real order data.
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
