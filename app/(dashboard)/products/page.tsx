import { Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ExportButton } from "@/components/filters/export-button";
import { SearchInput } from "@/components/filters/search-input";

export const metadata = { title: "Products" };

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  is_active: boolean;
  category?: { name: string } | null;
}

const COLUMNS: Column<ProductRow>[] = [
  {
    key: "name",
    header: "Product",
    render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
  },
  {
    key: "sku",
    header: "SKU",
    render: (row) => row.sku ?? <span className="text-muted">—</span>,
  },
  {
    key: "category",
    header: "Category",
    render: (row) => row.category?.name ?? <span className="text-muted">Uncategorized</span>,
  },
  {
    key: "price",
    header: "Price",
    render: (row) => <span className="text-pink-light">{formatCurrency(row.price)}</span>,
    className: "text-right",
  },
  {
    key: "stock",
    header: "Stock",
    render: (row) => row.stock.toLocaleString("en-US"),
    className: "text-right",
  },
  {
    key: "is_active",
    header: "Status",
    render: (row) =>
      row.is_active ? (
        <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
          Active
        </span>
      ) : (
        <span className="inline-flex items-center rounded-full border border-white/10 bg-elevated/60 px-2.5 py-0.5 text-xs font-medium text-muted">
          Archived
        </span>
      ),
  },
];

const CSV_HEADERS = ["Product", "SKU", "Category", "Price", "Stock", "Status"];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  let products: ProductRow[] | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    const supabase = await createClient();
    let query = supabase
      .from("products")
      .select("id, name, sku, price, stock, is_active, category:categories(name)")
      .order("created_at", { ascending: false });

    if (q) {
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    products = (data ?? []).map((product) => ({
      ...product,
      price: Number(product.price),
      category: Array.isArray(product.category) ? product.category[0] ?? null : product.category,
    }));
  } catch (error) {
    dbError = describeDbError(error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Your product catalog."
        actions={
          <>
            <SearchInput placeholder="Search products…" />
            <ExportButton
              filename="products.csv"
              headers={CSV_HEADERS}
              rows={(products ?? []).map((product) => [
                product.name,
                product.sku ?? "",
                product.category?.name ?? "",
                product.price,
                product.stock,
                product.is_active ? "Active" : "Archived",
              ])}
            />
            <Button disabled title="Product creation is coming soon">
              Add Product
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>{q ? `Filtered by “${q}”.` : "All products on file."}</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {dbError ? (
            <div className="px-5 pb-5">
              <ErrorState title={dbError.title} description={dbError.description} />
            </div>
          ) : (
            <DataTable
              columns={COLUMNS}
              rows={products ?? []}
              rowKey={(row) => row.id}
              empty={
                <EmptyState
                  icon={<Package className="h-8 w-8" aria-hidden />}
                  title={q ? "No matching products" : "No products yet"}
                  description={
                    q ? "Try a different search term." : "Products added to the catalog will appear here."
                  }
                />
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
