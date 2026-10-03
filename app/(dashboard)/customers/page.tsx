import { createClient } from "@/lib/supabase/server";
import { describeDbError } from "@/lib/supabase/queries";
import { formatDate } from "@/lib/utils/format";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { ExportButton } from "@/components/filters/export-button";
import { SearchInput } from "@/components/filters/search-input";
import { CustomersTable, type CustomerTableRow } from "@/components/customers/customers-table";

export const metadata = { title: "Customers" };

const CSV_HEADERS = ["Name", "FB Name", "Address", "Phone", "Added"];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  let customers: CustomerTableRow[] | null = null;
  let dbError: { title: string; description: string } | null = null;

  try {
    const supabase = await createClient();
    let query = supabase
      .from("customers")
      .select("id, name, fb_name, address, phone, notes, created_at")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });

    if (q) {
      query = query.or(`name.ilike.%${q}%,fb_name.ilike.%${q}%,address.ilike.%${q}%,phone.ilike.%${q}%`);
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
        description="View and manage customer contact and shipping details."
        actions={
          <>
            <SearchInput placeholder="Search customers…" />
            <ExportButton
              filename="customers.csv"
              headers={CSV_HEADERS}
              rows={(customers ?? []).map((customer) => [
                customer.name,
                customer.fb_name ?? "",
                customer.address ?? "",
                customer.phone ?? "",
                formatDate(customer.created_at),
              ])}
            />
          </>
        }
      />

      <Card>
        <CardContent className="px-0 pb-0">
          {dbError ? (
            <div className="px-5 pb-5 pt-5">
              <ErrorState title={dbError.title} description={dbError.description} />
            </div>
          ) : (
            <CustomersTable customers={customers ?? []} q={q} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
