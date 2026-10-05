/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ShoppingCart, Play, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

  // ── Already enrolled: Continue ─────────────────────────────
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

  // ── Not logged in: prompt to sign in ───────────────────────
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

  // ── Logged in but not enrolled: Enroll (stub until action added) ─
  function handleEnroll() {
    setError(null);
    startTransition(async () => {
      // TODO: replace with real enrollAction once backend endpoint exists
      await new Promise((r) => setTimeout(r, 600));
      setError("Enrollment is not yet available. Backend action pending.");
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
          ? "Processing…"
          : price === 0
          ? "Enroll for free"
          : `Enroll for $${price.toFixed(2)}`}
      </button>

      {error && (
        <p className="text-xs text-amber-400 text-center flex items-center justify-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {error}
        </p>
      )}
    </div>
  );
}