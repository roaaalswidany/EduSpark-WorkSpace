import Link from "next/link";
import { Briefcase, Package, TrendingUp, Layers, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreatorServicesHeaderProps {
  stats: {
    total: number;
    active: number;
    totalOrders: number;
    totalProjects: number;
  };
}

export function CreatorServicesHeader({ stats }: CreatorServicesHeaderProps) {
  const cards = [
    {
      label: "Total Services",
      value: stats.total,
      icon: Package,
      color: "text-primary",
      bg: "bg-primary/10 border-primary/20",
    },
    {
      label: "Active",
      value: stats.active,
      icon: Layers,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
    },
    {
      label: "Orders",
      value: stats.totalOrders,
      icon: TrendingUp,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
    },
    {
      label: "Projects",
      value: stats.totalProjects,
      icon: Briefcase,
      color: "text-info",
      bg: "bg-info/10 border-info/20",
    },
  ];

  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-primary mb-2">
            <Package className="w-3.5 h-3.5" />
            <span className="uppercase tracking-widest">Creator Studio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
            My Services
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Manage your offerings, track orders, and grow your business.
          </p>
        </div>

        <Link
          href="/dashboard/creator/services/new"
          className={cn(
            "inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl shrink-0",
            "bg-primary hover:bg-primary text-white text-sm font-bold",
            "transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
          )}
        >
          <Plus className="w-4 h-4" />
          New Service
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="rounded-2xl bg-card border border-border p-4 sm:p-5"
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-xl border flex items-center justify-center mb-3",
                  c.bg
                )}
              >
                <Icon className={cn("w-4 h-4", c.color)} />
              </div>
              <p className="text-2xl font-black text-white tabular-nums leading-none">
                {c.value}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70 mt-2">
                {c.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}