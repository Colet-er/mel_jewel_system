"use client";

import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  FileText,
  Gem,
  LayoutDashboard,
  Package,
  PlusCircle,
  RotateCcw,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Tags,
  TrendingUp,
  Truck,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard,
  "shopping-cart": ShoppingCart,
  "plus-circle": PlusCircle,
  clock: Clock,
  "badge-check": BadgeCheck,
  truck: Truck,
  "x-circle": XCircle,
  users: Users,
  package: Package,
  tags: Tags,
  "trending-up": TrendingUp,
  "file-text": FileText,
  settings: Settings,
  "check-circle-2": CheckCircle2,
  "rotate-ccw": RotateCcw,
  gem: Gem,
  "shopping-bag": ShoppingBag,
  "credit-card": CreditCard,
  "dollar-sign": DollarSign,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? LayoutDashboard;
  return <Icon className={className} aria-hidden />;
}
