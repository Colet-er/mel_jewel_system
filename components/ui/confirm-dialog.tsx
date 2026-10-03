"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export type ConfirmVariant = "primary" | "danger" | "warning";

export interface ConfirmOptions {
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

export interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

const variantStyles: Record<
  ConfirmVariant,
  {
    icon: typeof AlertCircle;
    iconBg: string;
    iconBorder: string;
    iconText: string;
    headerGlow: string;
    confirmVariant: "primary" | "danger" | "secondary";
  }
> = {
  danger: {
    icon: AlertTriangle,
    iconBg: "bg-danger/10",
    iconBorder: "border-danger/30",
    iconText: "text-danger",
    headerGlow: "from-danger/12 via-danger/[0.04] to-transparent",
    confirmVariant: "danger",
  },
  warning: {
    icon: AlertTriangle,
    iconBg: "bg-amber-500/10",
    iconBorder: "border-amber-500/30",
    iconText: "text-amber-400",
    headerGlow: "from-amber-500/12 via-amber-500/[0.04] to-transparent",
    confirmVariant: "primary",
  },
  primary: {
    icon: HelpCircle,
    iconBg: "bg-primary/10",
    iconBorder: "border-primary/30",
    iconText: "text-pink-light",
    headerGlow: "from-primary/12 via-primary/[0.04] to-transparent",
    confirmVariant: "primary",
  },
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "primary",
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isLoading) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // Autofocus confirm or modal
    const timer = setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, isLoading, onCancel]);

  if (!open) return null;

  const style = variantStyles[variant] || variantStyles.primary;
  const Icon = style.icon;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) {
          onCancel();
        }
      }}
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.12] bg-card shadow-[0_24px_80px_rgba(0,0,0,0.7)] animate-in zoom-in-95 duration-150">
        <div
          className={cn(
            "flex items-start justify-between border-b border-white/[0.08] bg-gradient-to-r px-5 py-4 sm:px-6",
            style.headerGlow
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
                style.iconBg,
                style.iconBorder,
                style.iconText
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-foreground">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg p-1 text-muted transition-colors hover:bg-white/[0.08] hover:text-foreground disabled:opacity-40"
            aria-label="Close confirmation dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <div
            id="confirm-dialog-description"
            className="text-sm leading-relaxed text-secondary"
          >
            {description}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={isLoading}
              onClick={onCancel}
              className="w-full sm:w-auto"
            >
              {cancelLabel}
            </Button>
            <Button
              ref={confirmButtonRef}
              type="button"
              variant={style.confirmVariant}
              size="md"
              disabled={isLoading}
              onClick={onConfirm}
              className="w-full sm:w-auto min-w-[100px]"
            >
              {isLoading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
                  Processing…
                </>
              ) : (
                confirmLabel
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider & Hook for imperative confirmation calls
// ---------------------------------------------------------------------------

type ConfirmContextType = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    open: boolean;
    options: ConfirmOptions;
    resolve?: (value: boolean) => void;
  }>({
    open: false,
    options: {
      title: "",
      description: "",
    },
  });

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({
        open: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, open: false, resolve: undefined }));
  }, [state]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, open: false, resolve: undefined }));
  }, [state]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        open={state.open}
        title={state.options.title}
        description={state.options.description}
        confirmLabel={state.options.confirmLabel}
        cancelLabel={state.options.cancelLabel}
        variant={state.options.variant}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextType {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
}
