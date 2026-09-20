import type { OrderStatus, Order, Commission, MoissaniteSku, SoldMoissanite, Collection } from "@/types";
import { createClient } from "./server";

/** Required downpayment is this fraction of the order total. */
export const DOWNPAYMENT_RATE = 0.5;

export interface OrdersFilter {
  status?: OrderStatus;
  month?: number;
  year?: number;
  q?: string;
  limit?: number;
}

export interface DashboardTotals {
  orderCount: number;
  itemsSold: number;
  revenue: number;
  profit: number;
}

export interface CommissionFilter {
  month?: number;
  year?: number;
  q?: string;
  status?: "paid" | "unpaid";
}

export interface MoissaniteSkuFilter {
  q?: string;
  status?: "active" | "low_stock" | "out_of_stock" | "archived";
}

export interface SoldMoissaniteFilter {
  month?: number;
  year?: number;
  q?: string;
}

export interface CollectionsFilter {
  month?: number;
  year?: number;
  q?: string;
}

function monthRange(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Maps low-level database errors to friendly copy. A missing relation means
 * the latest migration has not been applied yet.
 */
export function describeDbError(error: unknown): { title: string; description: string } {
  const isTimeout =
    error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
  if (isTimeout) {
    return {
      title: "Request timed out",
      description:
        "The database took too long to respond. Check your connection or Supabase project status, then try again.",
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("does not exist") || message.includes("schema cache")) {
    return {
      title: "Database not set up yet",
      description:
        "The required tables are missing. Apply the latest migration in supabase/migrations to your Supabase project, then reload this page.",
    };
  }
  return {
    title: "Something went wrong",
    description: "We could not load the data right now. Please try again.",
  };
}

/**
 * Upper bound for Supabase queries so a slow/unreachable project can never
 * leave the page hanging forever — the timeout surfaces as an error the
 * caller renders as an error state.
 */
const QUERY_TIMEOUT_MS = 10_000;

/**
 * PostgREST''s raw `or` syntax treats these characters as filter grammar.
 * Remove them before interpolating a user-entered search term.
 */
function searchTerm(value: string): string {
  return value.replace(/[%,()"''\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
}

function inPredicate(column: string, ids: string[]): string | null {
  return ids.length > 0 ? `${column}.in.(${ids.join(",")})` : null;
}

const ORDER_SELECT = `
  id,
  order_number,
  status,
  total_amount,
  discount,
  shipping_fee,
  reservation_type,
  reserved_until,
  paid_at,
  shipped_at,
  claimed_at,
  cancelled_at,
  cancellation_reason,
  rto_at,
  rto_reason,
  rto_notes,
  notes,
  created_at,
  updated_at,
  customer:customers ( name, fb_name, phone, address ),
  items:order_items ( id, quantity, unit_price, line_total, product:products ( name, sku, cost, category:categories ( name ) ) ),
  payments:order_payments ( kind, amount, payment_method, reference_number, notes, created_at, evidence:payment_evidence ( id, storage_path, mime_type ) )
`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchOrders(filter: OrdersFilter = {}): Promise<Order[]> {
  const supabase = await createClient();

  let query = supabase
    .from("orders")
    .select(ORDER_SELECT)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (filter.status) {
    query = query.eq("status", filter.status);
  }

  if (filter.month && filter.year) {
    const { start, end } = monthRange(filter.year, filter.month);
    query = query.gte("created_at", start).lt("created_at", end);
  }

  if (filter.q) {
    const term = searchTerm(filter.q);
    if (term) {
      const { data: customers, error: customerError } = await supabase
        .from("customers")
        .select("id")
        .or(`name.ilike.%${term}%,fb_name.ilike.%${term}%`)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));
      if (customerError) throw new Error(customerError.message);

      const predicates = [
        `order_number.ilike.%${term}%`,
        inPredicate("customer_id", (customers ?? []).map(({ id }) => id)),
      ].filter((predicate): predicate is string => Boolean(predicate));
      query = query.or(predicates.join(","));
    }
  }

  if (filter.limit) {
    query = query.limit(filter.limit);
  }

  const { data, error } = await query.abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as Order[];
}

/** Totals exclude cancelled orders; profit uses product cost via order items. */
export function computeTotals(orders: Order[]): DashboardTotals {
  let itemsSold = 0;
  let revenue = 0;
  let profit = 0;
  let orderCount = 0;

  for (const order of orders) {
    if (order.status === "cancelled") continue;
    orderCount += 1;
    revenue += Number(order.total_amount);

    for (const item of order.items ?? []) {
      itemsSold += item.quantity;
      const cost = item.product ? Number(item.product.cost) : 0;
      profit += (Number(item.unit_price) - cost) * item.quantity;
    }
  }

  return { orderCount, itemsSold, revenue, profit };
}

/** Required downpayment amount for an order total. Mirrors required_downpayment() in SQL. */
export function requiredDownpayment(totalAmount: number): number {
  return Math.round(totalAmount * DOWNPAYMENT_RATE * 100) / 100;
}

/** Sum of recorded downpayment payments on an order. */
export function settledDownpayment(order: Order): number {
  return (order.payments ?? [])
    .filter((payment) => payment.kind === "downpayment")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
}

/** A downpayment is settled once payments cover the required amount. */
export function isDownpaymentSettled(order: Order): boolean {
  return settledDownpayment(order) >= requiredDownpayment(Number(order.total_amount));
}

/**
 * Orders whose required downpayment is not yet fully settled, based on
 * recorded order_payments. Only open orders are monitored: paid/shipped
 * orders are settled by definition and cancelled orders are excluded.
 */
export async function fetchPendingDownpaymentOrders(): Promise<Order[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .is("archived_at", null)
    .eq("status", "reserved")
    .order("created_at", { ascending: false })
    .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

  if (error) {
    throw new Error(error.message);
  }

  const orders = (data ?? []) as unknown as Order[];
  return orders.filter((order) => !isDownpaymentSettled(order));
}

export interface OrderStatusCounts {
  reserved: number;
  paid: number;
  shipped: number;
  claimed: number;
  cancelled: number;
  rto: number;
}

/** Count of non-archived orders per status using lightweight head queries. */
export async function fetchOrderStatusCounts(): Promise<OrderStatusCounts> {
  const supabase = await createClient();

  const statuses = ["reserved", "paid", "shipped", "claimed", "cancelled", "rto"] as const;

  const counts = await Promise.all(
    statuses.map(async (status) => {
      const { count, error } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .eq("status", status)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

      if (error) {
        throw new Error(error.message);
      }

      return count ?? 0;
    })
  );

  return {
    reserved: counts[0],
    paid: counts[1],
    shipped: counts[2],
    claimed: counts[3],
    cancelled: counts[4],
    rto: counts[5],
  };
}

/** Total stock across active products (available stones). */
export async function fetchAvailableStock(): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("stock")
    .eq("is_active", true)
    .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((sum, product) => sum + Number(product.stock ?? 0), 0);
}

/** Fetch a single order with full item/product/payment details, or null. */
export async function fetchOrderById(id: string): Promise<Order | null> {
  if (!UUID_PATTERN.test(id)) {
    return null;
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .is("archived_at", null)
    .eq("id", id)
    .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as unknown as Order | null;
}

// ============================================================
// Commission queries
// ============================================================

const COMMISSION_SELECT = `
  id,
  worker_name,
  date,
  related_order_id,
  description,
  amount,
  status,
  notes,
  created_by,
  created_at,
  updated_at,
  related_order:orders (
    id,
    order_number,
    status,
    total_amount,
    customer:customers ( name, fb_name ),
    items:order_items (
      id,
      quantity,
      unit_price,
      line_total,
      product:products ( name, sku )
    )
  )
`;

export async function fetchCommissions(filter: CommissionFilter = {}): Promise<Commission[]> {
  const supabase = await createClient();

  let query = supabase
    .from("commissions")
    .select(COMMISSION_SELECT)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filter.month && filter.year) {
    const { start, end } = monthRange(filter.year, filter.month);
    query = query.gte("date", start).lt("date", end);
  }

  if (filter.status) {
    query = query.eq("status", filter.status);
  }

  if (filter.q) {
    const term = searchTerm(filter.q);
    if (term) {
      query = query.or(`worker_name.ilike.%${term}%,description.ilike.%${term}%`);
    }
  }

  const { data, error } = await query.abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as Commission[];
}

export interface CommissionSummary {
  totalCommission: number;
  paidCommission: number;
  unpaidCommission: number;
}

export function computeCommissionSummary(commissions: Commission[]): CommissionSummary {
  let totalCommission = 0;
  let paidCommission = 0;
  let unpaidCommission = 0;

  for (const c of commissions) {
    const amount = Number(c.amount);
    totalCommission += amount;
    if (c.status === "paid") {
      paidCommission += amount;
    } else {
      unpaidCommission += amount;
    }
  }

  return { totalCommission, paidCommission, unpaidCommission };
}

// ============================================================
// Moissanite SKU queries
// ============================================================

const MOISSANITE_SKU_SELECT = `
  id,
  sku,
  item_name,
  description,
  setting,
  cost,
  selling_price,
  status,
  category_id,
  created_by,
  created_at,
  updated_at,
  category:categories ( name )
`;

export async function fetchMoissaniteSkus(filter: MoissaniteSkuFilter = {}): Promise<MoissaniteSku[]> {
  const supabase = await createClient();

  let query = supabase
    .from("moissanite_skus")
    .select(MOISSANITE_SKU_SELECT)
    .order("created_at", { ascending: false });

  if (filter.status) {
    query = query.eq("status", filter.status);
  } else {
    query = query.neq("status", "archived");
  }

  if (filter.q) {
    const term = filter.q.replace(/[%,()]/g, "");
    if (term) {
      query = query.or(`sku.ilike.%${term}%,item_name.ilike.%${term}%,description.ilike.%${term}%,setting.ilike.%${term}%`);
    }
  }

  const { data, error } = await query.abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as MoissaniteSku[];
}

// ============================================================
// Sold Moissanite queries
// ============================================================

const SOLD_MOISSANITE_SELECT = `
  id,
  order_id,
  date_sold,
  invoice_number,
  sku_id,
  customer_id,
  quantity,
  selling_price,
  total_amount,
  status,
  notes,
  created_by,
  created_at,
  updated_at,
  sku:moissanite_skus ( id, sku, item_name, selling_price ),
  customer:customers ( name, fb_name, phone, address )
`;

export async function fetchSoldMoissanite(filter: SoldMoissaniteFilter = {}): Promise<SoldMoissanite[]> {
  const supabase = await createClient();

  let query = supabase
    .from("sold_moissanite")
    .select(SOLD_MOISSANITE_SELECT)
    .order("date_sold", { ascending: false })
    .order("created_at", { ascending: false });

  if (filter.month && filter.year) {
    const { start, end } = monthRange(filter.year, filter.month);
    query = query.gte("date_sold", start).lt("date_sold", end);
  }

  if (filter.q) {
    const term = searchTerm(filter.q);
    if (term) {
      query = query.or(`invoice_number.ilike.%${term}%`);
    }
  }

  const { data, error } = await query.abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as SoldMoissanite[];
}

// ============================================================
// Collections queries
// ============================================================

const COLLECTIONS_SELECT = `
  id,
  order_id,
  customer_id,
  amount,
  payment_method,
  reference_number,
  notes,
  collected_by,
  collected_at,
  created_at,
  order:orders ( id, order_number, status, total_amount, customer:customers ( name, fb_name ) ),
  customer:customers ( name, fb_name, phone, address )
`;

export async function fetchCollections(filter: CollectionsFilter = {}): Promise<Collection[]> {
  const supabase = await createClient();

  let query = supabase
    .from("collections")
    .select(COLLECTIONS_SELECT)
    .order("collected_at", { ascending: false });

  if (filter.month && filter.year) {
    const { start, end } = monthRange(filter.year, filter.month);
    query = query.gte("collected_at", start).lt("collected_at", end);
  }

  if (filter.q) {
    const term = searchTerm(filter.q);
    if (term) {
      query = query.or(`reference_number.ilike.%${term}%`);
    }
  }

  const { data, error } = await query.abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as unknown as Collection[];
}
