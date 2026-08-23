import Link from "next/link";
import {
  BadgeCheck,
  Clock,
  FileText,
  Package,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/supabase/auth";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

const MODULE_LINKS = [
  { href: "/orders", label: "Orders", description: "Track and manage all orders", icon: ShoppingCart },
  { href: "/customers", label: "Customers", description: "Customer directory and history", icon: Users },
  { href: "/products", label: "Products", description: "Product catalog and categories", icon: Package },
  { href: "/reports", label: "Reports", description: "Sales and performance insights", icon: TrendingUp },
];

export default async function DashboardPage() {
  const { profile } = await getCurrentProfile();
  const firstName = profile.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Here is an overview of your business."
      />

      {/* Summary cards — populated with live order metrics in Phase 3 */}
      <section aria-label="Order summary">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Total Orders" value="—" icon={ShoppingCart} />
          <SummaryCard label="Reserved" value="—" icon={Clock} />
          <SummaryCard label="Paid" value="—" icon={BadgeCheck} />
          <SummaryCard label="Shipped" value="—" icon={Truck} />
          <SummaryCard label="Cancelled" value="—" icon={FileText} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest activity across your store.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No orders yet"
              description="Once orders are created, the most recent ones will appear here."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Financial Summary</CardTitle>
            <CardDescription>Revenue, payments, and outstanding balances.</CardDescription>
          </CardHeader>
          <CardContent>
            <EmptyState
              title="No financial data yet"
              description="Financial metrics will appear after orders and payments are recorded."
            />
          </CardContent>
        </Card>
      </div>

      <section aria-label="Modules">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Modules</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MODULE_LINKS.map(({ href, label, description, icon: Icon }) => (
            <Link key={href} href={href} className="group">
              <Card className="h-full transition-colors group-hover:border-primary/50">
                <CardContent className="pt-5">
                  <Icon className="h-5 w-5 text-primary" aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-foreground">{label}</p>
                  <p className="mt-1 text-xs text-muted">{description}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden": boolean }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-muted" aria-hidden />
      </CardContent>
    </Card>
  );
}
