import { describe, expect, it } from "vitest";
import {
  DEFAULT_IMPORT_PAYMENT_METHOD,
  RESERVATION_IMPORT_HEADERS,
  buildReservationsFromCsv,
  parseCsv,
} from "@/lib/utils/reservation-import";
import { buildCsv } from "@/lib/utils/csv";

// Template order: FB Name, Item Description, Code, Qty, Unit Price, Downpayment, Order Type
const header = RESERVATION_IMPORT_HEADERS.join(",");

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, embedded commas/newlines, CRLF and BOM", () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","he said ""hi"""\r\n"multi\nline",z\r\n\r\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["x, y", 'he said "hi"'],
      ["multi\nline", "z"],
    ]);
  });
});

describe("reservation import template", () => {
  it("has exactly the requested columns (incl. Order Type) and no sample data", () => {
    expect([...RESERVATION_IMPORT_HEADERS]).toEqual([
      "FB Name",
      "Item Description",
      "Code",
      "Qty",
      "Unit Price",
      "Downpayment",
      "Order Type",
    ]);
    const csv = buildCsv([...RESERVATION_IMPORT_HEADERS], []);
    expect(parseCsv(csv)).toHaveLength(1);
    expect(buildReservationsFromCsv(csv).fileError).toMatch(/no data rows/);
  });
});

describe("buildReservationsFromCsv", () => {
  it("groups rows by FB name into one multi-item reservation", () => {
    const csv = [
      header,
      "Maria S.,Freshwater pearl necklace,PRL-001,1,1500,500",
      "maria s.,Pearl stud earrings,PRL-002,2,450,",
      "Ana Cruz,Gold bracelet,,1,2200,0,cod",
    ].join("\n");
    const { reservations, fileError } = buildReservationsFromCsv(csv);

    expect(fileError).toBeNull();
    expect(reservations).toHaveLength(2);

    const maria = reservations[0];
    expect(maria.error).toBeNull();
    expect(maria.lines).toEqual([2, 3]);
    expect(maria.input.items?.[1]).toMatchObject({ itemName: "Pearl stud earrings", itemCode: "PRL-002", quantity: 2, unitPrice: 450 });
    expect(maria.input.amount).toBe(2400);
    expect(maria.input.downpayment).toBe(500);
    expect(maria.input.downpaymentMethod).toBe(DEFAULT_IMPORT_PAYMENT_METHOD);
    expect(maria.input.type).toBe("regular");

    const ana = reservations[1];
    expect(ana.error).toBeNull();
    expect(ana.input.type).toBe("cod");
    expect(ana.input.downpayment).toBe(0);
    expect(ana.input.downpaymentMethod).toBe("");
  });

  it("accepts peso-formatted prices and a blank Qty as 1", () => {
    const csv = `${header}\nMaria,Ring,,,"₱1,250.50",`;
    const { reservations } = buildReservationsFromCsv(csv);
    expect(reservations[0].input.items?.[0].quantity).toBe(1);
    expect(reservations[0].input.amount).toBe(1250.5);
  });

  it("still accepts optional extra columns such as Payment Method", () => {
    const csv = "FB Name,Item Description,Unit Price,Downpayment,Payment Method\nAna,Ring,1000,200,GCash";
    expect(buildReservationsFromCsv(csv).reservations[0].input.downpaymentMethod).toBe("GCash");
  });

  it("reports missing required columns", () => {
    const { fileError } = buildReservationsFromCsv("Name,Price\nA,1");
    expect(fileError).toMatch(/FB Name/);
    expect(fileError).toMatch(/Item Description/);
  });

  it("flags bad rows instead of importing them", () => {
    const csv = [
      header,
      ",Orphan item,,1,100,",
      "Bad Qty,Ring,,0,100,",
      "Bad Price,Ring,,1,abc,",
      "Too Much DP,Ring,,1,100,500",
      "Bad Type,Ring,,1,100,,Layaway",
    ].join("\n");
    const { reservations } = buildReservationsFromCsv(csv);
    const byName = Object.fromEntries(reservations.map((r) => [r.fbName, r.error]));
    expect(byName["Bad Qty"]).toMatch(/Qty/);
    expect(byName["Bad Price"]).toMatch(/Unit Price/);
    expect(byName["Too Much DP"]).toMatch(/Downpayment cannot exceed/);
    expect(byName["Bad Type"]).toMatch(/Order Type "Layaway" is not valid/);
    expect(byName["—"]).toMatch(/FB Name is required/);
  });
});
