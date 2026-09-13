import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="relative pl-4">
        <span className="absolute inset-y-1 left-0 w-1 rounded-full bg-gradient-to-b from-primary to-pink-light" aria-hidden />
        <h1 className="text-xl font-semibold tracking-[-0.025em] text-foreground sm:text-2xl">
          {title}
        </h1>
        {description ? <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}
