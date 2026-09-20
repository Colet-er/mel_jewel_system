import { PageHeader } from "./page-header";
import { Skeleton, StatCardSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { LoadingIndicator } from "@/components/ui/loading-indicator";

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
      <div className="relative rounded-xl border border-border bg-card overflow-hidden">
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/60 backdrop-blur-[2px]">
          <LoadingIndicator message={`Loading ${title}...`} size="md" />
        </div>
        <div className="px-5 pt-5 opacity-40">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="opacity-40">
          <TableSkeleton rows={6} />
        </div>
      </div>
    </div>
  );
}
