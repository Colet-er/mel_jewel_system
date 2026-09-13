"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RoleBadge } from "@/components/ui/status-badge";

interface TopbarProps {
  email: string;
  fullName: string | null;
  role: string;
  onOpenMobileNav: () => void;
}

export function Topbar({ email, fullName, role, onOpenMobileNav }: TopbarProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between gap-4 border-b border-white/5 bg-background/80 px-4 shadow-[0_1px_0_rgba(255,255,255,0.02)] backdrop-blur-xl sm:px-6 lg:px-10">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-muted hover:bg-elevated hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <div className="hidden lg:block">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Daily Pearls PH</p>
          <p className="mt-0.5 text-sm font-medium text-foreground">Operations workspace</p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/5 bg-card/50 px-2 py-1.5">
        <div className="hidden min-w-0 max-w-[46vw] text-right leading-tight sm:block">
          <p className="truncate text-sm font-medium text-foreground">{fullName || email}</p>
          <p className="truncate text-xs text-muted">{email}</p>
        </div>
        <RoleBadge role={role} />
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label="Sign out"
          title="Sign out"
          className="rounded-lg p-2 text-muted transition-all hover:bg-danger/10 hover:text-danger disabled:opacity-50"
        >
          <LogOut className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}
