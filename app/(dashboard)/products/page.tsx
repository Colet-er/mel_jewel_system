import { CheckCircle2, Gem, Layers, Package, ShoppingBag, Tags } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ExportButton } from "@/components/filters/export-button";
import { SearchInput } from "@/components/filters/search-input";
import {
  AddProductButton,
  ProductRowActions,
  type ProductCategory,
} from "@/components/products/product-actions";
import { ProductsTable } from "@/components/products/products-table";
import {
  ProductFilterTabs,
  type ProductSort,
  type ProductTab,
} from "@/components/products/product-filter-tabs";

export const metadata = { title: "Products & Moissanite Catalog" };

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  cost: number;
  is_active: boolean;
  category_id: string | null;
  category?: { name: string } | null;
  created_at?: string;
}

export function isMoissanite(product: {
  name: string;
  sku?: string | null;
  category?: { name: string } | null;
}): boolean {
  const cat = (product.category?.name ?? "").toLowerCase().trim();
  const sku = (product.sku ?? "").toUpperCase().trim();
  const name = product.name.toLowerCase().trim();
  return (
    cat === "moissanite" ||
    cat.includes("moissanite") ||
    sku.startsWith("MOISS") ||
    name.includes("moissanite")
  );
}

const CSV_HEADERS = ["Product", "SKU", "Type", "Category", "Price", "Cost", "Reservation Status"];

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const tab: ProductTab =
    params.tab === "moissanite" || params.tab === "non-moissanite" ? params.tab : "all";
  const sort: ProductSort =
    params.sort === "moissanite_first" ||
    params.sort === "non_moissanite_first" ||
    params.sort === "newest" ||
    params.sort === "name_asc" ||
    params.sort === "name_desc" ||
    params.sort === "price_asc" ||
    params.sort === "price_desc"
      ? (params.sort as ProductSort)
      : "moissanite_first";

  let products: ProductRow[] | null = null;
  let categories: ProductCategory[] = [];
  let dbError: { title: string; description: string } | null = null;

  try {
    const supabase = await createClient();

    let query = supabase
      .from("products")
      .select("id, name, sku, price, cost, is_active, category_id, created_at, category:categories(name)")
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
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: Number(product.price),
      cost: Number(product.cost ?? 0),
      is_active: Boolean(product.is_active),
      category_id: product.category_id,
      created_at: product.created_at,
      category: Array.isArray(product.category) ? product.category[0] ?? null : product.category,
    }));

    if (!categoriesResult.error && categoriesResult.data) {
      categories = categoriesResult.data.map((c) => ({ id: c.id, name: c.name }));
    }
  } catch (error) {
    dbError = describeDbError(error);
  }

  const allRows = products ?? [];

  // Compute counts
  const moissaniteCount = allRows.filter((r) => isMoissanite(r)).length;
  const nonMoissaniteCount = allRows.length - moissaniteCount;
  const activeProducts = allRows.filter((r) => r.is_active);

  // Filter by Tab
  let filteredRows = allRows;
  if (tab === "moissanite") {
    filteredRows = allRows.filter((r) => isMoissanite(r));
  } else if (tab === "non-moissanite") {
    filteredRows = allRows.filter((r) => !isMoissanite(r));
  }

  // Sort rows
  filteredRows.sort((a, b) => {
    switch (sort) {
      case "moissanite_first": {
        const aMoiss = isMoissanite(a);
        const bMoiss = isMoissanite(b);
        if (aMoiss && !bMoiss) return -1;
        if (!aMoiss && bMoiss) return 1;
        return a.name.localeCompare(b.name);
      }
      case "non_moissanite_first": {
        const aMoiss = isMoissanite(a);
        const bMoiss = isMoissanite(b);
        if (!aMoiss && bMoiss) return -1;
        if (aMoiss && !bMoiss) return 1;
        return a.name.localeCompare(b.name);
      }
      case "name_asc":
        return a.name.localeCompare(b.name);
      case "name_desc":
        return b.name.localeCompare(a.name);
      case "price_asc":
        return a.price - b.price;
      case "price_desc":
        return b.price - a.price;
      case "newest":
      default:
        return (b.created_at || "").localeCompare(a.created_at || "");
    }
  });

  const csvRows = filteredRows.map((product) => [
    product.name,
    product.sku ?? "",
    isMoissanite(product) ? "Moissanite" : "Product",
    product.category?.name ?? "Uncategorized",
    product.price,
    product.cost,
    product.is_active ? "Active" : "Archived",
  ]);

  const empty = (
    <EmptyState
      icon={
        tab === "moissanite" ? (
          <Gem className="h-8 w-8" aria-hidden />
        ) : (
          <Package className="h-8 w-8" aria-hidden />
        )
      }
      title={
        q
          ? "No matching products found"
          : tab === "moissanite"
          ? "No Moissanite items found"
          : tab === "non-moissanite"
          ? "No non-moissanite products found"
          : "No products in catalog yet"
      }
      description={
        q
          ? "Try a different search term or change the active tab."
          : tab === "moissanite"
          ? "Add your first Moissanite product to make it available for reservations."
          : "Add your first product to start building your catalog."
      }
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="PRODUCTS & MOISSANITE CATALOG"
        description="Manage your complete catalog of Moissanite stones, fine jewelry, and products."
        actions={
          <>
            <SearchInput placeholder="Search name or SKU…" />
            <ExportButton
              filename={`products-${tab}-${new Date().toISOString().slice(0, 10)}.csv`}
              headers={CSV_HEADERS}
              rows={csvRows}
            />
            <AddProductButton
              categories={categories}
              defaultIsMoissanite={tab === "moissanite"}
            />
          </>
        }
      />

      {!dbError ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/[0.07] bg-card px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-muted">
                <ShoppingBag className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-semibold text-foreground">{allRows.length}</p>
                <p className="text-xs text-muted">Total items</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/12 to-card px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-pink-light">
                <Gem className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-semibold text-foreground">{moissaniteCount}</p>
                <p className="text-xs text-muted">Moissanite items</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.07] bg-card px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-muted">
                <Package className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-semibold text-foreground">{nonMoissaniteCount}</p>
                <p className="text-xs text-muted">Other products</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-success/20 bg-gradient-to-br from-success/10 to-card px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/15 text-success">
                <CheckCircle2 className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-semibold text-foreground">{activeProducts.length}</p>
                <p className="text-xs text-muted">Active for reservations</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Tabs and Sorting */}
      <ProductFilterTabs
        currentTab={tab}
        currentSort={sort}
        counts={{
          all: allRows.length,
          moissanite: moissaniteCount,
          nonMoissanite: nonMoissaniteCount,
        }}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>
                {tab === "moissanite"
                  ? "Moissanite Catalog"
                  : tab === "non-moissanite"
                  ? "General Products"
                  : "All Catalog Items"}
              </CardTitle>
              <CardDescription>
                {q
                  ? `Showing search results for “${q}”.`
                  : "Active items can be chosen directly during reservations and orders."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {dbError ? (
            <div className="px-5 pb-5">
              <ErrorState title={dbError.title} description={dbError.description} />
            </div>
          ) : (
            <ProductsTable
              products={filteredRows}
              categories={categories}
              empty={empty}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
