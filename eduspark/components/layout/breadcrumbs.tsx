import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  truncate?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  className?: string;
}

export function Breadcrumbs({
  items,
  showHome = false,
  className,
}: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex items-center gap-1.5 text-xs text-slate-500 overflow-hidden",
        className
      )}
    >
      {showHome && (
        <>
          <Link
            href="/"
            className="inline-flex items-center gap-1 hover:text-slate-300 transition-colors shrink-0"
            aria-label="Home"
          >
            <Home className="w-3 h-3" />
          </Link>
          <ChevronRight className="w-3 h-3 shrink-0 text-slate-700" />
        </>
      )}

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div key={`${item.label}-${index}`} className="flex items-center gap-1.5 min-w-0">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-slate-300 transition-colors shrink-0"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "shrink-0",
                  isLast && "text-slate-300 font-medium",
                  item.truncate && "truncate max-w-50 sm:max-w-none"
                )}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}

            {!isLast && (
              <ChevronRight className="w-3 h-3 shrink-0 text-slate-700" />
            )}
          </div>
        );
      })}
    </nav>
  );
}