"use client";

import {
  useState,
  useTransition,
  useEffect,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import { toast } from "sonner";
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
  const [view, setView] = useState<ViewState>("intro");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
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
        isAutoSubmit ? "Time's up — submitting…" : "Submitting your quiz…"
      );

      // Build full answer list (empty string for unanswered)
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
          const errorMessage =
            res.error === "NOT_ENROLLED"
              ? "You are not enrolled in this course."
              : res.error === "QUIZ_NOT_FOUND"
              ? "Quiz not found."
              : res.error === "QUESTION_COUNT_MISMATCH"
              ? "Please answer all questions."
              : "Something went wrong. Please try again.";

          setError(errorMessage);
          toast.error("Submission failed", {
            id: toastId,
            description: errorMessage,
          });
          return;
        }

        // Success — differentiate pass vs fail
        const data = res.data;
        if (data.passed) {
          toast.success("🎉 Congratulations! You passed!", {
            id: toastId,
            description: `Scored ${data.score.toFixed(0)}% · ${
              data.certificate ? "Certificate issued ✨" : ""
            }`,
            duration: 5000,
          });
        } else {
          toast.warning("Keep trying!", {
            id: toastId,
            description: `Scored ${data.score.toFixed(
              0
            )}% — need ${data.passingScore}% to pass`,
            duration: 5000,
          });
        }

        setResult(data);
        setView("result");
        if (timerRef.current) clearInterval(timerRef.current);
      });
    },
    [isPending, quiz.id, quiz.questions, answers]
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
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Top bar */}
        <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <Link
              href={`/dashboard/student/courses/${course.id}`}
              className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                Certification Quiz
              </p>
              <p className="text-xs text-slate-400 truncate">{course.title}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
          {/* Hero */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mb-5">
              <HelpCircle className="w-8 h-8 text-indigo-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
              {quiz.title}
            </h1>
            {quiz.description && (
              <p className="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                {quiz.description}
              </p>
            )}
          </div>

          {/* Info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 text-center">
              <HelpCircle className="w-5 h-5 text-indigo-400 mx-auto mb-2" />
              <p className="text-xl font-black text-white tabular-nums">
                {quiz.totalQuestions}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-1">
                Questions
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 text-center">
              <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-2" />
              <p className="text-xl font-black text-white tabular-nums">
                {quiz.passingScore}%
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-1">
                To Pass
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 text-center">
              <Clock className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
              <p className="text-xl font-black text-white tabular-nums">
                {quiz.timeLimit ? formatTime(quiz.timeLimit) : "—"}
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-1">
                {quiz.timeLimit ? "Time Limit" : "No Limit"}
              </p>
            </div>
          </div>

          {/* Last attempt banner */}
          {lastAttempt && (
            <div
              className={cn(
                "rounded-2xl p-4 sm:p-5 mb-6 border flex items-start gap-3",
                lastAttempt.passed
                  ? "bg-emerald-500/5 border-emerald-500/20"
                  : "bg-amber-500/5 border-amber-500/20"
              )}
            >
              {lastAttempt.passed ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-bold mb-0.5",
                    lastAttempt.passed ? "text-emerald-300" : "text-amber-300"
                  )}
                >
                  {lastAttempt.passed
                    ? "You already passed this quiz!"
                    : "Previous attempt did not pass"}
                </p>
                <p className="text-xs text-slate-400">
                  Score:{" "}
                  <span className="font-semibold text-slate-300 tabular-nums">
                    {lastAttempt.score.toFixed(1)}%
                  </span>{" "}
                  ({lastAttempt.correctQ}/{lastAttempt.totalQ} correct)
                </p>
              </div>
            </div>
          )}

          {/* Rules */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5 sm:p-6 mb-8">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Before you begin
            </h2>
            <ul className="space-y-2.5">
              {[
                `You need a score of ${quiz.passingScore}% or higher to pass`,
                "You can retake this quiz as many times as you need",
                quiz.timeLimit
                  ? "The timer starts as soon as you click Start"
                  : "There is no time limit — take your time",
                "You'll see detailed feedback for every answer after submitting",
                alreadyPassed
                  ? "You've already earned your certificate for this course"
                  : "Passing grants you a verified certificate",
              ].map((rule, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-slate-400 leading-relaxed"
                >
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <button
            onClick={startQuiz}
            className={cn(
              "w-full flex items-center justify-center gap-2 h-14 rounded-2xl",
              "bg-indigo-600 hover:bg-indigo-500 text-white",
              "text-base font-bold transition-all active:scale-[0.98]",
              "shadow-lg shadow-indigo-500/20"
            )}
          >
            <Sparkles className="w-5 h-5" />
            {lastAttempt ? "Retake Quiz" : "Start Quiz"}
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        {/* Top bar */}
        <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                Question {currentIndex + 1} of {quiz.questions.length}
              </p>
              <p className="text-xs text-slate-400 truncate">{quiz.title}</p>
            </div>

            {timeRemaining !== null && (
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums",
                  timerWarning
                    ? "bg-red-500/10 text-red-400 border border-red-500/30"
                    : "bg-slate-800 text-slate-300 border border-slate-700"
                )}
              >
                <Clock className="w-3.5 h-3.5" />
                {formatTime(timeRemaining)}
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-slate-900 relative">
            <div
              className="h-full bg-slate-800 transition-all duration-300"
              style={{ width: `${answeredPct}%` }}
            />
            <div
              className="absolute top-0 h-full bg-linear-to-r from-indigo-500 to-violet-500 transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-10">
          {/* Question text */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] font-bold uppercase tracking-widest mb-4">
              <HelpCircle className="w-3 h-3" />
              Question {currentIndex + 1}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white leading-snug">
              {currentQuestion.text}
            </h2>
          </div>

          {/* Options */}
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
                      ? "bg-indigo-500/10 border-indigo-500/50 shadow-lg shadow-indigo-500/5"
                      : "bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80"
                  )}
                >
                  {/* Radio indicator */}
                  <div
                    className={cn(
                      "shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center mt-0.5 transition-all",
                      isSelected
                        ? "border-indigo-500 bg-indigo-500"
                        : "border-slate-600"
                    )}
                  >
                    {isSelected && (
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    )}
                  </div>

                  {/* Option text */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider",
                          isSelected ? "text-indigo-400" : "text-slate-600"
                        )}
                      >
                        Option {String.fromCharCode(65 + i)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-sm leading-relaxed",
                        isSelected
                          ? "text-white font-medium"
                          : "text-slate-300"
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

        {/* Footer actions */}
        <div className="border-t border-slate-800 bg-slate-950/95 backdrop-blur-md sticky bottom-0 z-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
            {/* Previous */}
            <button
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={isFirst}
              className={cn(
                "flex items-center gap-1.5 px-4 h-11 rounded-xl text-sm font-semibold transition-all",
                isFirst
                  ? "opacity-30 cursor-not-allowed text-slate-600"
                  : "text-slate-300 hover:bg-slate-800 border border-slate-700"
              )}
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>

            {/* Question dots (compact) */}
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
                        ? "w-6 h-2 bg-indigo-500"
                        : answered
                        ? "w-2 h-2 bg-emerald-500"
                        : "w-2 h-2 bg-slate-700 hover:bg-slate-600"
                    )}
                  />
                );
              })}
            </div>

            {/* Next or Submit */}
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
                    ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white active:scale-95 shadow-lg shadow-indigo-500/20"
                )}
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => handleSubmit(false)}
                disabled={isPending || totalAnswered < quiz.questions.length}
                className={cn(
                  "flex items-center gap-1.5 px-5 h-11 rounded-xl text-sm font-bold transition-all",
                  isPending || totalAnswered < quiz.questions.length
                    ? "bg-slate-800 text-slate-600 cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95 shadow-lg shadow-emerald-500/20"
                )}
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                <span>{isPending ? "Submitting…" : "Submit Quiz"}</span>
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-4">
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
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
      <div className="min-h-screen bg-slate-950 text-slate-100">
        {/* Top bar */}
        <div className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <Link
              href={`/dashboard/student/courses/${course.id}`}
              className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-slate-400" />
            </Link>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                Quiz Results
              </p>
              <p className="text-xs text-slate-400 truncate">{quiz.title}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Hero result */}
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
                <Trophy className="w-10 h-10 text-emerald-400" />
              ) : (
                <RotateCcw className="w-10 h-10 text-amber-400" />
              )}
            </div>

            <h1
              className={cn(
                "text-2xl sm:text-3xl font-black mb-2",
                passed ? "text-emerald-400" : "text-amber-400"
              )}
            >
              {passed ? "Congratulations! 🎉" : "Keep Learning!"}
            </h1>

            <p className="text-sm text-slate-400 max-w-md mx-auto">
              {passed
                ? "You passed the quiz. Your certificate has been issued."
                : `You need ${result.passingScore}% or higher to pass. Review the feedback below and try again.`}
            </p>
          </div>

          {/* Score stats */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-center">
              <p
                className={cn(
                  "text-2xl sm:text-3xl font-black tabular-nums",
                  passed ? "text-emerald-400" : "text-amber-400"
                )}
              >
                {result.score.toFixed(0)}%
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-1">
                Your Score
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-center">
              <p className="text-2xl sm:text-3xl font-black text-white tabular-nums">
                {result.correctAnswers}
                <span className="text-slate-600 text-lg">
                  /{result.totalQuestions}
                </span>
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-1">
                Correct
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 text-center">
              <p className="text-2xl sm:text-3xl font-black text-slate-400 tabular-nums">
                {result.passingScore}%
              </p>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mt-1">
                Required
              </p>
            </div>
          </div>

          {/* Certificate info */}
          {passed && result.certificate && (
            <div className="rounded-2xl bg-linear-to-br from-amber-500/10 via-yellow-500/5 to-amber-500/10 border border-amber-500/20 p-5 sm:p-6 mb-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                  <Award className="w-6 h-6 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-amber-300 mb-1">
                    Certificate Issued!
                  </p>
                  <p className="text-xs text-slate-400 mb-3">
                    Credential ID:{" "}
                    <span className="font-mono text-slate-300">
                      {result.certificate.credentialId}
                    </span>
                  </p>
                  <Link
                    href="/dashboard/student/certificates"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors"
                  >
                    View Certificate
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Role upgrade notice */}
          {result.roleUpgraded && (
            <div className="rounded-2xl bg-indigo-500/5 border border-indigo-500/20 p-5 sm:p-6 mb-8">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-indigo-300 mb-1">
                    Your account was upgraded!
                  </p>
                  <p className="text-xs text-slate-400">
                    You are now a{" "}
                    <strong className="text-white">Creator</strong>. Head to
                    your dashboard to start offering services.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Feedback */}
          <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden mb-6">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white">Answer Review</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                See how you answered each question
              </p>
            </div>

            <div className="divide-y divide-slate-800">
              {result.answerFeedback.map((fb, idx) => {
                const q = quiz.questions.find((q) => q.id === fb.questionId);
                if (!q) return null;

                return (
                  <div key={fb.questionId} className="p-5 sm:p-6">
                    {/* Question header */}
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className={cn(
                          "shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5",
                          fb.isCorrect
                            ? "bg-emerald-500/15 border border-emerald-500/30"
                            : "bg-red-500/15 border border-red-500/30"
                        )}
                      >
                        {fb.isCorrect ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-1">
                          Question {idx + 1}
                        </p>
                        <p className="text-sm font-semibold text-white leading-snug">
                          {q.text}
                        </p>
                      </div>
                    </div>

                    {/* Options with marks */}
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
                                ? "bg-red-500/10 border border-red-500/25"
                                : "bg-slate-800/40 border border-slate-800"
                            )}
                          >
                            <div className="shrink-0 mt-0.5">
                              {isCorrect ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : isSelected ? (
                                <XCircle className="w-3.5 h-3.5 text-red-400" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full border border-slate-600" />
                              )}
                            </div>
                            <span
                              className={cn(
                                "flex-1",
                                isCorrect
                                  ? "text-emerald-300 font-medium"
                                  : isSelected
                                  ? "text-red-300"
                                  : "text-slate-400"
                              )}
                            >
                              {opt}
                              {isSelected && !isCorrect && (
                                <span className="ml-2 text-[10px] text-slate-500 font-semibold">
                                  (Your answer)
                                </span>
                              )}
                              {isCorrect && (
                                <span className="ml-2 text-[10px] text-emerald-500 font-bold uppercase">
                                  Correct
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

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/dashboard/student/courses/${course.id}`}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-12 rounded-xl",
                "bg-slate-900 hover:bg-slate-800 border border-slate-800",
                "text-slate-300 text-sm font-semibold transition-all"
              )}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Course
            </Link>
            <button
              onClick={retakeQuiz}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 h-12 rounded-xl",
                passed
                  ? "bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
                  : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20",
                "text-sm font-bold transition-all active:scale-[0.98]"
              )}
            >
              <RotateCcw className="w-4 h-4" />
              {passed ? "Retake for Practice" : "Try Again"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}