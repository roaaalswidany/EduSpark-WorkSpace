"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X, SlidersHorizontal, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface CoursesFilterBarProps {
  categories: CategoryOption[];
  totalCourses: number;
}

const LEVEL_OPTIONS = [
  { value: "", label: "All levels" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most popular" },
  { value: "rating", label: "Highest rated" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
];

export function CoursesFilterBar({
  categories,
  totalCourses,
}: CoursesFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [searchInput, setSearchInput] = useState(searchParams.get("q") ?? "");
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const activeCategory = searchParams.get("category") ?? "";
  const activeLevel = searchParams.get("level") ?? "";
  const activeSort = searchParams.get("sort") ?? "newest";

  // Debounced search
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (searchInput === current) return;

    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchInput.trim()) params.set("q", searchInput.trim());
      else params.delete("q");
      params.delete("page");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    }, 350);

    return () => clearTimeout(timer);
  }, [searchInput, searchParams, pathname, router]);

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  function clearAll() {
    setSearchInput("");
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  const hasFilters =
    !!searchParams.get("q") ||
    !!activeCategory ||
    !!activeLevel ||
    activeSort !== "newest";

  return (
    <div className="space-y-4">
      {/* Search bar row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search courses..."
            className={cn(
              "w-full h-11 pl-10 pr-10 rounded-xl",
              "bg-slate-900 border border-slate-800 text-slate-200",
              "placeholder:text-slate-600",
              "focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
              "transition-all"
            )}
          />
          {isPending && (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400 animate-spin" />
          )}
          {!isPending && searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Sort dropdown (desktop) */}
        <select
          value={activeSort}
          onChange={(e) => updateFilter("sort", e.target.value)}
          className={cn(
            "hidden sm:block h-11 px-4 rounded-xl",
            "bg-slate-900 border border-slate-800 text-slate-200 text-sm",
            "focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
            "cursor-pointer transition-all"
          )}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Mobile filters toggle */}
        <button
          onClick={() => setShowMobileFilters((v) => !v)}
          className={cn(
            "sm:hidden flex items-center justify-center gap-2 h-11 px-4 rounded-xl",
            "bg-slate-900 border border-slate-800 text-slate-300 text-sm font-medium",
            "active:scale-95 transition-all"
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Category chips (desktop always shown, mobile if toggled) */}
      <div
        className={cn(
          "sm:flex items-center gap-2 flex-wrap",
          showMobileFilters ? "flex" : "hidden"
        )}
      >
        <button
          onClick={() => updateFilter("category", "")}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap",
            !activeCategory
              ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
              : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300"
          )}
        >
          All ({totalCourses})
        </button>
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => updateFilter("category", cat.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap",
                isActive
                  ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300"
              )}
            >
              {cat.name} ({cat.count})
            </button>
          );
        })}
      </div>

      {/* Level chips + sort mobile */}
      <div
        className={cn(
          "items-center gap-2 flex-wrap",
          showMobileFilters ? "flex" : "hidden sm:flex"
        )}
      >
        <span className="text-xs text-slate-600 font-medium">Level:</span>
        {LEVEL_OPTIONS.map((opt) => {
          const isActive = activeLevel === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => updateFilter("level", opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all whitespace-nowrap",
                isActive
                  ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300"
              )}
            >
              {opt.label}
            </button>
          );
        })}

        {/* Mobile sort dropdown */}
        <select
          value={activeSort}
          onChange={(e) => updateFilter("sort", e.target.value)}
          className={cn(
            "sm:hidden ml-auto h-9 px-3 rounded-lg",
            "bg-slate-900 border border-slate-800 text-slate-200 text-xs",
            "focus:outline-none focus:border-indigo-500 cursor-pointer"
          )}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Clear button */}
        {hasFilters && (
          <button
            onClick={clearAll}
            className="ml-auto sm:ml-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}