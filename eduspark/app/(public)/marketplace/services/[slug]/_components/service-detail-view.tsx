"use client";

import { useState, useTransition, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronRight,
  Star,
  Clock,
  RotateCcw,
  ShieldCheck,
  Package,
  ExternalLink,
  AlertCircle,
  Loader2,
  CheckCircle2,
  User,
  ArrowRight,
  Sparkles,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { orderServiceAction } from "@/actions/projects/order-service";

// ─── Types ──────────────────────────────────────────────────

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
  creator: {
    id: string;
    name: string;
    image: string | null;
    headline: string | null;
    bio: string | null;
  };
  category: { id: string; name: string; slug: string } | null;
}

interface RelatedService {
  id: string;
  title: string;
  slug: string;
  thumbnail: string | null;
  price: number;
  deliveryDays: number;
  creator: { name: string; image: string | null };
}

interface ServiceDetailViewProps {
  service: ServiceDetail;
  relatedServices: RelatedService[];
  isLoggedIn: boolean;
  isOwnService: boolean;
}

// ─── Helpers ────────────────────────────────────────────────

const GRADIENTS = [
  "from-violet-600 to-indigo-700",
  "from-rose-600 to-pink-700",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-blue-700",
  "from-fuchsia-600 to-purple-700",
  "from-red-500 to-rose-700",
  "from-lime-500 to-green-700",
] as const;

function getGradient(id: string): string {
  const code = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return GRADIENTS[code % GRADIENTS.length];
}

function CreatorAvatar({
  name,
  image,
  size = 40,
}: {
  name: string;
  image: string | null;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const hue =
    name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360;

  if (image) {
    return (
      <Image
        src={image}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover ring-2 ring-slate-700"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold ring-2 ring-slate-700 shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `hsl(${hue}, 55%, 42%)`,
      }}
    >
      {initials}
    </div>
  );
}

// ─── Order Dialog ───────────────────────────────────────────

