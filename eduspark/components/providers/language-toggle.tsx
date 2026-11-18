"use client";

import { useLanguage } from "@/components/providers/language-provider";
import { cn } from "@/lib/utils";
import { Languages } from "lucide-react";

export function LanguageToggle() {
  const { locale, setLocale } = useLanguage();

  return (
    <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted border border-border">
      <button
        type="button"
        onClick={() => setLocale("en")}
        className={cn(
          "flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border",
          locale === "en"
            ? "bg-card text-foreground shadow-sm border-border"
            : "text-muted-foreground hover:text-foreground hover:bg-card/60 border-transparent"
        )}
      >
        <Languages className="w-4 h-4" />
        English
      </button>
      <button
        type="button"
        onClick={() => setLocale("ar")}
        className={cn(
          "flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all border",
          locale === "ar"
            ? "bg-card text-foreground shadow-sm border-border"
            : "text-muted-foreground hover:text-foreground hover:bg-card/60 border-transparent"
        )}
      >
        <Languages className="w-4 h-4" />
        العربية
      </button>
    </div>
  );
}