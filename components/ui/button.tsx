import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "border border-primary/70 bg-primary text-white shadow-[0_7px_20px_rgba(255,61,141,0.2)] hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-[0_9px_24px_rgba(255,61,141,0.28)]",
  secondary: "border border-white/10 bg-elevated/80 text-foreground shadow-sm hover:-translate-y-0.5 hover:border-primary/25 hover:bg-elevated",
  ghost: "border border-transparent text-muted hover:bg-white/[0.05] hover:text-foreground",
  danger: "border border-danger/60 bg-danger text-white shadow-[0_7px_20px_rgba(239,68,68,0.16)] hover:-translate-y-0.5 hover:bg-danger/90",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:translate-y-0 active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
});

Button.displayName = "Button";

export function buttonVariants(
  options: { variant?: ButtonProps["variant"]; size?: ButtonProps["size"]; className?: string } = {}
): string {
  const { variant = "primary", size = "md", className } = options;
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:translate-y-0 active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}
