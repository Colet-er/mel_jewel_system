import { PageHeader } from "./page-header";
import { Skeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";

/** Shared loading state for dashboard segments. */
export function PageLoading({
  title,
  withStats = false,
}: {
  title: string;
  withStats?: boolean;
}) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading page">
      <PageHeader title={title} />
      {withStats ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : null}
      <div className="rounded-xl border border-white/[0.07] bg-card">
        <div className="px-5 pt-5">
          <Skeleton className="h-4 w-32" />
        </div>
        <TableSkeleton rows={6} />
      </div>
    </div>
  );
}
