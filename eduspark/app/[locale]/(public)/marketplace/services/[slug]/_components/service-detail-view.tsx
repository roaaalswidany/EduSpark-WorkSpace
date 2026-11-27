"use client";

import { useState, useTransition, useCallback } from "react";
import Image from "next/image";
import { useRouter, Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Star, Clock, RotateCcw, ShieldCheck, Package,
  ExternalLink, AlertCircle, Loader2, CheckCircle2,
  User, ArrowRight, Sparkles, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { orderServiceAction } from "@/actions/projects/order-service";

interface ServiceDetail {
  id: string;
  title: string;
  slug: string;
  description: string;
  thumbnail: string | null;
  price: number;
  deliveryDays: number;
  revisions: number;
  tags: string[];
  portfolioLinks: string[];
  createdAt: string;
  orderCount: number;
  creator: { id: string; name: string; headline: string | null; bio: string | null };
  category: { id: string; name: string; slug: string } | null;
}

interface RelatedService {
  id: string;
  title: string;
  slug: string;
  thumbnail: string | null;
  price: number;
  deliveryDays: number;
  creator: { name: string };
}

interface ServiceDetailViewProps {
  service: ServiceDetail;
  relatedServices: RelatedService[];
  isLoggedIn: boolean;
  isOwnService: boolean;
  isAdmin: boolean;
}

const GRADIENTS = [
  "from-emerald-600 to-emerald-700",
  "from-rose-600 to-pink-700",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-blue-700",
  "from-emerald-600 to-purple-700",
  "from-red-500 to-rose-700",
  "from-lime-500 to-green-700",
] as const;

function getGradient(id: string): string {
  const code = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return GRADIENTS[code % GRADIENTS.length];
}

function CreatorAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold ring-2 ring-border shrink-0"
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: `hsl(${hue}, 55%, 42%)`,
      }}
    >
      {initials}
    </div>
  );
}

