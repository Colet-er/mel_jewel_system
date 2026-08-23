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
    items: [{ label: "Overview", href: "/dashboard", icon: "layout-dashboard" }],
  },
  {
    label: "Orders",
    items: [
      { label: "All Orders", href: "/orders", icon: "shopping-cart" },
      { label: "New Orders", href: "/orders/new", icon: "plus-circle" },
    ],
  },
  {
    label: "Order Status",
    items: [
      { label: "Reserved", href: "/orders/reserved", icon: "clock" },
      { label: "Paid", href: "/orders/paid", icon: "badge-check" },
      { label: "Shipped", href: "/orders/shipped", icon: "truck" },
      { label: "Cancelled", href: "/orders/cancelled", icon: "x-circle" },
    ],
  },
  {
    label: "Customers",
    items: [{ label: "Customers", href: "/customers", icon: "users" }],
  },
  {
    label: "Products",
    items: [
      { label: "Products", href: "/products", icon: "package" },
      { label: "Categories", href: "/products/categories", icon: "tags" },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Sales", href: "/reports/sales", icon: "trending-up" },
      { label: "Order Reports", href: "/reports/orders", icon: "file-text" },
    ],
  },
  {
    items: [{ label: "Settings", href: "/settings", icon: "settings" }],
  },
];
