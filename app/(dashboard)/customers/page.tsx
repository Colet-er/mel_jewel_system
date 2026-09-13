import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/queries";
import { formatDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { ExportButton } from "@/components/filters/export-button";
import { SearchInput } from "@/components/filters/search-input";

export const metadata = { title: "Customers" };

interface CustomerRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  created_at: string;
}

const COLUMNS: Column<CustomerRow>[] = [
  {
    key: "name",
    header: "Name",
    render: (row) => <span className="font-medium text-foreground">{row.name}</span>,
  },
  {
    key: "email",
    header: "Email",
    render: (row) => row.email ?? <span className="text-muted">—</span>,
  },
  {
    key: "phone",
    header: "Phone",
    render: (row) => row.phone ?? <span className="text-muted">—</span>,
  },
  {
    key: "created_at",
    header: "Added",
    render: (row) => formatDate(row.created_at),
  },
];

const CSV_HEADERS = ["Name", "Email", "Phone", "Added"];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  let customers: CustomerRow[] | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    const supabase = await createClient();
    let query = supabase
      .from("customers")
      .select("id, name, email, phone, created_at")
      .order("created_at", { ascending: false });

    if (q) {
      query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    customers = data ?? [];
  } catch (error) {
    dbError = describeDbError(error);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="The people who buy from you."
        actions={
          <>
            <SearchInput placeholder="Search customers…" />
            <ExportButton
              filename="customers.csv"
              headers={CSV_HEADERS}
              rows={(customers ?? []).map((customer) => [
                customer.name,
                customer.email ?? "",
                customer.phone ?? "",
                formatDate(customer.created_at),
              ])}
            />
            <Button disabled title="Customer creation is coming soon">
              Add Customer
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>{q ? `Filtered by “${q}”.` : "All customers on file."}</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {dbError ? (
            <div className="px-5 pb-5">
              <ErrorState title={dbError.title} description={dbError.description} />
            </div>
          ) : (
            <DataTable
              columns={COLUMNS}
              rows={customers ?? []}
              rowKey={(row) => row.id}
              empty={
                <EmptyState
                  icon={<Users className="h-8 w-8" aria-hidden />}
                  title={q ? "No matching customers" : "No customers yet"}
                  description={
                    q
                      ? "Try a different search term."
                      : "Customers added to the system will appear here."
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
