/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

/**
 * Segmented theme switcher (Light / Dark / System).
 *
 * - Renders a fixed-size placeholder until mounted to prevent hydration mismatch.
 * - Reads from next-themes (already wired in app/layout.tsx).
 * - Designed for use in /dashboard/settings only (per project requirements).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // SSR / pre-hydration placeholder — same dimensions as the real control
  if (!mounted) {
    return (
      <div
        className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted border border-border h-12"
        aria-hidden
      />
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Color theme"
      className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-muted border border-border"
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => setTheme(opt.value)}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all",
              "border",
              isActive
                ? "bg-card text-foreground shadow-sm border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-card/60 border-transparent"
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}