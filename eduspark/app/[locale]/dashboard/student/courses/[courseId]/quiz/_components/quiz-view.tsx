"use client";

import {
  useState,
  useTransition,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import {
  QUIZ_ATTEMPT_WINDOW_HOURS,
  QUIZ_MAX_ATTEMPTS_PER_WINDOW,
} from "@/lib/lms/quiz-policy";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trophy,
  ArrowRight,
  HelpCircle,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import {
  submitQuizAction,
  type AnswerFeedback,
} from "@/actions/lms/submit-quiz";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────

interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  order: number;
}

interface QuizData {
  id: string;
  title: string;
  description: string | null;
  passingScore: number;
  timeLimit: number | null;
  questions: QuizQuestion[];
  totalQuestions: number;
}

interface CourseInfo {
  id: string;
  title: string;
  slug: string;
}

interface LastAttempt {
  score: number;
  passed: boolean;
  correctQ: number;
  totalQ: number;
  submittedAt: Date;
}

interface QuizViewProps {
  quiz: QuizData;
  course: CourseInfo;
  lastAttempt: LastAttempt | null;
  alreadyPassed: boolean;
}

type ViewState = "intro" | "in-progress" | "result";

interface ResultData {
  score: number;
  passed: boolean;
  correctAnswers: number;
  totalQuestions: number;
  passingScore: number;
  roleUpgraded: boolean;
  certificate: {
    id: string;
    credentialId: string;
    issuedAt: Date;
    courseId: string;
  } | null;
  answerFeedback: AnswerFeedback[];
}

// ─── Helpers ───────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ─── Main Component ────────────────────────────────────────────────

