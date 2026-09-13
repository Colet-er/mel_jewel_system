import { Package } from "lucide-react";

export function Brand() {
  return (
    <div className="flex items-center gap-3 border-b border-white/5 px-5 py-[18px]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-white shadow-[0_8px_24px_rgba(255,61,141,0.28)] ring-1 ring-white/15">
        <Package className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-bold tracking-[0.08em] text-foreground">
          DAILY PEARLS PH
        </p>
        <p className="text-xs text-muted">Order Management</p>
      </div>
    </div>
  );
}
