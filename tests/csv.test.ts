import { describe, expect, it } from "vitest";
import { buildCsv } from "@/lib/utils/csv";

describe("buildCsv", () => {
  it("joins headers and rows", () => {
    const csv = buildCsv(["Name", "Total"], [["Widget", 150], ["Gadget", 90]]);
    expect(csv).toBe("Name,Total\nWidget,150\nGadget,90");
  });

  it("escapes commas and quotes", () => {
    const csv = buildCsv(["Note"], [['Paid, in full'], ['He said "hi"']]);
    expect(csv).toBe('Note\n"Paid, in full"\n"He said ""hi"""');
  });
});
