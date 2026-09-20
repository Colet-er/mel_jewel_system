"use client";

import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

interface TopbarProps {
  email: string;
  fullName: string | null;
  role: string;
  onOpenMobileNav: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Topbar({
  onOpenMobileNav,
  collapsed = false,
  onToggleCollapse,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-4 sm:px-6 lg:px-8">
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="rounded-lg p-1.5 text-muted hover:bg-elevated hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>

        {onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden rounded-lg p-1.5 text-muted transition-colors hover:bg-elevated hover:text-foreground lg:flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden />
            )}
          </button>
        ) : null}

        <div className="hidden sm:block leading-tight">
          <p className="text-sm font-medium text-foreground">Operations Workspace</p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-elevated/40 px-3 py-1 text-xs text-muted">
          <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
          <span className="font-medium text-secondary">Online</span>
        </div>
      </div>
    </header>
  );
}
