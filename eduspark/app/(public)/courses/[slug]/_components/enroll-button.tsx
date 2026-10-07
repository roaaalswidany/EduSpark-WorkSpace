"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ShoppingCart, Play, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { enrollInCourseAction } from "@/actions/lms/enroll-in-course";

interface EnrollButtonProps {
  courseId: string;
  price: number;
  isEnrolled: boolean;
  isLoggedIn: boolean;
  courseSlug: string;
}

export function EnrollButton({
  courseId,
  price,
  isEnrolled,
  isLoggedIn,
  courseSlug,
}: EnrollButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // ── Already enrolled: Continue ───────────────────────────────
  if (isEnrolled) {
    return (
      <Link
        href={`/dashboard/student/courses/${courseId}`}
        className={cn(
          "w-full flex items-center justify-center gap-2 h-12 rounded-xl",
          "bg-indigo-600 hover:bg-indigo-500 text-white",
          "text-sm font-bold transition-all active:scale-[0.98]",
          "shadow-lg shadow-indigo-500/20"
        )}
      >
        <Play className="w-4 h-4 fill-current" />
        Continue Learning
      </Link>
    );
  }

  // ── Not logged in: prompt to sign in ────────────────────────
  if (!isLoggedIn) {
    return (
      <Link
        href={`/auth/login?callbackUrl=/courses/${courseSlug}`}
        className={cn(
          "w-full flex items-center justify-center gap-2 h-12 rounded-xl",
          "bg-indigo-600 hover:bg-indigo-500 text-white",
          "text-sm font-bold transition-all active:scale-[0.98]",
          "shadow-lg shadow-indigo-500/20"
        )}
      >
        Sign in to enroll
      </Link>
    );
  }

  // ── Logged in: Enroll ────────────────────────────────────────
  function handleEnroll() {
    setError(null);

    const toastId = toast.loading("Enrolling…");

    startTransition(async () => {
      const result = await enrollInCourseAction({ courseId });

      if (result.success) {
        toast.success("Enrolled successfully! 🎉", {
          id: toastId,
          description: "Redirecting to your course…",
        });
        router.push(`/dashboard/student/courses/${courseId}`);
        return;
      }

      const messages: Record<string, string> = {
        ALREADY_ENROLLED: "You're already enrolled in this course.",
        CANNOT_ENROLL_OWN_COURSE: "You can't enroll in your own course.",
        COURSE_NOT_FOUND: "Course not found.",
        NOT_PUBLISHED: "This course isn't available for enrollment yet.",
        UNAUTHORIZED: "Please sign in to enroll.",
      };
      const errorMessage =
        messages[result.error] ?? "Something went wrong. Please try again.";

      setError(errorMessage);
      toast.error(errorMessage, { id: toastId });
    });
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleEnroll}
        disabled={isPending}
        className={cn(
          "w-full flex items-center justify-center gap-2 h-12 rounded-xl",
          "bg-indigo-600 hover:bg-indigo-500 text-white",
          "text-sm font-bold transition-all active:scale-[0.98]",
          "shadow-lg shadow-indigo-500/20",
          "disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
        )}
      >
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ShoppingCart className="w-4 h-4" />
        )}
        {isPending
          ? "Enrolling…"
          : price === 0
          ? "Enroll for free"
          : `Enroll for $${price.toFixed(2)}`}
      </button>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}
    </div>
  );
}