function OrderDialog({
  service,
  onClose,
}: {
  service: ServiceDetail;
  onClose: () => void;
}) {
  const t = useTranslations("marketplace.orderDialog");
  const router = useRouter();
  const [requirements, setRequirements] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isValid = requirements.trim().length >= 20;

  const handleSubmit = useCallback(() => {
    if (!isValid || isPending) return;
    setError(null);

    const toastId = toast.loading(t("creatingToast"));

    startTransition(async () => {
      const result = await orderServiceAction({
        serviceId: service.id,
        requirements: requirements.trim(),
      });

      if (result.success) {
        toast.success(t("successToast"), {
          id: toastId,
          description: t("successToastDesc"),
        });
        router.push(`/dashboard/projects/${result.projectId}`);
        return;
      }

      const errorMap: Record<string, string> = {
        SERVICE_NOT_FOUND: t("errors.serviceNotFound"),
        SERVICE_INACTIVE: t("errors.serviceInactive"),
        SELF_ORDER: t("errors.selfOrder"),
        INVALID_INPUT: t("errors.invalidInput"),
        UNAUTHORIZED: t("errors.unauthorized"),
        STALE_SESSION: t("errors.staleSession"),
        SERVER_ERROR: t("errors.serverError"),
      };
      const errorMessage = errorMap[result.error] ?? t("errors.generic");

      setError(errorMessage);
      toast.error(t("errorToast"), {
        id: toastId,
        description: errorMessage,
      });
    });
  }, [isValid, isPending, service.id, requirements, router, t]);

  const revisionsText =
    service.revisions === 0
      ? t("revisionsNone")
      : service.revisions === 1
      ? t("revisionsOne")
      : t("revisionsMany", { count: service.revisions });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden animate-scale-in">
        <div className="px-6 py-5 border-b border-border">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
            {t("placeOrder")}
          </p>
          <h2 className="text-lg font-bold text-foreground line-clamp-1">{service.title}</h2>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("total")}</span>
            <span className="text-xl font-black text-foreground tabular-nums">
              ${service.price.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("delivery")}</span>
            <span className="text-foreground">{t("days", { count: service.deliveryDays })}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("revisions")}</span>
            <span className="text-foreground">{revisionsText}</span>
          </div>

          <div className="pt-3 border-t border-border">
            <label htmlFor="requirements" className="block text-sm font-semibold text-foreground mb-2">
              {t("yourRequirements")}
            </label>
            <textarea
              id="requirements"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder={t("requirementsPlaceholder")}
              rows={5}
              maxLength={2000}
              disabled={isPending}
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <p className="text-[10px] text-muted-foreground mt-1.5">{requirements.length}/2000</p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2 bg-background/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-50"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all",
              isValid && !isPending
                ? "bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 shadow-lg shadow-primary/20"
                : "bg-accent text-muted-foreground cursor-not-allowed"
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t("placingOrder")}
              </>
            ) : (
              <>
                {t("confirmOrder")}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ServiceDetailView({
  service,
  relatedServices,
  isLoggedIn,
  isOwnService,
  isAdmin,
}: ServiceDetailViewProps) {
  const t = useTranslations("marketplace.detail");
  const [orderOpen, setOrderOpen] = useState(false);
  const gradient = getGradient(service.id);

  const revisionsText =
    service.revisions === 0
      ? t("revisions", { count: 0 })
      : t("revisions", { count: service.revisions });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-12 items-start">
          {/* Left column */}
          <div className="space-y-6 min-w-0">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3" />
                  {t("certifiedCreator")}
                </div>
                {service.category && (
                  <Link
                    href={`/marketplace?category=${service.category.id}`}
                    className="text-[10px] font-bold uppercase tracking-widest text-primary hover:text-primary/80 transition-colors"
                  >
                    {service.category.name}
                  </Link>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight leading-tight">
                {service.title}
              </h1>
            </div>

            <div
              className={cn(
                "relative aspect-video rounded-2xl overflow-hidden bg-linear-to-br",
                !service.thumbnail && gradient
              )}
            >
              {service.thumbnail ? (
                <Image
                  src={service.thumbnail}
                  alt={service.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span
                    className="font-black text-white/20 select-none"
                    style={{ fontSize: "clamp(4rem, 15vw, 10rem)" }}
                  >
                    {service.title.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {service.orderCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                  <span className="text-foreground font-semibold">
                    {service.orderCount}
                  </span>
                  <span>{t("orderCount", { count: service.orderCount })}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{t("daysDelivery", { count: service.deliveryDays })}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{revisionsText}</span>
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border p-5 sm:p-6">
              <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                {t("aboutService")}
              </h2>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {service.description}
              </p>
            </div>

            {service.tags.length > 0 && (
              <div className="rounded-2xl bg-card border border-border p-5 sm:p-6">
                <h2 className="text-base font-bold text-foreground mb-3">{t("skillsTags")}</h2>
                <div className="flex flex-wrap gap-2">
                  {service.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-accent border border-border text-xs font-medium text-foreground"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {service.portfolioLinks.length > 0 && (
              <div className="rounded-2xl bg-card border border-border p-5 sm:p-6">
                <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  {t("portfolio")}
                </h2>
                <div className="space-y-2">
                  {service.portfolioLinks.map((link, i) => (
                    <a
                      key={i}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-background border border-border hover:border-primary/40 hover:bg-card transition-all group"
                    >
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <ExternalLink className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
                          {link.replace(/^https?:\/\//, "").slice(0, 60)}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-2xl bg-card border border-border p-5 sm:p-6">
              <h2 className="text-base font-bold text-foreground mb-4">{t("aboutCreator")}</h2>
              <div className="flex items-start gap-4">
                <CreatorAvatar name={service.creator.name} size={56} />
                <div className="min-w-0">
                  <Link
                    href={`/profile/${service.creator.id}`}
                    className="text-sm font-bold text-foreground hover:text-primary transition-colors"
                  >
                    {service.creator.name}
                  </Link>
                  {service.creator.headline && (
                    <p className="text-xs text-primary mt-0.5">{service.creator.headline}</p>
                  )}
                  {service.creator.bio && (
                    <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
                      {service.creator.bio}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right column */}
          <aside className="lg:sticky lg:top-20 space-y-4">
            <div className="rounded-2xl bg-card border border-border overflow-hidden">
              <div className="p-5 space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-foreground tabular-nums">
                    ${service.price.toFixed(2)}
                  </span>
                </div>

                {isAdmin ? (
                  <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-medium text-center">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    {t("adminCannotOrder")}
                  </div>
                ) : isOwnService ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-accent text-muted-foreground text-xs font-medium">
                    <User className="w-4 h-4 shrink-0" />
                    {t("ownService")}
                  </div>
                ) : isLoggedIn ? (
                  <button
                    onClick={() => setOrderOpen(true)}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 h-12 rounded-xl",
                      "bg-primary hover:bg-primary/90 text-primary-foreground",
                      "text-sm font-bold transition-all active:scale-[0.98]",
                      "shadow-lg shadow-primary/20"
                    )}
                  >
                    <Package className="w-4 h-4" />
                    {t("orderNow")}
                  </button>
                ) : (
                  <Link
                    href={`/auth/login?callbackUrl=/marketplace/services/${service.slug}`}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 h-12 rounded-xl",
                      "bg-primary hover:bg-primary/90 text-primary-foreground",
                      "text-sm font-bold transition-all active:scale-[0.98]",
                      "shadow-lg shadow-primary/20"
                    )}
                  >
                    {t("signInToOrder")}
                  </Link>
                )}

                <div className="pt-4 border-t border-border space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t("whatIncluded")}
                  </p>
                  <ul className="space-y-2.5">
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      {t("daysDelivery", { count: service.deliveryDays })}
                    </li>
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      {revisionsText}
                    </li>
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      {t("directChat")}
                    </li>
                    <li className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      {t("milestoneWorkflow")}
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t border-border space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">{t("created")}</span>
                    <span className="text-muted-foreground">
                      {new Date(service.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-primary">{t("trustBadgeTitle")}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                  {t("trustBadgeDesc")}
                </p>
              </div>
            </div>
          </aside>
        </div>

        {relatedServices.length > 0 && (
          <div className="mt-16 pt-8 border-t border-border">
            <h2 className="text-lg font-bold text-foreground mb-5">
              {service.category
                ? t("moreFrom", { category: service.category.name })
                : t("moreFromDefault")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedServices.map((rs) => (
                <Link
                  key={rs.id}
                  href={`/marketplace/services/${rs.slug}`}
                  className="group rounded-2xl bg-card border border-border overflow-hidden hover:border-primary/40 transition-all hover:-translate-y-0.5"
                >
                  <div className={cn("relative aspect-video bg-linear-to-br", getGradient(rs.id))}>
                    {rs.thumbnail ? (
                      <Image
                        src={rs.thumbnail}
                        alt={rs.title}
                        fill
                        sizes="(max-width: 640px) 100vw, 25vw"
                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-black text-white/20 text-4xl select-none">
                          {rs.title.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-semibold text-foreground line-clamp-2 leading-snug group-hover:text-primary transition-colors mb-2">
                      {rs.title}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {rs.creator.name.split(" ")[0]}
                      </span>
                      <span className="text-sm font-bold text-foreground tabular-nums">
                        ${rs.price.toFixed(0)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {orderOpen && (
        <OrderDialog service={service} onClose={() => setOrderOpen(false)} />
      )}
    </div>
  );
}