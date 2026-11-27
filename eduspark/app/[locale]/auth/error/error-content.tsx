"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AlertCircle, Sparkles } from "lucide-react";

export function ErrorContent() {
  const t = useTranslations("auth.error");
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "Default";

  const messageMap: Record<string, string> = {
    Configuration: t("configurationError"),
    AccessDenied: t("accessDenied"),
    Verification: t("verificationError"),
    Default: t("defaultError"),
  };
  const message = messageMap[error] ?? messageMap.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <Link
          href="/"
          className="flex items-center justify-center gap-2.5 mb-7 group"
        >
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-black text-foreground tracking-tight">
            EduSpark
          </span>
        </Link>

        <div className="w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-7 h-7 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t("title")}
        </h1>
        <p className="text-muted-foreground mb-6">{message}</p>
        <Link
          href="/auth/login"
          className="inline-block px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors"
        >
          {t("backToLogin")}
        </Link>
      </div>
    </div>
  );
}