"use client";
import { useLanguage } from "@/components/providers/language-provider";
import { LanguageToggle } from "@/components/providers/language-toggle";
import { Languages } from "lucide-react";

export function LanguageSettingsSection() {
  const { t } = useLanguage();

  return (
    <div className="rounded-2xl bg-card border border-border overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <Languages className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-bold text-foreground">{t("language")}</h2>
      </div>
      <div className="p-5 space-y-3">
        <div>
          <p className="text-sm text-foreground font-medium">{t("language")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("languageDesc")}
          </p>
        </div>
        <LanguageToggle />
      </div>
    </div>
  );
}