"use client";

import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search,
  X,
  SlidersHorizontal,
  Package,
  Clock,
  Star,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ServiceCardData {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail: string | null;
  price: number;
  deliveryDays: number;
  revisions: number;
  tags: string[];
  portfolioLinks: string[];
  createdAt: string;
  creator: {
    id: string;
    name: string;
    image: string | null;
    headline: string | null;
  };
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  _count: {
    orders: number;
  };
}

export interface CategoryFilterOption {
  id: string;
  name: string;
  slug: string;
}

type SortOrder = "newest" | "price_asc" | "price_desc" | "popular";

interface CatalogClientProps {
  initialServices: ServiceCardData[];
  categories: CategoryFilterOption[];
}

// ─── Thumbnail Gradient Map ───────────────────────────────────────────────────

const GRADIENTS = [
  "from-violet-600 to-indigo-700",
  "from-rose-600 to-pink-700",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-blue-700",
  "from-fuchsia-600 to-purple-700",
  "from-red-500 to-rose-700",
  "from-lime-500 to-green-700",
] as const;

function getGradient(id: string): string {
  const code = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return GRADIENTS[code % GRADIENTS.length];
}

// ─── Creator Avatar ───────────────────────────────────────────────────────────

function CreatorAvatar({
  name,
  image,
  size = 28,
}: {
  name: string;
  image: string | null;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const hue = name
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover ring-2 ring-slate-700"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold ring-2 ring-slate-700 shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: `hsl(${hue}, 55%, 42%)`,
      }}
    >
      {initials}
    </div>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({ service }: { service: ServiceCardData }) {
  const gradient = getGradient(service.id);

  return (
    <Link
      href={`/marketplace/services/${service.slug}`}
      className="group block"
    >
      <article className="h-full rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-2xl hover:shadow-indigo-500/8">

        {/* Thumbnail */}
        <div
          className={cn(
            "relative w-full aspect-[16/9] bg-gradient-to-br overflow-hidden shrink-0",
            gradient
          )}
        >
          {service.thumbnail ? (
            <Image
              src={service.thumbnail}
              alt={service.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span
                className="font-black text-white/20 select-none"
                style={{ fontSize: "clamp(3rem, 8vw, 5rem)" }}
              >
                {service.title.charAt(0)}
              </span>
            </div>
          )}

          {/* Category badge */}
          {service.category && (
            <div className="absolute bottom-2.5 left-2.5">
              <span className="px-2 py-1 rounded-lg bg-black/55 backdrop-blur-sm text-white text-[10px] font-semibold tracking-wide">
                {service.category.name}
              </span>
            </div>
          )}

          {/* Certified badge */}
          <div className="absolute top-2.5 right-2.5">
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-black/55 backdrop-blur-sm text-amber-400">
              <ShieldCheck className="w-3 h-3" />
              <span className="text-[9px] font-bold uppercase tracking-wider">
                Certified
              </span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 p-4 gap-3">

          {/* Creator row */}
          <div className="flex items-center gap-2">
            <CreatorAvatar
              name={service.creator.name}
              image={service.creator.image}
              size={26}
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-400 truncate group-hover:text-slate-300 transition-colors">
                {service.creator.name}
              </p>
            </div>
            {service._count.orders > 0 && (
              <div className="flex items-center gap-0.5 text-[10px] text-slate-600">
                <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                <span className="text-slate-500 font-medium">
                  {service._count.orders}
                </span>
              </div>
            )}
          </div>

          {/* Title */}
          <h3 className="text-sm font-semibold text-slate-300 line-clamp-2 leading-snug group-hover:text-white transition-colors flex-1">
            {service.title}
          </h3>

          {/* Tags */}
          {service.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {service.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-500 text-[10px] font-medium"
                >
                  #{tag}
                </span>
              ))}
              {service.tags.length > 3 && (
                <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-600 text-[10px]">
                  +{service.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Price + delivery row */}
          <div className="flex items-end justify-between pt-2.5 border-t border-slate-800">
            <div className="flex items-center gap-1.5 text-slate-500 text-xs">
              <Clock className="w-3 h-3" />
              <span>{service.deliveryDays}d delivery</span>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-medium text-slate-600 uppercase tracking-wider">
                From
              </p>
              <p className="text-lg font-black text-white leading-none">
                ${service.price % 1 === 0 ? service.price : service.price.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}

// ─── Sort Dropdown ────────────────────────────────────────────────────────────

const SORT_LABELS: Record<SortOrder, string> = {
  newest: "Newest First",
  price_asc: "Price: Low → High",
  price_desc: "Price: High → Low",
  popular: "Most Popular",
};

function SortDropdown({
  value,
  onChange,
}: {
  value: SortOrder;
  onChange: (v: SortOrder) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium",
          "bg-slate-900 border border-slate-800 text-slate-400",
          "hover:border-slate-700 hover:text-slate-200 transition-all"
        )}
      >
        <SlidersHorizontal className="w-3.5 h-3.5" />
        <span>{SORT_LABELS[value]}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl shadow-black/40 overflow-hidden z-20">
          {(Object.keys(SORT_LABELS) as SortOrder[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-4 py-2.5 text-sm transition-colors",
                key === value
                  ? "bg-indigo-500/10 text-indigo-300 font-semibold"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              )}
            >
              {SORT_LABELS[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  query,
  hasFilters,
  onClear,
}: {
  query: string;
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center col-span-full">
      <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mb-5">
        <Search className="w-8 h-8 text-slate-600" />
      </div>
      <h3 className="text-lg font-bold text-slate-300 mb-2">
        {query ? `No results for "${query}"` : "No services available"}
      </h3>
      <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
        {query
          ? "Try a different search term or browse by category."
          : "Check back soon — creators are completing certifications daily."}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-5 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

// ─── Main Catalog Component ───────────────────────────────────────────────────

export function CatalogClient({
  initialServices,
  categories,
}: CatalogClientProps) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  // Debounce search input — 280ms gives snappy feel without thrashing
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput.trim()), 280);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Filtered + sorted services (pure client-side, no re-fetch needed)
  const filtered = useMemo(() => {
    let result = [...initialServices];

    if (activeCategoryId) {
      result = result.filter((s) => s.category?.id === activeCategoryId);
    }

    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.toLowerCase().includes(q)) ||
          s.creator.name.toLowerCase().includes(q) ||
          s.category?.name.toLowerCase().includes(q)
      );
    }

    switch (sortOrder) {
      case "price_asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "popular":
        result.sort((a, b) => b._count.orders - a._count.orders);
        break;
      default:
        result.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }

    return result;
  }, [initialServices, activeCategoryId, debouncedQuery, sortOrder]);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setDebouncedQuery("");
  }, []);

  const clearAll = useCallback(() => {
    setSearchInput("");
    setDebouncedQuery("");
    setActiveCategoryId(null);
    setSortOrder("newest");
  }, []);

  const hasActiveFilters =
    !!debouncedQuery || !!activeCategoryId || sortOrder !== "newest";

  // Stats derived from full dataset
  const totalCreators = useMemo(
    () => new Set(initialServices.map((s) => s.creator.id)).size,
    [initialServices]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-16 pb-12 px-4 overflow-hidden">
        {/* Background radial glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.12), transparent)",
          }}
        />

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            All creators are EduSpark certified
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4 leading-[1.1]">
            Hire{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Certified
            </span>{" "}
            Experts
          </h1>

          <p className="text-slate-400 text-lg leading-relaxed mb-8 max-w-xl mx-auto">
            Every creator proved their skills through our rigorous course
            program — your work is in trusted hands.
          </p>

          {/* Search bar */}
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 pointer-events-none" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search services, skills, or creators…"
              className={cn(
                "w-full pl-12 pr-12 py-4 rounded-2xl text-sm",
                "bg-slate-900 border border-slate-700 text-slate-200",
                "placeholder:text-slate-600",
                "focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
                "transition-all shadow-xl shadow-black/20"
              )}
            />
            {searchInput && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Stats strip */}
          <div className="flex items-center justify-center gap-6 mt-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-400" />
              <span>
                <span className="text-white font-bold">
                  {initialServices.length}
                </span>{" "}
                services
              </span>
            </div>
            <div className="w-px h-4 bg-slate-800" />
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-violet-400" />
              <span>
                <span className="text-white font-bold">{totalCreators}</span>{" "}
                experts
              </span>
            </div>
            <div className="w-px h-4 bg-slate-800" />
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>
                <span className="text-white font-bold">100%</span> certified
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Category pills */}
          <div className="flex items-center gap-2 py-3 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveCategoryId(null)}
              className={cn(
                "shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all",
                activeCategoryId === null
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              )}
            >
              All Services
            </button>

            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() =>
                  setActiveCategoryId(
                    activeCategoryId === cat.id ? null : cat.id
                  )
                }
                className={cn(
                  "shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap",
                  activeCategoryId === cat.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25"
                    : "bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Catalog content ───────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* Results bar */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500">
              <span className="text-white font-semibold">{filtered.length}</span>{" "}
              {filtered.length === 1 ? "service" : "services"}
              {debouncedQuery && (
                <span className="text-slate-600">
                  {" "}
                  for &ldquo;
                  <span className="text-slate-400">{debouncedQuery}</span>
                  &rdquo;
                </span>
              )}
            </p>

            {hasActiveFilters && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
              >
                <X className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>

          <SortDropdown value={sortOrder} onChange={setSortOrder} />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.length > 0 ? (
            filtered.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))
          ) : (
            <EmptyState
              query={debouncedQuery}
              hasFilters={hasActiveFilters}
              onClear={clearAll}
            />
          )}
        </div>
      </div>
    </div>
  );
}