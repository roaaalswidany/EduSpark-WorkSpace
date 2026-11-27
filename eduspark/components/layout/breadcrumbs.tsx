"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
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
  const t = useTranslations("breadcrumbs");

  if (items.length === 0) return null;

  return (
    <nav
      aria-label={t("aria")}
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground overflow-hidden",
        className
      )}
    >
      {showHome && (
        <>
          <Link
            href="/"
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors shrink-0"
            aria-label={t("home")}
          >
            <Home className="w-3 h-3" />
          </Link>
          <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground/50 rtl:rotate-180" />
        </>
      )}

      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <div
            key={`${item.label}-${index}`}
            className="flex items-center gap-1.5 min-w-0"
          >
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="hover:text-foreground transition-colors shrink-0"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "shrink-0",
                  isLast && "text-foreground font-medium",
                  item.truncate && "truncate max-w-50 sm:max-w-none"
                )}
                aria-current={isLast ? "page" : undefined}
              >
                {item.label}
              </span>
            )}

            {!isLast && (
              <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground/50 rtl:rotate-180" />
            )}
          </div>
        );
      })}
    </nav>
  );
}