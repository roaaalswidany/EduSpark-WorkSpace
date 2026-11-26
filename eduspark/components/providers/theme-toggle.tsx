/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const t = useTranslations("themeToggle");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const OPTIONS = [
    { value: "light", label: t("light"), icon: Sun },
    { value: "dark", label: t("dark"), icon: Moon },
    { value: "system", label: t("system"), icon: Monitor },
  ] as const;

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
      aria-label={t("group")}
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