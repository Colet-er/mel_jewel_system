export type UserRole = "owner" | "admin" | "staff" | "viewer";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = "reserved" | "paid" | "shipped" | "claimed" | "cancelled" | "rto";

export type ReservationType = "regular" | "pasabuy" | "cod";

export interface Customer {
  id: string;
  name: string;
  address: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  price: number;
  cost: number;
  stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  product?: {
    name: string;
    cost: number;
    sku?: string | null;
    category?: {
      name: string;
    } | null;
  } | null;
}

export type PaymentKind = "downpayment" | "balance";

export interface OrderPayment {
  id: string;
  order_id: string;
  kind: PaymentKind;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  evidence?: PaymentEvidence[];
}

export interface PaymentEvidence {
  id: string;
  payment_id: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_by: string;
  created_at: string;
}

export interface ReservationLineItemInput {
  id?: string;
  itemName: string;
  itemCode?: string;
  category?: string;
  quantity: number;
  unitPrice: number;
}

export interface ReservationInput {
  invoiceNumber?: string;
  fbName?: string;
  customerName: string;
  customerAddress: string;
  phone: string;
  items?: ReservationLineItemInput[];
  itemName?: string;
  itemCode?: string;
  category?: string;
  quantity?: number;
  amount: number;
  discount: number;
  shippingFee: number;
  downpayment: number;
  downpaymentMethod: string;
  type: ReservationType;
}

export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  customer_id: string | null;
  total_amount: number;
  discount?: number | null;
  shipping_fee?: number | null;
  notes: string | null;
  reservation_type?: ReservationType | null;
  reserved_until: string | null;
  paid_at: string | null;
  shipped_at?: string | null;
  claimed_at?: string | null;
  cancelled_at?: string | null;
  cancellation_reason?: string | null;
  rto_at?: string | null;
  rto_reason?: string | null;
  rto_notes?: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  customer?: {
    name: string;
    fb_name?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  items?: Pick<
    OrderItem,
    "id" | "quantity" | "unit_price" | "line_total" | "product"
  >[];
  payments?: (Pick<OrderPayment, "kind" | "amount"> & Partial<Omit<OrderPayment, "kind" | "amount">> & { evidence?: PaymentEvidence[] })[];
}

export interface Commission {
  id: string;
  worker_name: string;
  date: string;
  related_order_id: string | null;
  description: string | null;
  amount: number;
  status: "paid" | "unpaid";
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  related_order?: {
    id: string;
    order_number: string;
    status: OrderStatus;
    total_amount: number;
    customer?: {
      name: string;
      fb_name?: string | null;
    } | null;
    items?: {
      id: string;
      quantity: number;
      unit_price: number;
      line_total: number;
      product?: {
        name: string;
        sku?: string | null;
      } | null;
    }[];
  } | null;
}

export interface MoissaniteSku {
  id: string;
  sku: string;
  item_name: string;
  description: string | null;
  setting: string | null;
  cost: number;
  selling_price: number;
  status: "active" | "low_stock" | "out_of_stock" | "archived";
  category_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SoldMoissanite {
  id: string;
  date_sold: string;
  invoice_number: string;
  sku_id: string;
  order_id?: string | null;
  order_item_id?: string | null;
  customer_id: string | null;
  quantity: number;
  selling_price: number;
  total_amount: number;
  status: "completed" | "pending" | "refunded";
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sku?: MoissaniteSku | null;
  customer?: {
    name: string;
    fb_name?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
}

export interface Collection {
  id: string;
  order_id: string;
  customer_id: string;
  amount: number;
  payment_method: string;
  reference_number: string | null;
  notes: string | null;
  collected_by: string | null;
  collected_at: string;
  created_at: string;
  order?: {
    id: string;
    order_number: string;
    status: OrderStatus;
    total_amount: number;
    customer?: {
      name: string;
      fb_name?: string | null;
    } | null;
  } | null;
  customer?: {
    name: string;
    fb_name?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
}