function OrderDialog({
  service,
  onClose,
}: {
  service: ServiceDetail;
  onClose: () => void;
}) {
  const router = useRouter();
  const [requirements, setRequirements] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isValid = requirements.trim().length >= 20;

  const handleSubmit = useCallback(() => {
    if (!isValid || isPending) return;
    setError(null);

    const toastId = toast.loading("Creating your order…");

    startTransition(async () => {
      const result = await orderServiceAction({
        serviceId: service.id,
        requirements: requirements.trim(),
      });

      if (result.success) {
        toast.success("Order created! 🎯", {
          id: toastId,
          description: "Opening your project workspace…",
        });
        // Redirect to the project workspace
        router.push(`/dashboard/projects/${result.projectId}`);
        return;
      }

      const messages: Record<string, string> = {
        SERVICE_NOT_FOUND: "Service not found.",
        SERVICE_INACTIVE: "This service is no longer available.",
        SELF_ORDER: "You can't order your own service.",
        INVALID_INPUT: "Please describe your requirements in more detail.",
        UNAUTHORIZED: "Please sign in to place an order.",
        STALE_SESSION:
          "Your session has expired. Please sign out and sign in again.",
        SERVER_ERROR: "Something went wrong. Please try again.",
      };
      const errorMessage =
        messages[result.error] ?? "Something went wrong. Please try again.";

      setError(errorMessage);
      toast.error("Order failed", {
        id: toastId,
        description: errorMessage,
      });
    });
  }, [isValid, isPending, service.id, requirements, router]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-1">
            Place Order
          </p>
          <h2 className="text-lg font-bold text-white line-clamp-1">
            {service.title}
          </h2>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Total</span>
            <span className="text-xl font-black text-white tabular-nums">
              ${service.price.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Delivery</span>
            <span className="text-slate-300">
              {service.deliveryDays} days
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Revisions</span>
            <span className="text-slate-300">
              {service.revisions === 0
                ? "None"
                : service.revisions === 1
                ? "1 revision"
                : `${service.revisions} revisions`}
            </span>
          </div>

          <div className="pt-3 border-t border-slate-800">
            <label
              htmlFor="requirements"
              className="block text-sm font-semibold text-slate-300 mb-2"
            >
              Your Requirements
            </label>
            <textarea
              id="requirements"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="Describe what you need — the more detail, the better. (min 20 characters)"
              rows={5}
              maxLength={2000}
              disabled={isPending}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            />
            <p className="text-[10px] text-slate-600 mt-1.5">
              {requirements.length}/2000
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-2 bg-slate-950/40">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid || isPending}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all",
              isValid && !isPending
                ? "bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 shadow-lg shadow-indigo-500/20"
                : "bg-slate-800 text-slate-600 cursor-not-allowed"
            )}
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Placing Order…
              </>
            ) : (
              <>
                Confirm Order
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export function ServiceDetailView({
  service,
  relatedServices,
  isLoggedIn,
  isOwnService,
}: ServiceDetailViewProps) {
  const [orderOpen, setOrderOpen] = useState(false);
  const gradient = getGradient(service.id);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Breadcrumb */}
      <div className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-1.5 text-xs text-slate-500">
          <Link
            href="/marketplace"
            className="hover:text-slate-300 transition-colors"
          >
            Marketplace
          </Link>
          {service.category && (
            <>
              <ChevronRight className="w-3 h-3" />
              <Link
                href={`/marketplace?category=${service.category.id}`}
                className="hover:text-slate-300 transition-colors"
              >
                {service.category.name}
              </Link>
            </>
          )}
          <ChevronRight className="w-3 h-3" />
          <span className="text-slate-400 truncate">{service.title}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-12 items-start">
          {/* ── Left column ──────────────────────────────────── */}
          <div className="space-y-6 min-w-0">
            {/* Title + tags */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3 h-3" />
                  Certified Creator
                </div>
                {service.category && (
                  <Link
                    href={`/marketplace?category=${service.category.id}`}
                    className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    {service.category.name}
                  </Link>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight leading-tight">
                {service.title}
              </h1>
            </div>

            {/* Hero image */}
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
                    className="font-black text-white/15 select-none"
                    style={{ fontSize: "clamp(4rem, 15vw, 10rem)" }}
                  >
                    {service.title.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              {service.orderCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span className="text-slate-300 font-semibold">
                    {service.orderCount}
                  </span>
                  <span>
                    {service.orderCount === 1 ? "order" : "orders"}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>{service.deliveryDays} days delivery</span>
              </div>
              <div className="flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>
                  {service.revisions === 0
                    ? "No revisions"
                    : `${service.revisions} ${
                        service.revisions === 1 ? "revision" : "revisions"
                      }`}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6">
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                About This Service
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {service.description}
              </p>
            </div>

            {/* Tags */}
            {service.tags.length > 0 && (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6">
                <h2 className="text-base font-bold text-white mb-3">
                  Skills & Tags
                </h2>
                <div className="flex flex-wrap gap-2">
                  {service.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Portfolio */}
            {service.portfolioLinks.length > 0 && (
              <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6">
                <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  Portfolio
                </h2>
                <div className="space-y-2">
                  {service.portfolioLinks.map((link, i) => (
                    <a
                      key={i}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg bg-slate-950 border border-slate-800 hover:border-indigo-500/40 hover:bg-slate-900 transition-all group"
                    >
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-400 truncate group-hover:text-slate-200 transition-colors">
                          {link.replace(/^https?:\/\//, "").slice(0, 60)}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-indigo-400 transition-colors shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* About the creator */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6">
              <h2 className="text-base font-bold text-white mb-4">
                About the Creator
              </h2>
              <div className="flex items-start gap-4">
                <CreatorAvatar
                  name={service.creator.name}
                  image={service.creator.image}
                  size={56}
                />
                <div className="min-w-0">
                  <Link
                    href={`/profile/${service.creator.id}`}
                    className="text-sm font-bold text-white hover:text-indigo-400 transition-colors"
                  >
                    {service.creator.name}
                  </Link>
                  {service.creator.headline && (
                    <p className="text-xs text-indigo-400 mt-0.5">
                      {service.creator.headline}
                    </p>
                  )}
                  {service.creator.bio && (
                    <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                      {service.creator.bio}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right column (sticky sidebar) ──────────────────── */}
          <aside className="lg:sticky lg:top-20 space-y-4">
            {/* Pricing card */}
            <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
              <div className="p-5 space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white tabular-nums">
                    ${service.price.toFixed(2)}
                  </span>
                </div>

                {/* CTA */}
                {isOwnService ? (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-800 text-slate-400 text-xs font-medium">
                    <User className="w-4 h-4 shrink-0" />
                    This is your own service
                  </div>
                ) : isLoggedIn ? (
                  <button
                    onClick={() => setOrderOpen(true)}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 h-12 rounded-xl",
                      "bg-indigo-600 hover:bg-indigo-500 text-white",
                      "text-sm font-bold transition-all active:scale-[0.98]",
                      "shadow-lg shadow-indigo-500/20"
                    )}
                  >
                    <Package className="w-4 h-4" />
                    Order Now
                  </button>
                ) : (
                  <Link
                    href={`/auth/login?callbackUrl=/marketplace/services/${service.slug}`}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 h-12 rounded-xl",
                      "bg-indigo-600 hover:bg-indigo-500 text-white",
                      "text-sm font-bold transition-all active:scale-[0.98]",
                      "shadow-lg shadow-indigo-500/20"
                    )}
                  >
                    Sign in to order
                  </Link>
                )}

                {/* Features */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                    What&apos;s included
                  </p>
                  <ul className="space-y-2.5">
                    <li className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      {service.deliveryDays} days delivery
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      {service.revisions === 0
                        ? "No revisions"
                        : service.revisions === 1
                        ? "1 revision"
                        : `${service.revisions} revisions`}
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      Direct chat with creator
                    </li>
                    <li className="flex items-center gap-2 text-xs text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      Milestone-based workflow
                    </li>
                  </ul>
                </div>

                {/* Meta */}
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Created</span>
                    <span className="text-slate-400">
                      {new Date(service.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust badge */}
            <div className="rounded-2xl bg-indigo-500/5 border border-indigo-500/20 p-4 flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-indigo-300">
                  EduSpark Certified
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  This creator has proven their skills through our rigorous
                  certification program.
                </p>
              </div>
            </div>
          </aside>
        </div>

        {/* ── Related services ─────────────────────────── */}
        {relatedServices.length > 0 && (
          <div className="mt-16 pt-8 border-t border-slate-800">
            <h2 className="text-lg font-bold text-white mb-5">
              More from {service.category?.name}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedServices.map((rs) => (
                <Link
                  key={rs.id}
                  href={`/marketplace/services/${rs.slug}`}
                  className="group rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden hover:border-indigo-500/40 transition-all hover:-translate-y-0.5"
                >
                  <div
                    className={cn(
                      "relative aspect-video bg-linear-to-br",
                      getGradient(rs.id)
                    )}
                  >
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
                    <p className="text-xs font-semibold text-slate-300 line-clamp-2 leading-snug group-hover:text-white transition-colors mb-2">
                      {rs.title}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">
                        {rs.creator.name.split(" ")[0]}
                      </span>
                      <span className="text-sm font-bold text-white tabular-nums">
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

      {/* ── Order dialog ───────────────────────────────────── */}
      {orderOpen && (
        <OrderDialog
          service={service}
          onClose={() => setOrderOpen(false)}
        />
      )}
    </div>
  );
}