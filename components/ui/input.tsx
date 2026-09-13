import { forwardRef, type InputHTMLAttributes, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, hasError, ...props },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={hasError || undefined}
      className={cn(
        "h-10 w-full rounded-lg border bg-background/55 px-3 text-sm text-foreground shadow-inner shadow-black/5 placeholder:text-muted/55",
        "transition-all duration-200 disabled:cursor-not-allowed disabled:bg-elevated/40 disabled:opacity-60",
        hasError ? "border-danger focus:ring-danger/15" : "border-white/10 hover:border-white/20 focus:border-primary focus:bg-background/80 focus:ring-4 focus:ring-primary/10",
        className
      )}
      {...props}
    />
  );
});

Input.displayName = "Input";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-foreground", className)}
      {...props}
    />
  );
}

export interface FieldErrorProps {
  message?: string | null;
}

export function FieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1.5 text-xs text-danger">
      {message}
    </p>
  );
}
