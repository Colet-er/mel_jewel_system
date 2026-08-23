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
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
          className="rounded-lg p-2 text-muted hover:bg-elevated hover:text-foreground lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden text-right leading-tight sm:block">
          <p className="text-sm font-medium text-foreground">{fullName || email}</p>
          <p className="text-xs text-muted">{email}</p>
        </div>
        <RoleBadge role={role} />
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label="Sign out"
          title="Sign out"
          className="rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-danger disabled:opacity-50"
        >
          <LogOut className="h-5 w-5" aria-hidden />
        </button>
      </div>
    </header>
  );
}
