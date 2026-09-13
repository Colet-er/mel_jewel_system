"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { NAV_GROUPS } from "@/lib/utils/navigation";
import { NavIcon } from "./nav-icons";
import { cn } from "@/lib/utils/cn";

function isActive(pathname: string, href: string): boolean {
  // "All Orders" is active only on the exact list page; status sub-pages
  // highlight their own entry.
  if (href === "/orders") {
    return pathname === "/orders";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarNavProps {
  onNavigate?: () => void;
}

export function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Main navigation" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
      {NAV_GROUPS.map((group, groupIndex) => (
        <NavGroupSection key={group.label ?? `group-${groupIndex}`} label={group.label}>
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
              onNavigate={onNavigate}
            />
          ))}
        </NavGroupSection>
      ))}
    </nav>
  );
}

function NavGroupSection({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (!label) {
    return <div className="space-y-1">{children}</div>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted transition-colors hover:text-foreground"
      >
        {label}
        <ChevronDown
          aria-hidden
          className={cn("h-3.5 w-3.5 transition-transform", collapsed && "-rotate-90")}
        />
      </button>
      {!collapsed ? <div className="mt-1 space-y-1">{children}</div> : null}
    </div>
  );
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: { label: string; href: string; icon: string };
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
        active
          ? "bg-gradient-to-r from-primary/20 to-primary/5 text-pink-light shadow-[inset_0_0_0_1px_rgba(255,61,141,0.12)]"
          : "text-muted hover:bg-white/[0.04] hover:text-foreground"
      )}
    >
      <NavIcon name={item.icon} className={cn("h-4 w-4 shrink-0 transition-colors group-hover:text-pink-light", active && "text-primary")} />
      {item.label}
    </Link>
  );
}
