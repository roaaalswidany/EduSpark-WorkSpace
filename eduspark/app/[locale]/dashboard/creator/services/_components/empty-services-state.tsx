import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Package, Plus } from "lucide-react";

export async function EmptyServicesState() {
  const t = await getTranslations("creatorServices.empty");

  return (
    <div className="rounded-2xl bg-card border border-border p-12 sm:p-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-5">
        <Package className="w-7 h-7 text-primary" />
      </div>
      <h2 className="text-lg font-bold text-foreground mb-1.5">
        {t("title")}
      </h2>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6 leading-relaxed">
        {t("desc")}
      </p>
      <Link
        href="/dashboard/creator/services/new"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
      >
        <Plus className="w-4 h-4" />
        {t("cta")}
      </Link>
    </div>
  );
}