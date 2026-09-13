import { Gem, ListChecks, Tags } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { describeDbError, fetchMoissaniteSkus } from "@/lib/supabase/queries";
import { formatCurrency } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ExportButton } from "@/components/filters/export-button";
import { SearchInput } from "@/components/filters/search-input";
import {
  AddInventoryButton,
  InventoryRowActions,
  type InventoryCategory,
} from "@/components/moissanite/inventory-actions";

export const metadata = { title: "Moissanite Inventory" };

interface MoissaniteSkuRow {
  id: string;
  sku: string;
  itemName: string;
  description: string | null;
  setting: string | null;
  sellingPrice: number;
  status: "active" | "low_stock" | "out_of_stock" | "archived";
  categoryName: string | null;
  categoryId: string | null;
}

function itemActions(row: MoissaniteSkuRow, categories: InventoryCategory[]) {
  if (row.status === "archived") return <span className="text-xs text-muted">Archived</span>;
  return (
    <InventoryRowActions
      categories={categories}
      item={{
        id: row.id,
        itemNumber: row.sku,
        itemDescription: row.description || row.itemName,
        price: row.sellingPrice,
        categoryId: row.categoryId,
        setting: row.setting,
      }}
    />
  );
}

function columns(categories: InventoryCategory[]): Column<MoissaniteSkuRow>[] {
  return [
    { key: "sku", header: "Item Number", render: (row) => <span className="font-mono text-sm font-semibold text-pink-light">{row.sku}</span> },
    { key: "description", header: "Item Description", render: (row) => <span className="block max-w-sm font-medium leading-5 text-foreground">{row.description || row.itemName}</span> },
    { key: "sellingPrice", header: "Price", className: "text-right", render: (row) => <span className="font-semibold text-pink-light">{formatCurrency(row.sellingPrice)}</span> },
    { key: "category", header: "Category", render: (row) => <span className="inline-flex rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-xs text-muted">{row.categoryName || "Uncategorized"}</span> },
    { key: "setting", header: "Setting", render: (row) => row.setting ? <span className="text-foreground/85">{row.setting}</span> : <span className="text-muted">—</span> },
    { key: "actions", header: "Manage", render: (row) => itemActions(row, categories) },
  ];
}

const CSV_HEADERS = ["Item Number", "Item Description", "Price", "Category", "Setting"];

export default async function MoissaniteSkuPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  let skus: MoissaniteSkuRow[] | null = null;
  let categories: InventoryCategory[] = [];
  let dbError: { title: string; description: string } | null = null;

  try {
    const supabase = await createClient();
    const [data, categoryResult] = await Promise.all([
      fetchMoissaniteSkus({ q }),
      supabase.from("categories").select("id,name").order("name"),
    ]);
    if (!categoryResult.error) {
      const categoryLabels = new Map([["ring", "Ring"], ["necklace", "Necklace"], ["earrings", "Earrings"]]);
      const byName = new Map((categoryResult.data ?? []).map((category) => [category.name.trim().toLowerCase(), category]));
      categories = Array.from(categoryLabels, ([name, label]) => {
        const category = byName.get(name);
        return category ? { id: category.id, name: label } : null;
      }).filter((category): category is InventoryCategory => category !== null);
    }
    skus = (data ?? []).map((sku) => ({
      id: sku.id,
      sku: sku.sku,
      itemName: sku.item_name,
      description: sku.description,
      setting: sku.setting,
      sellingPrice: Number(sku.selling_price),
      status: sku.status,
      categoryName: (sku as unknown as { category?: { name: string } | null }).category?.name ?? null,
      categoryId: sku.category_id,
    }));
  } catch (error) {
    dbError = describeDbError(error);
  }

  const rows = skus ?? [];
  const availableItems = rows.filter((row) => row.status !== "archived");
  const categoryCount = new Set(availableItems.map((row) => row.categoryName).filter(Boolean)).size;
  const csvRows = rows.map((row) => [row.sku, row.description || row.itemName, row.sellingPrice, row.categoryName ?? "", row.setting ?? ""]);
  const empty = <EmptyState icon={<Gem className="h-8 w-8" aria-hidden />} title={q ? "No matching items" : "No Moissanite items yet"} description={q ? "Try another item number or description." : "Add your first item to make it available in reservations."} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="MOISSANITE INVENTORY"
        description="Your reusable catalog of Moissanite items for reservations."
        actions={<><SearchInput placeholder="Search item number or description…" /><ExportButton filename="moissanite-inventory.csv" headers={CSV_HEADERS} rows={csvRows} /><AddInventoryButton categories={categories} /></>}
      />

      {!dbError ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 to-card px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-pink-light"><Gem className="h-5 w-5" aria-hidden /></span><div><p className="text-2xl font-semibold text-foreground">{availableItems.length}</p><p className="text-xs text-muted">Catalog items</p></div></div></div>
          <div className="rounded-2xl border border-white/[0.07] bg-card px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-muted"><Tags className="h-5 w-5" aria-hidden /></span><div><p className="text-2xl font-semibold text-foreground">{categoryCount}</p><p className="text-xs text-muted">Categories used</p></div></div></div>
          <div className="rounded-2xl border border-white/[0.07] bg-card px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success"><ListChecks className="h-5 w-5" aria-hidden /></span><div><p className="text-sm font-semibold text-foreground">Reservation ready</p><p className="mt-1 text-xs text-muted">Choose catalog items directly in Item Details.</p></div></div></div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Moissanite Catalog</CardTitle>
          <CardDescription>{q ? `Showing results for “${q}”.` : "Edit an item to update its details, or delete it from the catalog and reservation choices."}</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {dbError ? <div className="px-5 pb-5"><ErrorState title={dbError.title} description={dbError.description} /></div> : (
            <>
              <div className="hidden md:block"><DataTable columns={columns(categories)} rows={rows} rowKey={(row) => row.id} empty={empty} /></div>
              <div className="divide-y divide-white/[0.07] md:hidden">
                {rows.length === 0 ? empty : rows.map((row) => (
                  <article key={row.id} className="space-y-4 px-5 py-5">
                    <div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="font-mono text-xs font-semibold uppercase tracking-wider text-pink-light">{row.sku}</p><h3 className="mt-1 text-sm font-semibold leading-5 text-foreground">{row.description || row.itemName}</h3></div><p className="shrink-0 text-sm font-semibold text-pink-light">{formatCurrency(row.sellingPrice)}</p></div>
                    <div className="flex flex-wrap gap-2 text-xs"><span className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 text-muted">{row.categoryName || "Uncategorized"}</span>{row.setting ? <span className="rounded-full border border-primary/15 bg-primary/[0.06] px-2.5 py-1 text-pink-light">{row.setting}</span> : null}</div>
                    {itemActions(row, categories)}
                  </article>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
