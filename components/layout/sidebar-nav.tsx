"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { NAV_GROUPS } from "@/lib/utils/navigation";
import { NavIcon } from "./nav-icons";
import { cn } from "@/lib/utils/cn";

function isActive(pathname: string, href: string): boolean {
  if (href === "/orders") {
    return pathname === "/orders";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface SidebarNavProps {
  onNavigate?: () => void;
  role: string;
  developerAccess: boolean;
  collapsed?: boolean;
}

export function SidebarNav({ onNavigate, role, developerAccess, collapsed }: SidebarNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      className={cn(
        "flex-1 overflow-y-auto transition-all duration-200",
        collapsed ? "space-y-2 px-2 py-3" : "space-y-4 px-3 py-4"
      )}
    >
      {NAV_GROUPS.map((group, groupIndex) => {
        const visibleItems = group.items.filter(
          (item) =>
            (item.href !== "/commission" || role === "owner" || developerAccess) &&
            (item.href !== "/accounts" || developerAccess)
        );

        if (visibleItems.length === 0) {
          return null;
        }

        return (
          <NavGroupSection
            key={group.label ?? `group-${groupIndex}`}
            label={group.label}
            collapsedSidebar={collapsed}
          >
            {visibleItems.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={isActive(pathname, item.href)}
                onNavigate={onNavigate}
                collapsed={collapsed}
              />
            ))}
          </NavGroupSection>
        );
      })}
    </nav>
  );
}

function NavGroupSection({
  label,
  children,
  collapsedSidebar,
}: {
  label?: string;
  children: React.ReactNode;
  collapsedSidebar?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsedSidebar) {
    return (
      <div className="space-y-1">
        {label ? <div className="my-1.5 border-t border-border" /> : null}
        {children}
      </div>
    );
  }

  if (!label) {
    return <div className="space-y-1">{children}</div>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted transition-colors hover:text-foreground"
      >
        {label}
        <ChevronDown
          aria-hidden
          className={cn("h-3 w-3 transition-transform", collapsed && "-rotate-90")}
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
  collapsed,
}: {
  item: { label: string; href: string; icon: string };
  active: boolean;
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center rounded-lg text-sm font-medium transition-colors duration-150",
        collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2",
        active
          ? "bg-primary/10 text-pink-light"
          : "text-secondary hover:bg-white/[0.04] hover:text-foreground"
      )}
    >
      <NavIcon
        name={item.icon}
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          active ? "text-primary" : "text-secondary group-hover:text-foreground"
        )}
      />
      {!collapsed ? <span>{item.label}</span> : null}
    </Link>
  );
}