export function QuizView({
  quiz,
  course,
  lastAttempt,
  alreadyPassed,
}: QuizViewProps) {
  const t = useTranslations("quiz");
  const locale = useLocale();
  const [view, setView] = useState<ViewState>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { update: updateSession } = useSession();
  const [result, setResult] = useState<ResultData | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(
    quiz.timeLimit
  );
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoSubmittedRef = useRef(false);

  const currentQuestion = quiz.questions[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === quiz.questions.length - 1;
  const selectedForCurrent = currentQuestion
    ? answers[currentQuestion.id]
    : undefined;
  const totalAnswered = Object.keys(answers).length;

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = useCallback(
    (isAutoSubmit = false) => {
      if (isPending) return;
      setError(null);

      const toastId = toast.loading(
        isAutoSubmit ? t("toasts.timesUp") : t("toasts.submittingQuiz")
      );

      const payload = {
        quizId: quiz.id,
        answers: quiz.questions.map((q) => ({
          questionId: q.id,
          selectedOption: answers[q.id] ?? "",
        })),
      };

      startTransition(async () => {
        const res = await submitQuizAction(payload);

        if (!res.success) {
          const errorMessage = (() => {
            switch (res.error) {
              case "NOT_ENROLLED":
                return t("errors.notEnrolled");
              case "COURSE_NOT_COMPLETED":
                return t("errors.courseNotCompleted");
              case "QUIZ_NOT_FOUND":
                return t("errors.quizNotFound");
              case "QUESTION_COUNT_MISMATCH":
                return t("errors.questionCountMismatch");
              case "EMAIL_NOT_VERIFIED":
                return t("errors.emailNotVerified");
              case "ATTEMPT_LIMIT_REACHED":
                return t("errors.attemptLimitReached", {
                  retryAt: res.retryAt
                    ? new Date(res.retryAt).toLocaleString(locale)
                    : "—",
                });
              default:
                return t("errors.generic");
            }
          })();

          setError(errorMessage);
          toast.error(t("toasts.submissionFailed"), {
            id: toastId,
            description: errorMessage,
          });
          return;
        }

        const data = res.data;
        if (data.passed) {
          toast.success(t("toasts.passed"), {
            id: toastId,
            description: t("toasts.passedDesc", {
              score: data.score.toFixed(0),
              certificate: data.certificate ? "Certificate issued ✨" : "",
            }),
            duration: 5000,
          });
        } else {
          toast.warning(t("toasts.failed"), {
            id: toastId,
            description: t("toasts.failedDesc", {
              score: data.score.toFixed(0),
              passingScore: data.passingScore,
            }),
            duration: 5000,
          });
        }

        if (data.roleUpgraded) {
          void updateSession();
        }

        setResult(data);
        setView("result");
        if (timerRef.current) clearInterval(timerRef.current);
      });
    },
    [isPending, quiz.id, quiz.questions, answers, updateSession, t, locale]
  );

  // ── Timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (view !== "in-progress" || quiz.timeLimit === null) return;
    if (hasAutoSubmittedRef.current) return;

    timerRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          if (!hasAutoSubmittedRef.current) {
            hasAutoSubmittedRef.current = true;
            handleSubmit(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [view, quiz.timeLimit, handleSubmit]);

  // ── Actions ────────────────────────────────────────────────────
  function startQuiz() {
    setView("in-progress");
    setCurrentIndex(0);
    setAnswers({});
    setError(null);
    setTimeRemaining(quiz.timeLimit);
    hasAutoSubmittedRef.current = false;
  }

  function retakeQuiz() {
    setResult(null);
    startQuiz();
  }

  function selectAnswer(questionId: string, option: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  }

  // ═══════════════════════════════════════════════════════════════
  // INTRO VIEW
  // ═══════════════════════════════════════════════════════════════
  if (view === "intro") {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <Link
              href={`/dashboard/student/courses/${course.id}`}
              className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground rtl:rotate-180" />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("intro.eyebrow")}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {course.title}
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-5">
              <HelpCircle className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-2">
              {quiz.title}
            </h1>
            {quiz.description && (
              <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
                {quiz.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <div className="rounded-2xl bg-card border border-border p-5 text-center">
              <HelpCircle className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-xl font-black text-foreground tabular-nums">
                {quiz.totalQuestions}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1">
                {t("intro.questions")}
              </p>
            </div>
            <div className="rounded-2xl bg-card border border-border p-5 text-center">
              <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400 mx-auto mb-2" />
              <p className="text-xl font-black text-foreground tabular-nums">
                {quiz.passingScore}%
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1">
                {t("intro.toPass")}
              </p>
            </div>
            <div className="rounded-2xl bg-card border border-border p-5 text-center">
              <Clock className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mx-auto mb-2" />
              <p className="text-xl font-black text-foreground tabular-nums">
                {quiz.timeLimit ? formatTime(quiz.timeLimit) : "—"}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1">
                {quiz.timeLimit
                  ? t("intro.timeLimit")
                  : t("intro.noLimit")}
              </p>
            </div>
          </div>

          {lastAttempt && (
            <div
              className={cn(
                "rounded-2xl p-4 sm:p-5 mb-6 border flex items-start gap-3",
                lastAttempt.passed
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "bg-amber-500/10 border-amber-500/20"
              )}
            >
              {lastAttempt.passed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-bold mb-0.5",
                    lastAttempt.passed
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {lastAttempt.passed
                    ? t("intro.lastAttemptPassed")
                    : t("intro.lastAttemptFailed")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("intro.scoreLine", {
                    score: lastAttempt.score.toFixed(1),
                    correct: lastAttempt.correctQ,
                    total: lastAttempt.totalQ,
                  })}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-card border border-border p-5 sm:p-6 mb-8">
            <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {t("intro.beforeYouBegin")}
            </h2>
            <ul className="space-y-2.5">
              {[
                t("intro.rules.passingScore", {
                  passingScore: quiz.passingScore,
                }),
                t("intro.rules.attempts", {
                  maxAttempts: QUIZ_MAX_ATTEMPTS_PER_WINDOW,
                  windowHours: QUIZ_ATTEMPT_WINDOW_HOURS,
                }),
                quiz.timeLimit
                  ? t("intro.rules.timerStarts")
                  : t("intro.rules.noTimeLimit"),
                t("intro.rules.feedbackAfterPass"),
                alreadyPassed
                  ? t("intro.rules.certificateEarned")
                  : t("intro.rules.certificateOnPass"),
              ].map((rule, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-muted-foreground leading-relaxed"
                >
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={startQuiz}
            className={cn(
              "w-full flex items-center justify-center gap-2 h-14 rounded-2xl",
              "bg-primary hover:bg-primary/90 text-primary-foreground",
              "text-base font-bold transition-all active:scale-[0.98]",
              "shadow-lg shadow-emerald-500/20"
            )}
          >
            <Sparkles className="w-5 h-5" />
            {lastAttempt
              ? t("intro.retakeQuiz")
              : t("intro.startQuiz")}
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // IN-PROGRESS VIEW
  // ═══════════════════════════════════════════════════════════════
  if (view === "in-progress" && currentQuestion) {
    const progressPct = ((currentIndex + 1) / quiz.questions.length) * 100;
    const answeredPct = (totalAnswered / quiz.questions.length) * 100;
    const timerWarning = timeRemaining !== null && timeRemaining <= 60;

    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <div className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("inProgress.questionOf", {
                  current: currentIndex + 1,
                  total: quiz.questions.length,
                })}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {quiz.title}
              </p>
            </div>

            {timeRemaining !== null && (
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums",
                  timerWarning
                    ? "bg-destructive/10 text-destructive border border-destructive/30"
                    : "bg-accent text-foreground border border-border"
                )}
              >
                <Clock className="w-3.5 h-3.5" />
                {formatTime(timeRemaining)}
              </div>
            )}
          </div>

          <div className="h-1 bg-card relative">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${answeredPct}%` }}
            />
            <div
              className="absolute top-0 h-full bg-linear-to-r from-emerald-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-10">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-widest mb-4">
              <HelpCircle className="w-3 h-3" />
              {t("inProgress.questionOf", {
                current: currentIndex + 1,
                total: quiz.questions.length,
              })}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground leading-snug">
              {currentQuestion.text}
            </h2>
          </div>

          <div className="space-y-3 mb-8">
            {currentQuestion.options.map((option, i) => {
              const isSelected = selectedForCurrent === option;
              return (
                <button
                  key={i}
                  onClick={() => selectAnswer(currentQuestion.id, option)}
                  className={cn(
                    "w-full flex items-start gap-3.5 p-4 sm:p-5 rounded-2xl text-left",
                    "border transition-all duration-150",
                    isSelected
                      ? "bg-primary/10 border-primary/50 shadow-lg shadow-primary/5"
                      : "bg-card border-border hover:border-primary/40 hover:bg-card/80"
                  )}
                >
                  <div
                    className={cn(
                      "shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 transition-all",
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-border"
                    )}
                  >
                    {isSelected && (
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider",
                          isSelected
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      >
                        {t("inProgress.optionLabel", {
                          letter: String.fromCharCode(65 + i),
                        })}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
                        isSelected
                          ? "text-foreground font-medium"
                          : "text-foreground"
                      )}
                    >
                      {option}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-border bg-background/95 backdrop-blur-md sticky bottom-0 z-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={isFirst}
              className={cn(
                "flex items-center gap-1.5 px-4 h-11 rounded-xl text-sm font-semibold transition-all",
                isFirst
                  ? "opacity-30 cursor-not-allowed text-muted-foreground"
                  : "text-foreground hover:bg-accent border border-border"
              )}
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
              <span className="hidden sm:inline">
                {t("inProgress.previous")}
              </span>
            </button>

            <div className="flex-1 flex items-center justify-center gap-1.5">
              {quiz.questions.map((q, i) => {
                const answered = !!answers[q.id];
                const isCurrent = i === currentIndex;
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(i)}
                    title={`Question ${i + 1}`}
                    className={cn(
                      "rounded-full transition-all",
                      isCurrent
                        ? "w-6 h-2 bg-primary"
                        : answered
                        ? "w-2 h-2 bg-emerald-500"
                        : "w-2 h-2 bg-muted-foreground/40 hover:bg-muted-foreground/60"
                    )}
                  />
                );
              })}
            </div>

            {!isLast ? (
              <button
                onClick={() =>
                  setCurrentIndex((i) =>
                    Math.min(quiz.questions.length - 1, i + 1)
                  )
                }
                disabled={!selectedForCurrent}
                className={cn(
                  "flex items-center gap-1.5 px-4 h-11 rounded-xl text-sm font-bold transition-all",
                  !selectedForCurrent
                    ? "bg-accent text-muted-foreground cursor-not-allowed"
                    : "bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 shadow-lg shadow-emerald-500/20"
                )}
              >
                <span className="hidden sm:inline">
                  {t("inProgress.next")}
                </span>
                <ChevronRight className="w-4 h-4 rtl:rotate-180" />
              </button>
            ) : (
              <button
                onClick={() => handleSubmit(false)}
                disabled={isPending || totalAnswered < quiz.questions.length}
                className={cn(
                  "flex items-center gap-1.5 px-5 h-11 rounded-xl text-sm font-bold transition-all",
                  isPending || totalAnswered < quiz.questions.length
                    ? "bg-accent text-muted-foreground cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 shadow-lg shadow-emerald-500/20"
                )}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>
                  {isPending
                    ? t("inProgress.submitting")
                    : t("inProgress.submitQuiz")}
                </span>
              </button>
            )}
          </div>

          {error && (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-4">
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // RESULT VIEW
  // ═══════════════════════════════════════════════════════════════
  if (view === "result" && result) {
    const passed = result.passed;

    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <Link
              href={`/dashboard/student/courses/${course.id}`}
              className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-accent transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground rtl:rotate-180" />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("result.eyebrow")}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {quiz.title}
              </p>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="text-center mb-8">
            <div
              className={cn(
                "inline-flex items-center justify-center w-20 h-20 rounded-full mb-5 border-2",
                passed
                  ? "bg-emerald-500/10 border-emerald-500/30"
                  : "bg-amber-500/10 border-amber-500/30"
              )}
            >
              {passed ? (
                <Trophy className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <RotateCcw className="w-10 h-10 text-amber-600 dark:text-amber-400" />
              )}
            </div>

            <h1
              className={cn(
                "text-2xl sm:text-3xl font-black mb-2",
                passed
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400"
              )}
            >
              {passed ? t("result.passedTitle") : t("result.failedTitle")}
            </h1>

            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {passed
                ? t("result.passedDesc")
                : t("result.failedDesc", {
                    passingScore: result.passingScore,
                  })}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="rounded-2xl bg-card border border-border p-4 text-center">
              <p
                className={cn(
                  "text-2xl sm:text-3xl font-black tabular-nums",
                  passed
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                )}
              >
                {result.score.toFixed(0)}%
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1">
                {t("result.yourScore")}
              </p>
            </div>
            <div className="rounded-2xl bg-card border border-border p-4 text-center">
              <p className="text-2xl sm:text-3xl font-black text-foreground tabular-nums">
                {result.correctAnswers}
                <span className="text-muted-foreground text-lg">
                  /{result.totalQuestions}
                </span>
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1">
                {t("result.correct")}
              </p>
            </div>
            <div className="rounded-2xl bg-card border border-border p-4 text-center">
              <p className="text-2xl sm:text-3xl font-black text-muted-foreground tabular-nums">
                {result.passingScore}%
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mt-1">
                {t("result.required")}
              </p>
            </div>
          </div>

          {passed && result.certificate && (
            <div className="rounded-2xl bg-linear-to-br from-amber-500/10 via-yellow-500/5 to-amber-500/10 border border-amber-500/20 p-5 sm:p-6 mb-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                  <Award className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-1">
                    {t("result.certificateIssued")}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t("result.credentialId")}{" "}
                    <span className="font-mono text-foreground">
                      {result.certificate.credentialId}
                    </span>
                  </p>
                  <Link
                    href="/dashboard/student/certificates"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 text-xs font-bold transition-colors"
                  >
                    {t("result.viewCertificate")}
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {result.roleUpgraded && (
            <div className="rounded-2xl bg-primary/5 border border-primary/20 p-5 sm:p-6 mb-8">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-primary mb-1">
                    {t("result.roleUpgradedTitle")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("result.roleUpgradedDesc")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {passed && result.answerFeedback.length > 0 && (
            <div className="rounded-2xl bg-card border border-border overflow-hidden mb-6">
              <div className="px-5 sm:px-6 py-4 border-b border-border">
                <h2 className="text-sm font-bold text-foreground">
                  {t("result.answerReview")}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("result.answerReviewDesc")}
                </p>
              </div>

              <div className="divide-y divide-border">
                {result.answerFeedback.map((fb, idx) => {
                  const q = quiz.questions.find((q) => q.id === fb.questionId);
                  if (!q) return null;

                  return (
                    <div key={fb.questionId} className="p-5 sm:p-6">
                      <div className="flex items-start gap-3 mb-4">
                        <div
                          className={cn(
                            "shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5",
                            fb.isCorrect
                              ? "bg-emerald-500/15 border border-emerald-500/30"
                              : "bg-destructive/15 border border-destructive/30"
                          )}
                        >
                          {fb.isCorrect ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-destructive" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">
                            Question {idx + 1}
                          </p>
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {q.text}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 pl-9">
                        {q.options.map((opt, i) => {
                          const isSelected = opt === fb.selectedOption;
                          const isCorrect = opt === fb.correctOption;

                          return (
                            <div
                              key={i}
                              className={cn(
                                "flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-xs leading-relaxed",
                                isCorrect
                                  ? "bg-emerald-500/10 border border-emerald-500/25"
                                  : isSelected
                                  ? "bg-destructive/10 border border-destructive/25"
                                  : "bg-accent/40 border border-border"
                              )}
                            >
                              <div className="shrink-0 mt-0.5">
                                {isCorrect ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                ) : isSelected ? (
                                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                                ) : (
                                  <div className="w-3.5 h-3.5 rounded-full border border-border" />
                                )}
                              </div>
                              <span
                                className={cn(
                                  "flex-1",
                                  isCorrect
                                    ? "text-emerald-700 dark:text-emerald-300 font-medium"
                                    : isSelected
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                                )}
                              >
                                {opt}
                                {isSelected && !isCorrect && (
                                  <span className="ml-2 text-[10px] text-muted-foreground font-semibold">
                                    {t("result.yourAnswerMark")}
                                  </span>
                                )}
                                {isCorrect && (
                                  <span className="ml-2 text-[10px] text-emerald-600 dark:text-emerald-500 font-bold uppercase">
                                    {t("result.correctMark")}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!passed && (
            <p className="text-xs text-muted-foreground text-center mb-6">
              {t("result.reviewLocked")}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/dashboard/student/courses/${course.id}`}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-12 rounded-xl",
                "bg-card hover:bg-accent border border-border",
                "text-foreground text-sm font-semibold transition-all"
              )}
            >
              <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              {t("result.backToCourse")}
            </Link>
            <button
              onClick={retakeQuiz}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-12 rounded-xl",
                passed
                  ? "bg-card hover:bg-accent border border-border text-foreground"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-emerald-500/20",
                "text-sm font-bold transition-all active:scale-[0.98]"
              )}
            >
              <RotateCcw className="w-4 h-4" />
              {passed
                ? t("result.retakeForPractice")
                : t("result.tryAgain")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}