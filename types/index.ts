export type UserRole = "admin" | "staff" | "viewer";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = "reserved" | "paid" | "shipped" | "cancelled";
