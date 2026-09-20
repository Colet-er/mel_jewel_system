"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RoleBadge } from "@/components/ui/status-badge";
import { SidebarNav } from "./sidebar-nav";
import { Brand } from "./brand";
import { cn } from "@/lib/utils/cn";

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  role: string;
  email: string;
  fullName: string | null;
  developerAccess: boolean;
  collapsed?: boolean;
}

export function Sidebar({
  mobileOpen,
  onCloseMobile,
  role,
  email,
  fullName,
  developerAccess,
  collapsed = false,
}: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-in-out lg:flex",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        <Brand collapsed={collapsed} />
        <SidebarNav
          role={role}
          developerAccess={developerAccess}
          collapsed={collapsed}
        />
        <SidebarFooter
          collapsed={collapsed}
          role={role}
          email={email}
          fullName={fullName}
        />
      </aside>

      {/* Mobile drawer backdrop */}
      <div
        role="presentation"
        onClick={onCloseMobile}
        className={cn(
          "fixed inset-0 z-40 bg-black/70 backdrop-blur-xs transition-opacity duration-200 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />

      {/* Mobile drawer */}
      <aside
        aria-label="Main navigation"
        aria-hidden={!mobileOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-sidebar shadow-xl transition-transform duration-200 ease-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between pr-3">
          <Brand />
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="rounded-lg p-2 text-muted hover:bg-elevated hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <SidebarNav
          role={role}
          developerAccess={developerAccess}
          onNavigate={onCloseMobile}
        />
        <SidebarFooter
          role={role}
          email={email}
          fullName={fullName}
        />
      </aside>
    </>
  );
}

interface SidebarFooterProps {
  collapsed?: boolean;
  role: string;
  email: string;
  fullName: string | null;
}

function SidebarFooter({ collapsed, role, email, fullName }: SidebarFooterProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const displayName = fullName || role.toUpperCase();
  const initials = (displayName || "U")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2 border-t border-border p-2">
        <div
          title={`${displayName} (${email})`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-xs font-bold text-foreground"
        >
          {initials}
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label="Sign out"
          title="Sign out"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-center justify-between gap-2.5 rounded-xl border border-border/60 bg-elevated/40 p-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-elevated text-xs font-bold text-foreground">
            {initials}
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-semibold text-foreground">
                {displayName}
              </span>
              <RoleBadge role={role} />
            </div>
            <span className="truncate text-[11px] text-muted">{email}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label="Sign out"
          title="Sign out"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
