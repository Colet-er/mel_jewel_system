import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Card, CardContent } from "./card";

export interface StatCardProps {
  label: string;
  value: string | null;
  icon?: ReactNode;
  valueClassName?: string;
  hint?: string;
  href?: string;
  variant?: "primary" | "warning" | "success" | "danger" | "default";
}

const variantIconStyles: Record<string, string> = {
  primary: "border-primary/25 bg-primary/10 text-primary group-hover:border-primary/40 group-hover:bg-primary/15",
  warning: "border-warning/25 bg-warning/10 text-warning group-hover:border-warning/40 group-hover:bg-warning/15",
  success: "border-success/25 bg-success/10 text-success group-hover:border-success/40 group-hover:bg-success/15",
  danger: "border-danger/25 bg-danger/10 text-danger group-hover:border-danger/40 group-hover:bg-danger/15",
  default: "border-border bg-elevated text-secondary group-hover:border-primary/30 group-hover:text-foreground",
};

const variantCardHoverStyles: Record<string, string> = {
  primary: "hover:border-primary/40",
  warning: "hover:border-warning/40",
  success: "hover:border-success/40",
  danger: "hover:border-danger/40",
  default: "hover:border-border/80",
};

export function StatCard({
  label,
  value,
  icon,
  valueClassName,
  hint,
  href,
  variant = "primary",
}: StatCardProps) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
          {label}
        </p>
        <p className={cn("mt-2 truncate text-3xl font-bold tracking-tight text-foreground", valueClassName)}>
          {value ?? "—"}
        </p>
        {hint ? (
          <p className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-muted">
            {hint}
          </p>
        ) : null}
      </div>
      {icon ? (
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-all duration-150",
            variantIconStyles[variant] || variantIconStyles.primary
          )}
        >
          {icon}
        </div>
      ) : null}
    </div>
  );

  const surface = (
    <Card
      className={cn(
        "group transition-all duration-150",
        variantCardHoverStyles[variant] || variantCardHoverStyles.primary
      )}
    >
      <CardContent className="p-5 sm:p-6">{body}</CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        {surface}
      </Link>
    );
  }

  return surface;
}
