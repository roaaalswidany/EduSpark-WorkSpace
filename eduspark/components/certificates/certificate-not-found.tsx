"use client";

import Link from "next/link";
import { ShieldX } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";

export function CertificateNotFound() {
  const { t } = useLanguage();

  return (
    <div className="min-h-[70vh] bg-background flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20">
          <ShieldX className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">{t("certNotFoundTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("certNotFoundDesc")}
        </p>
        <Link href="/" className="mt-6 inline-block text-sm text-primary hover:text-primary/80">
          {t("backToEduSpark")}
        </Link>
      </div>
    </div>
  );
}