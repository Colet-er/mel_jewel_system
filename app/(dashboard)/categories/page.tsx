import { Tags } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

export const metadata = { title: "Categories" };

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  product_count: number;
}

const COLUMNS: Column<CategoryRow>[] = [
  {
    key: "name",
    header: "Category",
    render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
  },
  {
    key: "description",
    header: "Description",
    render: (row) => row.description ?? <span className="text-muted">—</span>,
  },
  {
    key: "product_count",
    header: "Products",
    render: (row) => row.product_count.toLocaleString("en-US"),
    className: "text-right",
  },
];

export default async function CategoriesPage() {
  let categories: CategoryRow[] | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, description, products(count)")
      .order("name");

    if (error) throw new Error(error.message);
    categories = (data ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      product_count: category.products?.[0]?.count ?? 0,
    }));
  } catch (error) {
    dbError = describeDbError(error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description="Group products for easier browsing and reporting."
        actions={
          <Button disabled title="Category creation is coming soon">
            Add Category
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All categories</CardTitle>
          <CardDescription>Categories and how many products they contain.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {dbError ? (
            <div className="px-5 pb-5">
              <ErrorState title={dbError.title} description={dbError.description} />
            </div>
          ) : (
            <DataTable
              columns={COLUMNS}
              rows={categories ?? []}
              rowKey={(row) => row.id}
              empty={
                <EmptyState
                  icon={<Tags className="h-8 w-8" aria-hidden />}
                  title="No categories yet"
                  description="Create categories to organize your products."
                />
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
