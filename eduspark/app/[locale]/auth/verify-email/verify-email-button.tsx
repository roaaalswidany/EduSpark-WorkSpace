"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { verifyEmailAction } from "@/actions/auth/verify-email";
import { buttonClass } from "@/components/auth/auth-card";

export function VerifyEmailButton({
  email,
  token,
}: {
  email: string;
  token: string;
}) {
  const t = useTranslations("auth.verifyEmail");
  const [state, setState] = useState<"idle" | "ok" | "error">("idle");
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  if (state === "ok") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {t("confirmedMessage")}
        </p>
        <Link href="/dashboard" className={buttonClass}>
          {t("goToDashboard")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("confirmEmailFor", { email })}
      </p>
      {state === "error" && <p className="text-sm text-destructive">{message}</p>}
      <button
        disabled={isPending}
        className={buttonClass}
        onClick={() =>
          startTransition(async () => {
            const res = await verifyEmailAction({ email, token });
            if (res.success) setState("ok");
            else {
              setState("error");
              setMessage(res.error);
            }
          })
        }
      >
        {isPending ? t("confirmingButton") : t("confirmButton")}
      </button>
    </div>
  );
}