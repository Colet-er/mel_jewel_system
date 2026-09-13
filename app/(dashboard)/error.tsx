"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-danger/30 bg-danger/5 px-6 py-16 text-center"
    >
      <h2 className="text-base font-semibold text-foreground">Something went wrong</h2>
      <p className="mt-1 max-w-md text-sm text-muted">
        An unexpected error occurred while loading this page.
      </p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
