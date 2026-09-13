"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildCsv } from "@/lib/utils/csv";

interface ExportButtonProps {
  filename: string;
  headers: string[];
  rows: (string | number)[][];
  disabled?: boolean;
}

/** Downloads the currently visible table rows as a CSV file. */
export function ExportButton({ filename, headers, rows, disabled }: ExportButtonProps) {
  function handleExport() {
    const csv = buildCsv(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" onClick={handleExport} disabled={disabled || rows.length === 0}>
      <Download className="h-4 w-4" aria-hidden />
      Export
    </Button>
  );
}
