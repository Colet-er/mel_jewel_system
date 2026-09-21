import { FolderCheck, Layers, Tags } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/queries";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ExportButton } from "@/components/filters/export-button";
import { SearchInput } from "@/components/filters/search-input";
import {
  AddCategoryButton,
  CategoryRowActions,
} from "@/components/categories/category-actions";

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
    render: (row) => <span className="font-semibold text-foreground">{row.name}</span>,
  },
  {
    key: "description",
    header: "Description",
    render: (row) =>
      row.description ? (
        <span className="block max-w-md text-sm text-foreground/80">{row.description}</span>
      ) : (
        <span className="text-muted">—</span>
      ),
  },
  {
    key: "product_count",
    header: "Products",
    render: (row) => (
      <span className="inline-flex rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 font-mono text-xs font-semibold text-pink-light">
        {row.product_count.toLocaleString("en-US")} {row.product_count === 1 ? "item" : "items"}
      </span>
    ),
    className: "text-right",
  },
  {
    key: "actions",
    header: "Manage",
    render: (row) => (
      <CategoryRowActions
        item={{
          id: row.id,
          name: row.name,
          description: row.description,
          productCount: row.product_count,
        }}
      />
    ),
  },
];

const CSV_HEADERS = ["Category", "Description", "Products Count"];

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = searchParams ? await searchParams : {};
  const q = typeof params.q === "string" ? params.q.trim() : "";

  let categories: CategoryRow[] | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    const supabase = await createClient();
    let query = supabase
      .from("categories")
      .select("id, name, description, products(count)")
      .order("name");

    if (q) {
      query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
    }

    const { data, error } = await query;

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

  const rows = categories ?? [];
  const categoriesInUse = rows.filter((r) => r.product_count > 0).length;
  const totalProductsAssigned = rows.reduce((sum, r) => sum + r.product_count, 0);

  const csvRows = rows.map((category) => [
    category.name,
    category.description ?? "",
    category.product_count,
  ]);

  const empty = (
    <EmptyState
      icon={<Tags className="h-8 w-8" aria-hidden />}
      title={q ? "No matching categories" : "No categories yet"}
      description={
        q ? "Try a different search term." : "Create categories to organize your jewelry catalog."
      }
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="CATEGORIES"
        description="Group and organize products for streamlined catalog navigation and reporting."
        actions={
          <>
            <SearchInput placeholder="Search categories…" />
            <ExportButton filename="categories.csv" headers={CSV_HEADERS} rows={csvRows} />
            <AddCategoryButton />
          </>
        }
      />

      {!dbError ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 to-card px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-pink-light">
                <Tags className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-semibold text-foreground">{rows.length}</p>
                <p className="text-xs text-muted">Total categories</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-card px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success">
                <FolderCheck className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-semibold text-foreground">{categoriesInUse}</p>
                <p className="text-xs text-muted">Categories in use</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-card px-4 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-pink-light">
                <Layers className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-2xl font-semibold text-foreground">{totalProductsAssigned}</p>
                <p className="text-xs text-muted">Products categorized</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>All Categories</CardTitle>
          <CardDescription>
            {q ? `Filtered by “${q}”.` : "Categories and how many products belong to each."}
          </CardDescription>
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
                  columns={COLUMNS}
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
                          <h3 className="text-sm font-semibold leading-5 text-foreground">
                            {row.name}
                          </h3>
                          {row.description ? (
                            <p className="mt-1 text-xs text-muted">{row.description}</p>
                          ) : null}
                        </div>
                        <span className="shrink-0 inline-flex rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-1 font-mono text-xs text-pink-light">
                          {row.product_count} {row.product_count === 1 ? "product" : "products"}
                        </span>
                      </div>
                      <CategoryRowActions
                        item={{
                          id: row.id,
                          name: row.name,
                          description: row.description,
                          productCount: row.product_count,
                        }}
                      />
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
