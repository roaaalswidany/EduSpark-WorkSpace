"use client";

import { useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  Loader2,
  ShoppingCart,
  Play,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { enrollInCourseAction } from "@/actions/lms/enroll-in-course";

interface EnrollButtonProps {
  courseId: string;
  price: number;
  isEnrolled: boolean;
  isLoggedIn: boolean;
  courseSlug: string;
  userRole?: string;
}

export function EnrollButton({
  courseId,
  price,
  isEnrolled,
  isLoggedIn,
  courseSlug,
  userRole,
}: EnrollButtonProps) {
  const t = useTranslations("courses.enroll");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // ── Admin ────────────────────────────────────────────────────
  if (userRole === "ADMIN") {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl bg-info/5 border border-info/20">
        <ShieldAlert className="w-5 h-5 text-info shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-info">{t("adminTitle")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("adminDescription")}
          </p>
        </div>
      </div>
    );
  }

  // ── Already enrolled ─────────────────────────────────────────
  if (isEnrolled) {
    return (
      <Link
        href={`/dashboard/student/courses/${courseId}`}
        className={cn(
          "w-full flex items-center justify-center gap-2 h-12 rounded-xl",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          "text-sm font-bold transition-all active:scale-[0.98]",
          "shadow-lg shadow-emerald-500/20"
        )}
      >
        <Play className="w-4 h-4 fill-current" />
        {t("continue")}
      </Link>
    );
  }

  // ── Not logged in ────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <Link
        href={`/auth/login?callbackUrl=/courses/${courseSlug}`}
        className={cn(
          "w-full flex items-center justify-center gap-2 h-12 rounded-xl",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          "text-sm font-bold transition-all active:scale-[0.98]",
          "shadow-lg shadow-emerald-500/20"
        )}
      >
        {t("signIn")}
      </Link>
    );
  }

  // ── Enroll ───────────────────────────────────────────────────
  function handleEnroll() {
    setError(null);
    const toastId = toast.loading(t("loadingToast"));

    startTransition(async () => {
      const result = await enrollInCourseAction({ courseId });

      if (result.success) {
        toast.success(t("successToast"), {
          id: toastId,
          description: t("successToastDesc"),
        });
        router.push(`/dashboard/student/courses/${courseId}`);
        return;
      }

      const errorMap: Record<string, string> = {
        ALREADY_ENROLLED: t("errors.alreadyEnrolled"),
        CANNOT_ENROLL_OWN_COURSE: t("errors.ownCourse"),
        COURSE_NOT_FOUND: t("errors.courseNotFound"),
        NOT_PUBLISHED: t("errors.notPublished"),
        UNAUTHORIZED: t("errors.unauthorized"),
        ADMIN_CANNOT_PARTICIPATE: t("errors.adminCannotParticipate"),
        INVALID_INPUT: t("errors.invalidInput"),
        SERVER_ERROR: t("errors.serverError"),
      };
      const errorMessage = errorMap[result.error] ?? t("errors.generic");

      setError(errorMessage);
      toast.error(t("errorToast"), {
        id: toastId,
        description: errorMessage,
      });
    });
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleEnroll}
        disabled={isPending}
        className={cn(
          "w-full flex items-center justify-center gap-2 h-12 rounded-xl",
          "bg-primary hover:bg-primary/90 text-primary-foreground",
          "text-sm font-bold transition-all active:scale-[0.98]",
          "shadow-lg shadow-emerald-500/20",
          "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
        )}
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ShoppingCart className="w-4 h-4" />
        )}
        {isPending
          ? t("enrolling")
          : price === 0
          ? t("enrollFree")
          : t("enrollPaid", { price: price.toFixed(2) })}
      </button>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
    </div>
  );
}