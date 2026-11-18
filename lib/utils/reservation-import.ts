/**
 * CSV → reservation conversion for the "Import CSV" flow on the Reserved page.
 * Pure functions only (no I/O) so they can run in the browser and in tests.
 *
 * Each CSV row is one item. Rows that share the same FB Name are grouped into
 * one reservation with several items; the downpayment and Order Type
 * (Regular / Pasabuy / COD, blank = Regular) are taken from the first row of
 * that group that has a value. Extra columns (Customer Name, Phone, Address,
 * Discount, Shipping Fee, Payment Method) are still accepted when present but
 * are not part of the template.
 */

import type { ReservationInput, ReservationType } from "@/types";
import { PAYMENT_METHODS } from "@/lib/utils/payment-validation";
import { round2, validateReservationInput } from "@/lib/utils/reservation-validation";

/** Columns in the downloadable (blank) template. */
export const RESERVATION_IMPORT_HEADERS = [
  "FB Name",
  "Item Description",
  "Code",
  "Qty",
  "Unit Price",
  "Downpayment",
  "Order Type",
  "Order Source",
] as const;

/**
 * Method recorded for an imported downpayment when the file has no
 * "Payment Method" column (the template doesn't include one).
 */
export const DEFAULT_IMPORT_PAYMENT_METHOD = "Other";

/** Max reservations accepted in one import (keeps the server action bounded). */
export const MAX_IMPORT_RESERVATIONS = 200;

type ImportField =
  | "fbName"
  | "customerName"
  | "phone"
  | "address"
  | "code"
  | "description"
  | "qty"
  | "unitPrice"
  | "discount"
  | "shippingFee"
  | "downpayment"
  | "paymentMethod"
  | "type"
  | "source";

const HEADER_ALIASES: Record<ImportField, string[]> = {
  fbName: ["fb name", "fbname", "facebook name", "facebook", "fb"],
  customerName: ["customer name", "customer", "name"],
  phone: ["phone", "phone number", "contact", "contact number", "mobile"],
  address: ["address", "delivery address", "shipping address"],
  code: ["code", "item code", "sku"],
  description: ["item description", "description", "item", "item name"],
  qty: ["qty", "quantity"],
  unitPrice: ["unit price", "price", "amount"],
  discount: ["discount"],
  shippingFee: ["shipping fee", "shipping", "sf"],
  downpayment: ["downpayment", "down payment", "dp"],
  paymentMethod: ["payment method", "method", "mode of payment"],
  type: ["order type", "type", "reservation type"],
  source: ["order source", "source", "miner type"],
};

function normalizeHeader(value: string): string {
  return value.replace(/^﻿/, "").trim().toLowerCase().replace(/[_\s]+/g, " ");
}

/** RFC 4180-style parser: quoted fields, escaped quotes, commas/newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Parses "₱1,500.00" / "1500" / "" into a number ("" → fallback). */
function parseMoney(raw: string | undefined, fallback: number): number {
  const cleaned = (raw ?? "").replace(/[₱,\s]/g, "").replace(/^php/i, "");
  if (cleaned === "") return fallback;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : Number.NaN;
}

function normalizeType(raw: string): ReservationType | null {
  const value = raw.trim().toLowerCase();
  if (value === "" || value === "regular") return "regular";
  if (value === "pasabuy") return "pasabuy";
  if (value === "pasabuy cod" || value === "pasabuy_cod") return "pasabuy_cod";
  if (value === "cod" || value === "regular cod" || value === "cash on delivery") return "cod";
  return null;
}

/** Live / Chat, or null when blank. Returns undefined for an unrecognised value. */
function normalizeSource(raw: string): "live" | "chat" | null | undefined {
  const value = raw.trim().toLowerCase();
  if (value === "") return null;
  if (value === "live" || value === "chat") return value;
  return undefined;
}

function normalizeMethod(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return "";
  return PAYMENT_METHODS.find((method) => method.toLowerCase() === value) ?? null;
}

export interface ImportedReservation {
  /** 1-based CSV line numbers (header = line 1) that make up this reservation. */
  lines: number[];
  fbName: string;
  input: ReservationInput;
  /** Grand total (items − discount + shipping) for the preview. */
  total: number;
  error: string | null;
}

export interface ReservationImportResult {
  reservations: ImportedReservation[];
  /** File-level problems (missing headers, empty file). */
  fileError: string | null;
}

