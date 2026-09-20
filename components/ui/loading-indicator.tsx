import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export interface LoadingIndicatorProps {
  message?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "fullscreen";
}

export function LoadingIndicator({
  message = "Loading...",
  className,
  size = "md",
}: LoadingIndicatorProps) {
  if (size === "fullscreen") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm"
      >
        <div className="flex flex-col items-center gap-4 p-6 text-center">
          <LoadingSpinner size="lg" />
          <p className="text-sm font-medium tracking-wide text-foreground animate-pulse">
            {message}
          </p>
          <span className="sr-only">Loading content, please wait...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex flex-col items-center justify-center py-10 gap-3 text-center", className)}
    >
      <LoadingSpinner size={size} />
      {message ? (
        <p className="text-xs font-medium tracking-wider text-muted uppercase animate-pulse">
          {message}
        </p>
      ) : null}
      <span className="sr-only">Loading content, please wait...</span>
    </div>
  );
}

export function LoadingSpinner({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dimensions = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-16 w-16",
  }[size];

  const logoDimensions = {
    sm: 18,
    md: 28,
    lg: 38,
  }[size];

  return (
    <div className={cn("relative flex items-center justify-center", dimensions)}>
      {/* Outer spinning ring */}
      <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />

      {/* Inner pulsing glow */}
      <div className="absolute inset-1 rounded-full bg-primary/10 animate-ping opacity-25" />

      {/* Center Brand Logo */}
      <div className="relative flex items-center justify-center overflow-hidden rounded-full">
        <Image
          src="/images/a_clean_graphic_logo_on_a_transparent_background.png"
          alt="Loading Daily Pearls PH"
          width={logoDimensions}
          height={logoDimensions}
          className="object-contain"
          priority
        />
      </div>
    </div>
  );
}
