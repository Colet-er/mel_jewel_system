"use client";

import { useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
  placeholder?: string;
  className?: string;
}

/** Updates the `q` query param (debounced) so server components refilter data. */
export function SearchInput({ placeholder = "Search…", className }: SearchInputProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    if (timer.current) clearTimeout(timer.current);

    timer.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, 300);
  }

  return (
    <div className={className}>
      <label className="sr-only" htmlFor="table-search">
        Search
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          aria-hidden
        />
        <Input
          id="table-search"
          type="search"
          defaultValue={searchParams.get("q") ?? ""}
          onChange={handleChange}
          placeholder={placeholder}
          className="h-10 w-full pl-9 sm:w-64"
        />
      </div>
    </div>
  );
}
