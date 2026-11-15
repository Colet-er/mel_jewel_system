export type SortDir = "asc" | "desc";

/** Placeholder values ("—", "") always sort after real values, in either direction. */
function isBlank(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "—";
}

/** Case-insensitive, number-aware text comparison (e.g. "Item 2" before "Item 10"). */
export function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });
}

export type SortValue = string | number | null | undefined;

/**
 * Returns a sorted copy. Strings compare alphabetically, numbers/ISO dates
 * compare naturally, and blanks sink to the bottom. Ties keep input order.
 */
export function sortRows<T>(rows: T[], accessor: (row: T) => SortValue, dir: SortDir): T[] {
  const factor = dir === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: accessor(row) }))
    .sort((left, right) => {
      const a = left.value;
      const b = right.value;
      const aBlank = a === null || a === undefined || (typeof a === "string" && isBlank(a));
      const bBlank = b === null || b === undefined || (typeof b === "string" && isBlank(b));
      if (aBlank || bBlank) {
        if (aBlank && bBlank) return left.index - right.index;
        return aBlank ? 1 : -1;
      }
      const result =
        typeof a === "number" && typeof b === "number" ? a - b : compareText(String(a), String(b));
      return result !== 0 ? result * factor : left.index - right.index;
    })
    .map(({ row }) => row);
}

/** Reads ?sort=&dir= from page search params, falling back to the given default. */
export function readSortParams<K extends string>(
  params: Record<string, string | string[] | undefined>,
  allowed: readonly K[],
  fallback: { key: K; dir: SortDir }
): { key: K; dir: SortDir } {
  const rawKey = typeof params.sort === "string" ? params.sort : "";
  const rawDir = typeof params.dir === "string" ? params.dir : "";
  const key = (allowed as readonly string[]).includes(rawKey) ? (rawKey as K) : fallback.key;
  const dir: SortDir = rawDir === "asc" || rawDir === "desc" ? rawDir : key === fallback.key ? fallback.dir : "asc";
  return { key, dir };
}
