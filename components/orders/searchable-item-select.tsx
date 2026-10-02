"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";

export interface SearchableItemOption {
  id: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  price?: number;
  subtitle?: string | null;
}

interface SearchableItemSelectProps {
  id?: string;
  items: SearchableItemOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
}

export function SearchableItemSelect({
  id,
  items,
  value,
  onChange,
  placeholder = "Select an item…",
  searchPlaceholder = "Search by item name, SKU, or category…",
  disabled = false,
  required = false,
}: SearchableItemSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = items.find((item) => item.id === value);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const filteredItems = items.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    const nameMatch = item.name.toLowerCase().includes(q);
    const skuMatch = item.sku ? item.sku.toLowerCase().includes(q) : false;
    const catMatch = item.category ? item.category.toLowerCase().includes(q) : false;
    const subMatch = item.subtitle ? item.subtitle.toLowerCase().includes(q) : false;
    return nameMatch || skuMatch || catMatch || subMatch;
  });

  function handleSelect(itemId: string) {
    onChange(itemId);
    setIsOpen(false);
    setQuery("");
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Hidden input for HTML form validation if required */}
      {required ? (
        <input
          type="text"
          value={value}
          onChange={() => {}}
          required={required}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      ) : null}

      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex h-11 w-full items-center justify-between rounded-lg border border-white/10 bg-background/70 px-3 py-2 text-left text-sm text-foreground shadow-inner shadow-black/5 transition hover:border-white/20 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 ${
          isOpen ? "border-primary ring-4 ring-primary/10" : ""
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex-1 truncate">
          {selectedItem ? (
            <div className="flex items-center gap-2 truncate">
              {selectedItem.sku ? (
                <span className="shrink-0 font-mono text-xs font-semibold text-pink-light">
                  [{selectedItem.sku}]
                </span>
              ) : null}
              <span className="truncate font-medium text-foreground">{selectedItem.name}</span>
              {selectedItem.price !== undefined ? (
                <span className="shrink-0 text-xs font-semibold text-foreground/80">
                  — {formatCurrency(selectedItem.price)}
                </span>
              ) : null}
            </div>
          ) : (
            <span className="text-muted">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 pl-2">
          {selectedItem && !disabled ? (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleClear(e as unknown as React.MouseEvent);
                }
              }}
              className="rounded p-1 text-muted hover:bg-white/10 hover:text-foreground"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen ? (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-72 w-full overflow-hidden rounded-xl border border-white/15 bg-background shadow-2xl backdrop-blur-xl">
          {/* Search Box */}
          <div className="flex items-center border-b border-white/10 bg-white/[0.03] px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-7 w-full bg-transparent text-xs text-foreground placeholder:text-muted focus:outline-none"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="rounded p-0.5 text-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            ) : null}
          </div>

          {/* Items List */}
          <div className="max-h-56 overflow-y-auto p-1 text-sm [scrollbar-gutter:stable]">
            {filteredItems.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted">
                No items found matching &ldquo;{query}&rdquo;
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === value;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-xs transition ${
                      isSelected
                        ? "bg-primary/15 text-foreground font-medium"
                        : "text-foreground hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.sku ? (
                          <span className="font-mono font-semibold text-pink-light">
                            {item.sku}
                          </span>
                        ) : null}
                        <span className="font-medium text-foreground">{item.name}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted">
                        {item.category ? (
                          <span className="rounded bg-white/[0.05] px-1.5 py-0.5">
                            {item.category}
                          </span>
                        ) : null}
                        {item.subtitle ? <span>{item.subtitle}</span> : null}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.price !== undefined ? (
                        <span className="font-semibold text-pink-light">
                          {formatCurrency(item.price)}
                        </span>
                      ) : null}
                      {isSelected ? (
                        <Check className="h-4 w-4 text-primary shrink-0" aria-hidden="true" />
                      ) : null}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
