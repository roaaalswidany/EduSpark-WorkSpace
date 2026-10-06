"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyMessage?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select an option…",
  emptyMessage = "No matches found.",
  searchPlaceholder = "Search…",
  className,
  disabled = false,
  clearable = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const filtered = query
    ? options.filter((o) => {
        const q = query.toLowerCase();
        return (
          o.label.toLowerCase().includes(q) ||
          (o.description?.toLowerCase().includes(q) ?? false)
        );
      })
    : options;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setQuery("");
        setHighlighted(0);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus input when opening
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Scroll highlighted into view
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(
      `[data-index="${highlighted}"]`
    ) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlighted, open]);

  const handleSelect = useCallback(
    (optValue: string) => {
      onChange(optValue);
      setOpen(false);
      setQuery("");
      setHighlighted(0);
    },
    [onChange]
  );

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      setQuery("");
      setHighlighted(0);
    },
    [onChange]
  );

  const handleOpen = () => {
    if (disabled) return;
    const next = !open;
    setOpen(next);
    if (!next) {
      setQuery("");
      setHighlighted(0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlighted];
      if (opt && !opt.disabled) handleSelect(opt.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setQuery("");
      setHighlighted(0);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={cn(
          "w-full h-10 flex items-center justify-between gap-2 px-3 rounded-lg",
          "bg-slate-950 border border-slate-700 text-left text-sm",
          "focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
          "transition-all",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "flex items-center gap-2 min-w-0 flex-1",
            selected ? "text-slate-200" : "text-slate-600"
          )}
        >
          {selected?.icon}
          <span className="truncate">
            {selected ? selected.label : placeholder}
          </span>
        </span>

        <span className="flex items-center gap-1 shrink-0">
          {clearable && selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "w-4 h-4 text-slate-500 transition-transform",
              open && "rotate-180"
            )}
          />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl shadow-black/60 overflow-hidden">
          {/* Search input */}
          <div className="relative border-b border-slate-800">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlighted(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="w-full h-10 pl-9 pr-3 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none"
            />
          </div>

          {/* Options list */}
          <div ref={listRef} className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-slate-500">
                {emptyMessage}
              </div>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlighted;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    data-index={idx}
                    disabled={opt.disabled}
                    onMouseEnter={() => setHighlighted(idx)}
                    onClick={() => !opt.disabled && handleSelect(opt.value)}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                      isHighlighted && "bg-slate-800",
                      isSelected && "text-indigo-300",
                      !isSelected && !isHighlighted && "text-slate-300",
                      opt.disabled && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    {opt.icon}
                    <span className="flex-1 min-w-0">
                      <span className="block truncate">{opt.label}</span>
                      {opt.description && (
                        <span className="block text-[10px] text-slate-500 mt-0.5 truncate">
                          {opt.description}
                        </span>
                      )}
                    </span>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}