export function buildReservationsFromCsv(text: string): ReservationImportResult {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return { reservations: [], fileError: "The file has no data rows. Use the template and add one item per row." };
  }

  const headerRow = rows[0].map(normalizeHeader);
  const columnIndex = {} as Record<ImportField, number>;
  for (const field of Object.keys(HEADER_ALIASES) as ImportField[]) {
    columnIndex[field] = headerRow.findIndex((header) => HEADER_ALIASES[field].includes(header));
  }

  const missing: string[] = [];
  if (columnIndex.fbName < 0) missing.push("FB Name");
  if (columnIndex.description < 0) missing.push("Item Description");
  if (columnIndex.unitPrice < 0) missing.push("Unit Price");
  if (missing.length > 0) {
    return { reservations: [], fileError: `Missing required column(s): ${missing.join(", ")}.` };
  }

  const cell = (row: string[], field: ImportField) =>
    columnIndex[field] >= 0 ? (row[columnIndex[field]] ?? "").trim() : "";

  // Group rows by FB name (case-insensitive), preserving first-seen order.
  const groups = new Map<string, { lines: number[]; rows: string[][] }>();
  const orphanErrors: ImportedReservation[] = [];

  rows.slice(1).forEach((row, index) => {
    const line = index + 2;
    const fbName = cell(row, "fbName");
    if (!fbName) {
      orphanErrors.push({
        lines: [line],
        fbName: "—",
        input: emptyInput(),
        total: 0,
        error: `Line ${line}: FB Name is required.`,
      });
      return;
    }
    const key = fbName.toLowerCase();
    const group = groups.get(key) ?? { lines: [], rows: [] };
    group.lines.push(line);
    group.rows.push(row);
    groups.set(key, group);
  });

  const reservations: ImportedReservation[] = [];

  for (const group of groups.values()) {
    const first = (field: ImportField) =>
      group.rows.map((row) => cell(row, field)).find((value) => value !== "") ?? "";

    let error: string | null = null;
    const items = group.rows.map((row, i) => {
      const line = group.lines[i];
      const qtyRaw = cell(row, "qty");
      const quantity = qtyRaw === "" ? 1 : Number(qtyRaw.replace(/,/g, ""));
      const unitPrice = parseMoney(cell(row, "unitPrice"), Number.NaN);
      if (!error && !cell(row, "description")) error = `Line ${line}: Item Description is required.`;
      if (!error && (!Number.isInteger(quantity) || quantity < 1)) error = `Line ${line}: Qty must be a whole number of at least 1.`;
      if (!error && (!Number.isFinite(unitPrice) || unitPrice < 0)) error = `Line ${line}: Unit Price must be a number (0 or more).`;
      return {
        itemName: cell(row, "description"),
        itemCode: cell(row, "code") || undefined,
        quantity: Number.isFinite(quantity) ? quantity : 1,
        unitPrice: Number.isFinite(unitPrice) ? round2(unitPrice) : 0,
      };
    });

    const discount = parseMoney(first("discount"), 0);
    const shippingFee = parseMoney(first("shippingFee"), 0);
    const downpayment = parseMoney(first("downpayment"), 0);
    const type = normalizeType(first("type"));
    const method = normalizeMethod(first("paymentMethod"));
    const source = normalizeSource(first("source"));

    if (!error && !Number.isFinite(discount)) error = "Discount must be a number.";
    if (!error && source === undefined) error = `Order Source "${first("source")}" is not valid. Use Live or Chat, or leave it blank.`;
    if (!error && !Number.isFinite(shippingFee)) error = "Shipping Fee must be a number.";
    if (!error && !Number.isFinite(downpayment)) error = "Downpayment must be a number.";
    if (!error && type === null) error = `Order Type "${first("type")}" is not valid. Use Regular, Regular COD, Pasabuy, or Pasabuy COD.`;
    if (!error && method === null) {
      error = `Payment Method "${first("paymentMethod")}" is not valid. Use ${PAYMENT_METHODS.join(", ")}.`;
    }

    const subtotal = round2(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
    const fbName = cell(group.rows[0], "fbName");
    const input: ReservationInput = {
      fbName,
      customerName: first("customerName"),
      customerAddress: first("address"),
      phone: first("phone"),
      items,
      amount: subtotal,
      discount: Number.isFinite(discount) ? round2(discount) : 0,
      shippingFee: Number.isFinite(shippingFee) ? round2(shippingFee) : 0,
      downpayment: Number.isFinite(downpayment) ? round2(downpayment) : 0,
      downpaymentMethod: method || (downpayment > 0 ? DEFAULT_IMPORT_PAYMENT_METHOD : ""),
      type: type ?? "regular",
      orderSource: source ?? null,
    };

    if (!error) error = validateReservationInput(input);

    reservations.push({
      lines: group.lines,
      fbName,
      input,
      total: round2(subtotal - input.discount + input.shippingFee),
      error,
    });
  }

  const all = [...reservations, ...orphanErrors];
  if (reservations.length > MAX_IMPORT_RESERVATIONS) {
    return {
      reservations: all,
      fileError: `This file has ${reservations.length} reservations. Import at most ${MAX_IMPORT_RESERVATIONS} at a time.`,
    };
  }
  return { reservations: all, fileError: null };
}

function emptyInput(): ReservationInput {
  return {
    customerName: "",
    customerAddress: "",
    phone: "",
    items: [],
    amount: 0,
    discount: 0,
    shippingFee: 0,
    downpayment: 0,
    downpaymentMethod: "",
    type: "regular",
  };
}
