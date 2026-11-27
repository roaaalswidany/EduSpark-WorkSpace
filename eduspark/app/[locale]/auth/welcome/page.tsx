import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { GraduationCap, ArrowRight } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.welcome" });
  return { title: `${t("title")} — EduSpark` };
}

export default async function WelcomePage() {
  const t = await getTranslations("auth.welcome");

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
          <GraduationCap className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          {t("title")}
        </h1>
        <p className="text-muted-foreground mb-6">{t("subtitle")}</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold transition-colors"
        >
          {t("goToDashboard")}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}