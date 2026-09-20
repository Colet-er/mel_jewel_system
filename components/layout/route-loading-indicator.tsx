"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function RouteLoadingIndicator() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentKey = `${pathname}?${searchParams.toString()}`;

  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const isLoading = navigatingTo !== null && navigatingTo !== currentKey;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        target.target === "_blank" ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const currentUrl = window.location.pathname + window.location.search;
      if (href !== currentUrl) {
        startTransition(() => {
          setNavigatingTo(href);
        });
      }
    };

    document.addEventListener("click", handleClick, { capture: true });
    return () => document.removeEventListener("click", handleClick, { capture: true });
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none">
      <div className="h-1 w-full overflow-hidden bg-primary/20">
        <div className="h-full w-1/3 bg-primary animate-[shimmer_1s_infinite_linear] shadow-[0_0_10px_#f63392]" />
      </div>
    </div>
  );
}
