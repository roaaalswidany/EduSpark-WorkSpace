"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { resendVerificationEmailAction } from "@/actions/auth/verify-email";

export function VerifyEmailBanner() {
  const t = useTranslations("verifyEmailBanner");
  const [msg, setMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-400">
      <span className="flex-1 min-w-50">
        {t("message")}
      </span>
      {msg ? (
        <span className="text-amber-700 dark:text-amber-300 font-medium">{msg}</span>
      ) : (
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const r = await resendVerificationEmailAction();
              setMsg(r.success ? t("successMsg") : (r.error || t("fallbackError")));
            })
          }
          className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 font-medium disabled:opacity-50 transition-colors shadow-sm"
        >
          {isPending ? t("sending") : t("resendBtn")}
        </button>
      )}
    </div>
  );
}