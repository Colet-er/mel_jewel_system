import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "border border-primary bg-primary text-white hover:bg-primary-hover shadow-xs",
  secondary: "border border-border bg-elevated text-foreground hover:bg-[#2e2e3a] hover:border-border/80 shadow-xs",
  ghost: "border border-transparent text-secondary hover:bg-white/[0.04] hover:text-foreground",
  danger: "border border-danger/60 bg-danger text-white hover:bg-danger/90 shadow-xs",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-5 text-sm",
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
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150",
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
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className
  );
}
