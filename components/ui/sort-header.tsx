"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { SortDir } from "@/lib/utils/sort";
import { cn } from "@/lib/utils/cn";

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="h-3 w-3 opacity-50" aria-hidden />;
  return dir === "asc" ? (
    <ArrowUp className="h-3 w-3 text-pink-light" aria-hidden />
  ) : (
    <ArrowDown className="h-3 w-3 text-pink-light" aria-hidden />
  );
}

const labelClass =
  "inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground";

/** Header button for client-side sorted tables. */
export function SortHeaderButton({
  label,
  active,
  dir,
  onSort,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onSort: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSort}
      className={cn(labelClass, active && "text-foreground")}
      aria-label={`Sort by ${label}${active ? (dir === "asc" ? ", currently A to Z" : ", currently Z to A") : ""}`}
    >
      {label}
      <SortIcon active={active} dir={dir} />
    </button>
  );
}

/**
 * Header link for server-rendered tables: toggles ?sort=&dir= in the URL,
 * keeping every other query param (search, month, year).
 */
export function SortHeaderLink({
  label,
  sortKey,
  activeKey,
  activeDir,
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  activeDir: SortDir;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = sortKey === activeKey;
  const nextDir: SortDir = active && activeDir === "asc" ? "desc" : "asc";

  const params = new URLSearchParams(searchParams?.toString() ?? "");
  params.set("sort", sortKey);
  params.set("dir", nextDir);

  return (
    <Link
      href={`${pathname}?${params.toString()}`}
      scroll={false}
      className={cn(labelClass, active && "text-foreground")}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <SortIcon active={active} dir={activeDir} />
    </Link>
  );
}
