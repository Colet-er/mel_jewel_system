"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface MonthYearFilterProps {
  month: number;
  year: number;
  years?: number[];
}

export function MonthYearFilter({ month, year, years }: MonthYearFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const yearOptions =
    years ??
    (() => {
      const currentYear = new Date().getFullYear();
      const list: number[] = [];
      for (let y = currentYear + 1; y >= currentYear - 5; y -= 1) list.push(y);
      return list;
    })();

  function update(key: "month" | "year", value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const selectClass =
    "h-10 rounded-lg border border-white/10 bg-background/55 px-3 text-sm text-foreground shadow-inner shadow-black/5 transition-all duration-200 hover:border-white/20 focus:border-primary focus:bg-background/80 focus:ring-4 focus:ring-primary/10";

  return (
    <div className="flex items-center gap-2">
      <label className="sr-only" htmlFor="month-filter">
        Month
      </label>
      <select
        id="month-filter"
        aria-label="Filter by month"
        value={month}
        onChange={(event) => update("month", event.target.value)}
        className={selectClass}
      >
        {MONTHS.map((name, index) => (
          <option key={name} value={index + 1}>
            {name}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="year-filter">
        Year
      </label>
      <select
        id="year-filter"
        aria-label="Filter by year"
        value={year}
        onChange={(event) => update("year", event.target.value)}
        className={selectClass}
      >
        {yearOptions.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
