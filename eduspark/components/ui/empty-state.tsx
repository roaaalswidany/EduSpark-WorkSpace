// eduspark/components/ui/empty-state.tsx
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center py-16 px-6",
        className
      )}
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 blur-3xl bg-violet-500/20 rounded-full" />
        <div className="relative w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/50 flex items-center justify-center">
          <Icon className="w-7 h-7 text-slate-400" strokeWidth={1.75} />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>

      {description && (
        <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
          {description}
        </p>
      )}

      {action &&
        (action.href ? (
          <Link
            href={action.href}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
          >
            {action.label}
          </button>
        ))}
    </div>
  );
}