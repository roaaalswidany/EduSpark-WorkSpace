import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "./reset-password-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.resetPassword" });
  return { title: `${t("title")} — EduSpark` };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) {
  const { email, token } = await searchParams;
  const t = await getTranslations("auth.resetPassword");
  const valid = !!email && !!token && /^[a-f0-9]{64}$/.test(token);

  return (
    <AuthCard title={t("title")}>
      {valid ? (
        <ResetPasswordForm email={email!} token={token!} />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-destructive">{t("invalidLinkText")}</p>
          <Link
            href="/auth/forgot-password"
            className="text-sm text-primary hover:text-primary/80"
          >
            {t("requestNewLink")}
          </Link>
        </div>
      )}
    </AuthCard>
  );
}