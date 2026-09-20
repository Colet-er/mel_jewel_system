import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export function Brand({ collapsed }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-16 items-center border-b border-border transition-all duration-200",
        collapsed ? "justify-center px-2" : "gap-3 px-5"
      )}
    >
      <div
        title="Daily Pearls PH"
        className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary/20 bg-primary/10 p-1"
      >
        <Image
          src="/images/a_clean_graphic_logo_on_a_transparent_background.png"
          alt="Daily Pearls PH Logo"
          width={32}
          height={32}
          className="h-full w-full object-contain"
          priority
        />
      </div>
      {!collapsed ? (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-xs font-bold tracking-[0.1em] text-foreground">
            DAILY PEARLS PH
          </p>
          <p className="text-[11px] text-muted">Order Management</p>
        </div>
      ) : null}
    </div>
  );
}
