"use client";

import { useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, FileUp, Upload, X } from "lucide-react";
import { importReservations } from "@/app/(dashboard)/orders/reserved/actions";
import {
  DEFAULT_IMPORT_PAYMENT_METHOD,
  RESERVATION_IMPORT_HEADERS,
  buildReservationsFromCsv,
  type ImportedReservation,
} from "@/lib/utils/reservation-import";
import { buildCsv } from "@/lib/utils/csv";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function ImportReservationsButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <FileUp className="h-4 w-4" aria-hidden />
        Import CSV
      </Button>
      {open ? createPortal(<ImportDialog onClose={() => setOpen(false)} />, document.body) : null}
    </>
  );
}

function downloadTemplate() {
  // Blank template: header row only.
  const csv = buildCsv([...RESERVATION_IMPORT_HEADERS], []);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "reservation-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportedReservation[]>([]);
  const [result, setResult] = useState<{ created: number; failed: { fbName: string; message: string }[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  const validRows = rows.filter((row) => !row.error);
  const invalidRows = rows.filter((row) => row.error);

  async function handleFile(file: File | undefined) {
    setResult(null);
    setRows([]);
    setFileError(null);
    if (!file) return;
    setFileName(file.name);

    if (!/\.csv$/i.test(file.name)) {
      setFileError("Choose a .csv file. In Excel or Google Sheets use File → Save as / Download → CSV.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError("This file is larger than 2 MB. Split it into smaller files.");
      return;
    }

    const parsed = buildReservationsFromCsv(await file.text());
    setFileError(parsed.fileError);
    setRows(parsed.reservations);
  }

  function handleImport() {
    if (validRows.length === 0 || isPending) return;
    startTransition(async () => {
      const response = await importReservations(validRows.map((row) => row.input));
      setResult(response);
      setRows([]);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-reservations-title"
    >
      <div className="w-full max-w-3xl rounded-2xl border border-white/10 bg-card shadow-2xl">
        <header className="flex items-start justify-between border-b border-white/[0.07] px-5 py-4">
          <div>
            <h2 id="import-reservations-title" className="text-lg font-semibold text-foreground">
              Import Reservations from CSV
            </h2>
            <p className="mt-1 text-sm text-muted">
              One item per row. Rows with the same FB Name become one reservation with several items.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            aria-label="Close import"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-elevated hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        <div className="space-y-4 px-5 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-white transition-colors hover:bg-primary-hover">
              <Upload className="h-4 w-4" aria-hidden />
              Choose CSV file
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                disabled={isPending}
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
            </label>
            <Button variant="secondary" size="md" onClick={downloadTemplate}>
              <Download className="h-4 w-4" aria-hidden />
              Download template
            </Button>
            {fileName ? <span className="break-all text-sm text-muted">{fileName}</span> : null}
          </div>

          <p className="text-xs text-muted">
            Columns: {RESERVATION_IMPORT_HEADERS.join(", ")}. Required: FB Name, Item Description, Unit Price.
            Downpayments are recorded with payment method &ldquo;{DEFAULT_IMPORT_PAYMENT_METHOD}&rdquo;.
          </p>

          {fileError ? (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {fileError}
            </p>
          ) : null}

          {result ? (
            <div role="status" className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-emerald-400">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Imported {result.created} reservation{result.created === 1 ? "" : "s"}.
              </p>
              {result.failed.length > 0 ? (
                <ul className="space-y-1 text-danger">
                  {result.failed.map((failure, index) => (
                    <li key={`${failure.fbName}-${index}`}>
                      <span className="font-semibold">{failure.fbName}:</span> {failure.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="rounded-xl border border-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-2.5 text-xs">
                <span className="font-semibold text-foreground">
                  {validRows.length} ready to import
                </span>
                {invalidRows.length > 0 ? (
                  <span className="font-semibold text-danger">
                    {invalidRows.length} with errors (will be skipped)
                  </span>
                ) : null}
              </div>
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] bg-white/[0.02] text-[11px] uppercase tracking-wider text-muted">
                    <th scope="col" className="px-3 py-2">FB Name</th>
                    <th scope="col" className="px-3 py-2">Items</th>
                    <th scope="col" className="px-3 py-2 text-right">Total</th>
                    <th scope="col" className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.05]">
                  {rows.map((row, index) => (
                    <tr key={`${row.fbName}-${index}`}>
                      <td className="break-words px-3 py-2 font-medium text-pink-light">{row.fbName}</td>
                      <td className="break-words px-3 py-2 text-secondary">
                        {(row.input.items ?? []).map((item) => `${item.itemName}${item.quantity > 1 ? ` ×${item.quantity}` : ""}`).join(", ") || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{formatCurrency(row.total)}</td>
                      <td className="px-3 py-2">
                        {row.error ? (
                          <span className="text-danger">{row.error}</span>
                        ) : (
                          <span className="text-emerald-400">Ready</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-white/[0.07] pt-4">
            <Button variant="secondary" onClick={onClose} disabled={isPending}>
              {result ? "Done" : "Cancel"}
            </Button>
            <Button onClick={handleImport} disabled={isPending || validRows.length === 0 || Boolean(fileError)}>
              {isPending
                ? "Importing…"
                : `Import ${validRows.length} Reservation${validRows.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
