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
}

export function StatCard({ label, value, icon, valueClassName, hint, href }: StatCardProps) {
  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
        <p className={cn("mt-2 truncate text-2xl font-semibold text-foreground", valueClassName)}>
          {value ?? "—"}
        </p>
        {hint ? <p className="mt-1 truncate text-xs text-muted">{hint}</p> : null}
      </div>
      {icon ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15 transition-transform duration-200 group-hover:scale-105">
          {icon}
        </div>
      ) : null}
    </div>
  );

  const surface = (
    <Card className="group overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/15 hover:shadow-[0_16px_40px_rgba(0,0,0,0.18)]">
      <CardContent className="pt-5">{body}</CardContent>
    </Card>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        {surface}
      </Link>
    );
  }

  return surface;
}
