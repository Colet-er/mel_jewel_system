"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface DetailsSection {
  heading: string;
  body: ReactNode;
}

/**
 * "Details" button that opens the order's secondary fields in a dialog centred
 * on the screen, grouped under headings. The dialog closes with the X button,
 * Escape, or a click on the dimmed backdrop. Clicks inside the dialog (e.g.
 * editing a claim code) keep it open.
 */
export function OrderDetailsPopover({ title, sections }: { title: string; sections: DetailsSection[] }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    // Stop the page behind the dialog from scrolling while it is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const dialog = open
    ? createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            // Only a press on the backdrop itself closes it, not presses inside the dialog.
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl"
          >
            <header className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Order details</p>
                <h2 id={titleId} className="truncate text-base font-semibold text-foreground">
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close details"
                className="rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </header>

            <div className="space-y-5 overflow-y-auto px-5 py-4">
              {sections.map((section) => (
                <section key={section.heading} className="space-y-2.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-pink-light">
                    {section.heading}
                  </h3>
                  <dl className="space-y-2.5 text-sm">{section.body}</dl>
                </section>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
          open
            ? "border-primary/50 bg-primary/10 text-pink-light"
            : "border-white/15 text-secondary hover:border-white/30 hover:text-foreground"
        )}
      >
        Details
        <ChevronDown className="h-3.5 w-3.5" aria-hidden />
      </button>
      {dialog}
    </>
  );
}
