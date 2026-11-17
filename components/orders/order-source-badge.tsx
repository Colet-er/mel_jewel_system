import { cn } from "@/lib/utils/cn";

/**
 * Small coloured tag showing where an order was taken (Live or Chat).
 * Renders nothing when the order has no source, so it can sit beside any date.
 */
export function OrderSourceBadge({
  source,
  className,
}: {
  source: "live" | "chat" | null | undefined;
  className?: string;
}) {
  if (!source) return null;
  const isLive = source === "live";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1",
        isLive
          ? "bg-rose-500/15 text-rose-300 ring-rose-400/40"
          : "bg-sky-500/15 text-sky-300 ring-sky-400/40",
        className
      )}
      title={isLive ? "Order taken live" : "Order taken via chat"}
    >
      {isLive ? "Live" : "Chat"}
    </span>
  );
}

/** Any text or link (the FB name, usually) with the source tag placed right beside it. */
export function WithSourceBadge({
  children,
  source,
}: {
  children: React.ReactNode;
  source: "live" | "chat" | null | undefined;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span>{children}</span>
      <OrderSourceBadge source={source} />
    </div>
  );
}
