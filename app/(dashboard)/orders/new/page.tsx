import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { NewOrderForm } from "@/components/orders/new-order-form";

export const metadata = { title: "New Order" };

export default async function NewOrderPage() {
  const supabase = await createClient();

  const [customersResult, productsResult] = await Promise.all([
    supabase.from("customers").select("id, name").order("name"),
    supabase.from("products").select("id, name, price").eq("is_active", true).order("name"),
  ]);

  const customersError = describeDbError(customersResult.error);
  if (!customersResult.data || !productsResult.data) {
    return (
      <div className="space-y-6">
        <PageHeader title="New Order" description="Create an order for a customer." />
        <ErrorState title={customersError.title} description={customersError.description} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Order"
        description="Pick a customer, add products, and review the total."
        actions={
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-pink-light">
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Foundation preview
          </span>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Order details</CardTitle>
          <CardDescription>
            Submitting is disabled until order workflows are finalized in an upcoming phase.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewOrderForm
            customers={customersResult.data}
            products={productsResult.data.map((product) => ({
              ...product,
              price: Number(product.price),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
