"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, Gem, Layers, Package } from "lucide-react";

export type ProductTab = "all" | "moissanite" | "non-moissanite";
export type ProductSort =
  | "moissanite_first"
  | "non_moissanite_first"
  | "newest"
  | "name_asc"
  | "name_desc"
  | "price_asc"
  | "price_desc";

interface ProductFilterTabsProps {
  currentTab: ProductTab;
  currentSort: ProductSort;
  counts: {
    all: number;
    moissanite: number;
    nonMoissanite: number;
  };
}

export function ProductFilterTabs({
  currentTab,
  currentSort,
  counts,
}: ProductFilterTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all" && value !== "moissanite_first") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const tabs: { id: ProductTab; label: string; icon: typeof Layers; count: number }[] = [
    { id: "all", label: "All Products", icon: Layers, count: counts.all },
    { id: "moissanite", label: "Moissanite", icon: Gem, count: counts.moissanite },
    { id: "non-moissanite", label: "Non-Moissanite", icon: Package, count: counts.nonMoissanite },
  ];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Tabs */}
      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setParam("tab", tab.id)}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                isActive
                  ? tab.id === "moissanite"
                    ? "bg-primary text-white shadow-sm shadow-primary/20"
                    : "bg-white/10 text-foreground shadow-sm"
                  : "text-muted hover:bg-white/[0.05] hover:text-foreground"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  isActive
                    ? "bg-black/30 text-white"
                    : "bg-white/10 text-muted"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sort selection */}
      <div className="flex items-center gap-2">
        <ArrowUpDown className="h-3.5 w-3.5 text-muted shrink-0" aria-hidden />
        <label htmlFor="product-sort" className="text-xs text-muted whitespace-nowrap">
          Sort by:
        </label>
        <select
          id="product-sort"
          value={currentSort}
          onChange={(e) => setParam("sort", e.target.value)}
          className="h-9 rounded-lg border border-white/10 bg-card px-3 text-xs text-foreground transition hover:border-white/20 focus:border-primary focus:outline-none"
        >
          <option value="moissanite_first">Moissanite First</option>
          <option value="non_moissanite_first">Non-Moissanite First</option>
          <option value="newest">Newest First</option>
          <option value="name_asc">Name (A → Z)</option>
          <option value="name_desc">Name (Z → A)</option>
          <option value="price_asc">Price (Low → High)</option>
          <option value="price_desc">Price (High → Low)</option>
        </select>
      </div>
    </div>
  );
}
