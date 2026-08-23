import { describe, expect, it } from "vitest";
import { formatCurrency, formatDate } from "@/lib/utils/format";

describe("formatCurrency", () => {
  it("formats positive amounts", () => {
    expect(formatCurrency(1500)).toContain("1,500");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toContain("0");
  });
});

describe("formatDate", () => {
  it("formats an ISO date string", () => {
    expect(formatDate("2026-08-21T00:00:00Z")).toMatch(/2026/);
  });

  it("accepts Date objects", () => {
    expect(formatDate(new Date("2026-01-15"))).toMatch(/2026/);
  });
});
