import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.signIn" });
  return { title: `${t("title")} — EduSpark` };
}

export default async function LoginPage() {
  const t = await getTranslations("auth.signIn");

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-muted-foreground text-sm">
            {t("submittingButton")}
          </div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}