"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { cn } from "@/lib/utils/cn";

interface DashboardShellProps {
  children: ReactNode;
  email: string;
  fullName: string | null;
  role: string;
  developerAccess: boolean;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getCollapsedSnapshot(): boolean {
  try {
    return localStorage.getItem("sidebar_collapsed") === "true";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  return false;
}

export function DashboardShell({
  children,
  email,
  fullName,
  role,
  developerAccess,
}: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [localCollapsed, setLocalCollapsed] = useState<boolean | null>(null);
  const storedCollapsed = useSyncExternalStore(subscribe, getCollapsedSnapshot, getServerSnapshot);
  const collapsed = localCollapsed ?? storedCollapsed;

  const toggleCollapse = useCallback(() => {
    setLocalCollapsed((prev) => {
      const current = prev ?? storedCollapsed;
      const next = !current;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  }, [storedCollapsed]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapse]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        role={role}
        email={email}
        fullName={fullName}
        developerAccess={developerAccess}
        collapsed={collapsed}
      />
      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-in-out",
          collapsed ? "lg:pl-[72px]" : "lg:pl-64"
        )}
      >
        <Topbar
          email={email}
          fullName={fullName}
          role={role}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
        <main className="min-w-0 flex-1 p-6 sm:p-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
