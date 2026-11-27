"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { resetPasswordAction } from "@/actions/auth/password-reset";
import { buttonClass, inputClass } from "@/components/auth/auth-card";

export function ResetPasswordForm({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const t = useTranslations("auth.resetPassword");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await resetPasswordAction({
        email,
        token,
        password,
        confirmPassword,
      });
      if (res.success) setDone(true);
      else
        setError(
          res.fieldErrors?.password?.[0] ??
            res.fieldErrors?.confirmPassword?.[0] ??
            res.error
        );
    });
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {t("successMessage")}
        </p>
        <Link href="/auth/login" className={buttonClass}>
          {t("signInButton")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {t("resettingFor", { email })}
      </p>
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          {t("passwordLabel")}
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isPending}
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground mt-1.5">
          {t("passwordRulesHint")}
        </p>
      </div>
      <div>
        <label
          htmlFor="confirm"
          className="block text-sm font-medium text-foreground mb-1.5"
        >
          {t("confirmPasswordLabel")}
        </label>
        <input
          id="confirm"
          type="password"
          required
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={isPending}
          className={inputClass}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <button
        type="submit"
        disabled={isPending || !password}
        className={buttonClass}
      >
        {isPending ? t("submittingButton") : t("changePasswordButton")}
      </button>
    </form>
  );
}