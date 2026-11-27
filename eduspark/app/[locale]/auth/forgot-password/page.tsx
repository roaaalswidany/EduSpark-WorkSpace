/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { requestPasswordResetAction } from "@/actions/auth/password-reset";
import { AuthCard, buttonClass, inputClass } from "@/components/auth/auth-card";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await requestPasswordResetAction(email);
      if (res.success) setSent(true);
      else setError(res.error);
    });
  }

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            {t("successMessage", { email })}
          </p>
          <Link
            href="/auth/login"
            className="block text-center text-sm text-primary hover:text-primary/80"
          >
            {t("backToLogin")}
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              {t("emailLabel")}
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              placeholder={t("emailPlaceholder")}
              className={inputClass}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={isPending || !email}
            className={buttonClass}
          >
            {isPending ? t("submittingButton") : t("submitButton")}
          </button>
          <Link
            href="/auth/login"
            className="block text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {t("backToLogin")}
          </Link>
        </form>
      )}
    </AuthCard>
  );
}