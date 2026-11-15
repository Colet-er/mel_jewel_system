import { describe, expect, it } from "vitest";
import { readSortParams, sortRows } from "@/lib/utils/sort";

describe("sortRows", () => {
  const rows = [
    { fb: "maria", date: "2026-11-02" },
    { fb: "—", date: "2026-11-05" },
    { fb: "Ana", date: "2026-11-01" },
    { fb: "item 10", date: "2026-11-03" },
    { fb: "item 2", date: "2026-11-04" },
  ];

  it("sorts FB names alphabetically, case-insensitive and number-aware, blanks last", () => {
    expect(sortRows(rows, (r) => r.fb, "asc").map((r) => r.fb)).toEqual(["Ana", "item 2", "item 10", "maria", "—"]);
    expect(sortRows(rows, (r) => r.fb, "desc").map((r) => r.fb)).toEqual(["maria", "item 10", "item 2", "Ana", "—"]);
  });

  it("sorts ISO dates chronologically and does not mutate the input", () => {
    const copy = [...rows];
    expect(sortRows(rows, (r) => r.date, "desc")[0].date).toBe("2026-11-05");
    expect(rows).toEqual(copy);
  });
});

describe("readSortParams", () => {
  const keys = ["date", "fbName", "itemName"] as const;
  const fallback = { key: "fbName" as const, dir: "asc" as const };

  it("defaults to FB name A→Z and ignores unknown keys", () => {
    expect(readSortParams({}, keys, fallback)).toEqual({ key: "fbName", dir: "asc" });
    expect(readSortParams({ sort: "evil", dir: "sideways" }, keys, fallback)).toEqual({ key: "fbName", dir: "asc" });
  });

  it("accepts a valid key and direction", () => {
    expect(readSortParams({ sort: "date", dir: "desc" }, keys, fallback)).toEqual({ key: "date", dir: "desc" });
  });
});
