import { Package } from "lucide-react";

export function Brand() {
  return (
    <div className="flex items-center gap-3 px-5 py-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
        <Package className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-bold tracking-wide text-foreground">COMPANY NAME</p>
        <p className="text-xs text-muted">Order Management</p>
      </div>
    </div>
  );
}
