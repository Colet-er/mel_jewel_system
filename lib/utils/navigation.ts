export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/**
 * Icon names map to lucide-react icons in components/layout/nav-icons.tsx.
 * Kept as strings so nav config stays serializable.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [{ label: "Dashboard", href: "/dashboard", icon: "layout-dashboard" }],
  },
  {
    label: "Orders",
    items: [
      { label: "Reserved", href: "/orders/reserved", icon: "clock" },
      { label: "Paid", href: "/orders/paid", icon: "badge-check" },
      { label: "Shipped", href: "/orders/shipped", icon: "truck" },
      { label: "Claimed", href: "/orders/claimed", icon: "check-circle-2" },
      { label: "Cancelled", href: "/orders/cancelled", icon: "x-circle" },
      { label: "RTO", href: "/orders/rto", icon: "rotate-ccw" },
    ],
  },
  {
    label: "Moissanite",
    items: [
      { label: "Moissanite-SKU", href: "/moissanite/sku", icon: "gem" },
      { label: "Sold Moissanite", href: "/moissanite/sold", icon: "shopping-bag" },
    ],
  },
  {
    label: "Other",
    items: [
      { label: "Commission", href: "/commission", icon: "credit-card" },
      { label: "Collections", href: "/collections", icon: "dollar-sign" },
    ],
  },
  {
    items: [{ label: "Customers", href: "/customers", icon: "users" }],
  },
  {
    label: "Products",
    items: [
      { label: "Products", href: "/products", icon: "package" },
      { label: "Categories", href: "/categories", icon: "tags" },
    ],
  },
  {
    items: [{ label: "Reports", href: "/reports", icon: "trending-up" }],
  },
  {
    items: [{ label: "Settings", href: "/settings", icon: "settings" }],
  },
];
