"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Lock, Loader2, Unlock, AlertTriangle } from "lucide-react";
import { updateCourseStatusAction } from "@/actions/creator/publish-course";

interface Props {
  courseId: string;
  courseStatus: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";
}

export function QuizLockBanner({ courseId, courseStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDialog, setShowDialog] = useState(false);

  const isPublished = courseStatus === "PUBLISHED";
  const actionLabel = isPublished ? "Unpublish to Edit" : "Withdraw Submission";

  const handleConfirm = () => {
    setShowDialog(false);
    const toastId = toast.loading(isPublished ? "Unpublishing..." : "Withdrawing...");

    startTransition(async () => {
      const result = await updateCourseStatusAction({ courseId, status: "DRAFT" });
      if (result.success) {
        toast.success("Course moved to draft", {
          id: toastId,
          description: "You can now edit the quiz. Submit for review when ready.",
        });
        router.refresh();
      } else {
        toast.error("Could not update course", {
          id: toastId,
          description: result.error ?? "Please try again.",
        });
      }
    });
  };

  return (
    <>
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-amber-300">Quiz is locked</h3>
              <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">
                {courseStatus === "PENDING_REVIEW"
                  ? "This course is under review. Withdraw the submission to edit its quiz."
                  : "This course is published. Unpublish it to edit its quiz, then re-submit for review before students regain access."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDialog(true)}
            disabled={isPending}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Unlock className="w-3.5 h-3.5" />
            )}
            {actionLabel}
          </button>
        </div>
      </div>

      {showDialog && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowDialog(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-5 space-y-4 pointer-events-auto">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-white">
                    {isPublished ? "Unpublish this course?" : "Withdraw submission?"}
                  </h3>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                    {isPublished
                      ? "Students will lose access until you re-submit for review and an admin approves it again."
                      : "The course will return to draft. You'll need to submit it for review again."}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDialog(false)}
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isPending}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                  {isPublished ? "Unpublish" : "Withdraw"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}