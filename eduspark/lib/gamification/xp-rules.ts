// eduspark/lib/gamification/xp-rules.ts
// ─────────────────────────────────────────────────────────────────
// Central XP reward table. Adjust values here — logic uses these.
// ─────────────────────────────────────────────────────────────────

export const XP_REWARDS = {
  // Learning
  LESSON_COMPLETED: 10,
  QUIZ_PASSED: 100,
  QUIZ_FAILED: 5,
  COURSE_COMPLETED: 200,

  // Creator
  SERVICE_PUBLISHED: 50,
  ORDER_COMPLETED: 150,
  ORDER_RECEIVED: 100,

  // Career Path
  CAREER_PATH_CREATED: 30,
  CAREER_PATH_STEP_STARTED: 15,
  CAREER_PATH_STEP_COMPLETED: 40,
  CAREER_PATH_COMPLETED: 100,

  // Engagement
  DAILY_LOGIN: 5,
  PROFILE_COMPLETED: 50,
  FIRST_REVIEW: 25,
} as const;

export type XPReason = keyof typeof XP_REWARDS;

// Human-readable labels
export const XP_REASON_LABELS: Record<XPReason, { en: string; ar: string }> = {
  LESSON_COMPLETED: { en: "Completed a lesson", ar: "إكمال درس" },
  QUIZ_PASSED: { en: "Passed a quiz", ar: "اجتياز اختبار" },
  QUIZ_FAILED: { en: "Attempted a quiz", ar: "محاولة اختبار" },
  COURSE_COMPLETED: { en: "Completed a course", ar: "إكمال كورس" },
  SERVICE_PUBLISHED: { en: "Published a service", ar: "نشر خدمة" },
  ORDER_COMPLETED: { en: "Completed an order", ar: "إكمال طلب" },
  ORDER_RECEIVED: { en: "Received an order", ar: "استلام طلب" },
  CAREER_PATH_CREATED: { en: "Created a career path", ar: "إنشاء مسار مهني" },
  CAREER_PATH_STEP_STARTED: { en: "Started a career step", ar: "بدء خطوة مسار" },
  CAREER_PATH_STEP_COMPLETED: {
    en: "Completed a career step",
    ar: "إكمال خطوة مسار",
  },
  CAREER_PATH_COMPLETED: {
    en: "Completed a career path",
    ar: "إكمال مسار مهني",
  },
  DAILY_LOGIN: { en: "Daily login", ar: "تسجيل دخول يومي" },
  PROFILE_COMPLETED: { en: "Completed profile", ar: "إكمال الملف الشخصي" },
  FIRST_REVIEW: { en: "First review", ar: "أول مراجعة" },
};