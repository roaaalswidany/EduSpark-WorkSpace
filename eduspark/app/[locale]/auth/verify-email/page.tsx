import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { VerifyEmailButton } from "./verify-email-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.verifyEmail" });
  return { title: `${t("title")} — EduSpark` };
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const { email, token } = await searchParams;
  const t = await getTranslations("auth.verifyEmail");
  const valid = !!email && !!token && /^[a-f0-9]{64}$/.test(token);

  return (
    <AuthCard title={t("title")}>
      {valid ? (
        <VerifyEmailButton email={email!} token={token!} />
      ) : (
        <p className="text-sm text-destructive">{t("invalidLinkText")}</p>
      )}
    </AuthCard>
  );
}