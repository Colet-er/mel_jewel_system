import { cn } from "@/lib/utils/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-elevated", className)} />;
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-3 h-8 w-28" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
