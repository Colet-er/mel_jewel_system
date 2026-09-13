import { AlertTriangle } from "lucide-react";

export interface ErrorStateProps {
  title: string;
  description?: string;
}

export function ErrorState({ title, description }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-danger/30 bg-danger/5 px-6 py-12 text-center"
    >
      <AlertTriangle className="h-8 w-8 text-danger" aria-hidden />
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-muted">{description}</p> : null}
    </div>
  );
}
