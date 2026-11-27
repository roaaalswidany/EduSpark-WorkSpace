import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ErrorContent } from "./error-content";

export default async function AuthErrorPage() {
  const t = await getTranslations("auth.error");
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-muted-foreground text-sm">{t("loading")}</div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}