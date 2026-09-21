import { Layers, Package, ShoppingBag, Tags } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ExportButton } from "@/components/filters/export-button";
import { SearchInput } from "@/components/filters/search-input";
import {
  AddProductButton,
  ProductRowActions,
  type ProductCategory,
} from "@/components/products/product-actions";

export const metadata = { title: "Products" };

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  cost: number;
  stock: number;
  is_active: boolean;
  category_id: string | null;
  category?: { name: string } | null;
}

function itemActions(row: ProductRow, categories: ProductCategory[]) {
  return (
    <ProductRowActions
      categories={categories}
      item={{
        id: row.id,
        name: row.name,
        sku: row.sku,
        categoryId: row.category_id,
        price: row.price,
        cost: row.cost,
        stock: row.stock,
        isActive: row.is_active,
      }}
    />
  );
}

function columns(categories: ProductCategory[]): Column<ProductRow>[] {
  return [
    {
      key: "name",
      header: "Product",
      render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
    },
    {
      key: "sku",
      header: "SKU",
      render: (row) =>
        row.sku ? (
          <span className="font-mono text-xs font-semibold text-pink-light">{row.sku}</span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: "category",
      header: "Category",
      render: (row) =>
        row.category?.name ? (
          <span className="inline-flex rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs text-muted">
            {row.category.name}
          </span>
        ) : (
          <span className="text-muted">Uncategorized</span>
        ),
    },
    {
      key: "price",
      header: "Price",
      render: (row) => <span className="font-semibold text-pink-light">{formatCurrency(row.price)}</span>,
      className: "text-right",
    },
    {
      key: "stock",
      header: "Stock",
      render: (row) => (
        <span className={row.stock <= 0 ? "text-danger" : "text-foreground"}>
          {row.stock.toLocaleString("en-US")}
        </span>
      ),
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
    {
      key: "actions",
      header: "Manage",
      render: (row) => itemActions(row, categories),
    },
  ];
}

const CSV_HEADERS = ["Product", "SKU", "Category", "Price", "Cost", "Stock", "Status"];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  let products: ProductRow[] | null = null;
  let categories: ProductCategory[] = [];
  let dbError: { title: string; description: string } | null = null;

  try {
    const supabase = await createClient();

    let query = supabase
      .from("products")
      .select("id, name, sku, price, cost, stock, is_active, category_id, category:categories(name)")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    if (q) {
      query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
    }

    const [productsResult, categoriesResult] = await Promise.all([
      query,
      supabase.from("categories").select("id, name").order("name"),
    ]);

    if (productsResult.error) throw new Error(productsResult.error.message);

    products = (productsResult.data ?? []).map((product) => ({
      ...product,
      price: Number(product.price),
      cost: Number(product.cost ?? 0),
      stock: Number(product.stock ?? 0),
      category: Array.isArray(product.category) ? product.category[0] ?? null : product.category,
    }));

    if (!categoriesResult.error && categoriesResult.data) {
      categories = categoriesResult.data.map((c) => ({ id: c.id, name: c.name }));
    }
  } catch (error) {
    dbError = describeDbError(error);
  }

  const rows = products ?? [];
  const activeProducts = rows.filter((r) => r.is_active);
  const totalStock = rows.reduce((sum, r) => sum + r.stock, 0);
  const categoryCount = new Set(rows.map((r) => r.category?.name).filter(Boolean)).size;

  const csvRows = rows.map((product) => [
    product.name,
    product.sku ?? "",
    product.category?.name ?? "",
    product.price,
    product.cost,
    product.stock,
    product.is_active ? "Active" : "Archived",
  ]);

  const empty = (
    <EmptyState
      icon={<Package className="h-8 w-8" aria-hidden />}
      title={q ? "No matching products" : "No products yet"}
      description={
        q ? "Try a different search term." : "Add your first product to start building your catalog."
      }
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="PRODUCTS"
        description="Manage your jewelry and accessories product catalog."
        actions={
          <>
            <SearchInput placeholder="Search products or SKU…" />
            <ExportButton filename="products.csv" headers={CSV_HEADERS} rows={csvRows} />
            <AddProductButton categories={categories} />
          </>
        }
      />

      {!dbError ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 to-card px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-pink-light">
                <ShoppingBag className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-semibold text-foreground">{rows.length}</p>
                <p className="text-xs text-muted">Total products</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-card px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                <Package className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-semibold text-foreground">{activeProducts.length}</p>
                <p className="text-xs text-muted">Active in catalog</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-card px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-muted">
                <Tags className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-semibold text-foreground">{categoryCount}</p>
                <p className="text-xs text-muted">Categories used</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-card px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-pink-light">
                <Layers className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-semibold text-foreground">{totalStock.toLocaleString("en-US")}</p>
                <p className="text-xs text-muted">Units in stock</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Catalog</CardTitle>
          <CardDescription>{q ? `Filtered by “${q}”.` : "All products in your inventory."}</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {dbError ? (
            <div className="px-5 pb-5">
              <ErrorState title={dbError.title} description={dbError.description} />
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <DataTable
                  columns={columns(categories)}
                  rows={rows}
                  rowKey={(row) => row.id}
                  empty={empty}
                />
              </div>
              <div className="divide-y divide-white/[0.07] md:hidden">
                {rows.length === 0 ? (
                  empty
                ) : (
                  rows.map((row) => (
                    <article key={row.id} className="space-y-4 px-5 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          {row.sku ? (
                            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-pink-light">
                              {row.sku}
                            </p>
                          ) : null}
                          <h3 className="mt-1 text-sm font-semibold leading-5 text-foreground">
                            {row.name}
                          </h3>
                        </div>
                        <p className="shrink-0 text-sm font-semibold text-pink-light">
                          {formatCurrency(row.price)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-muted">
                          {row.category?.name || "Uncategorized"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-muted">
                          Stock: {row.stock}
                        </span>
                        {row.is_active ? (
                          <span className="rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-success">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/10 bg-elevated/60 px-2.5 py-1 text-muted">
                            Archived
                          </span>
                        )}
                      </div>
                      {itemActions(row, categories)}
                    </article>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
