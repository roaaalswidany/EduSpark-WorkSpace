// ============================================================================
// Intent Classification — Rule-based NLP for EduSpark AI Assistant
// ============================================================================

export type AiIntent =
  | "greeting"
  | "thanks"
  | "my_courses"
  | "recommend_course"
  | "course_catalog"
  | "my_certificates"
  | "how_to_get_certified"
  | "how_to_enroll"
  | "quiz_help"
  | "marketplace_help"
  | "become_creator"
  | "my_services"
  | "order_help"
  | "my_orders"
  | "chat_help"
  | "profile_help"
  | "pricing"
  | "technical_support"
  | "about_platform"
  | "fallback";

export type DetectedLanguage = "ar" | "en";

// ─── Language Detection ──────────────────────────────────────────────────────

const ARABIC_REGEX = /[\u0600-\u06FF]/;

export function detectLanguage(text: string): DetectedLanguage {
  return ARABIC_REGEX.test(text) ? "ar" : "en";
}

// ─── Keyword Patterns ────────────────────────────────────────────────────────

interface IntentPattern {
  intent: AiIntent;
  patterns: RegExp[];
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "greeting",
    patterns: [
      /^(hi|hello|hey|salut|hola)\b/i,
      /^(السلام|سلام|مرحب|أهلا|اهلا|هلا|صباح|مساء)/,
      /good (morning|evening|afternoon)/i,
    ],
  },
  {
    intent: "thanks",
    patterns: [
      /\b(thanks|thank you|thx|merci)\b/i,
      /(شكرا|مشكور|يعطيك|جزاك|أشكرك)/,
    ],
  },
  {
    intent: "my_courses",
    patterns: [
      /\b(my courses|enrolled|my learn|مشترك|كورساتي|دوراتي|مسجل)\b/i,
      /(الدورات التي|الكورسات التي|ايش عندي)/,
    ],
  },
  {
    intent: "recommend_course",
    patterns: [
      /\b(recommend|suggest|what should i learn)\b/i,
      /(اقترح|رشح|شنو اتعلم|ماذا أتعلم|أنصحني)/,
    ],
  },
  {
    intent: "course_catalog",
    patterns: [
      /\b(browse courses|all courses|available courses|catalog|explore courses)\b/i,
      /(استعرض الكورسات|كل الكورسات|الدورات المتاحة|تصفح)/,
    ],
  },
  {
    intent: "my_certificates",
    patterns: [
      /\b(my certificate|certificates i|my credentials)\b/i,
      /(شهاداتي|الشهادات|الإنجازات)/,
    ],
  },
  {
    intent: "how_to_get_certified",
    patterns: [
      /\b(how.*(get |earn|obtain).*certif|pass.*quiz|how.*quiz)\b/i,
      /(كيف أحصل على شهادة|كيف اجيب شهادة|كيف أتخرج|كيف انجح)/,
    ],
  },
  {
    intent: "how_to_enroll",
    patterns: [
      /\b(how.*(enroll|join|register.*course|buy.*course))\b/i,
      /(كيف أسجل|كيف اشترك|كيف أشتري كورس)/,
    ],
  },
  {
    intent: "quiz_help",
    patterns: [
      /\b(quiz|test|exam|passing score|assessment)\b/i,
      /(اختبار|امتحان|كويز|درجة النجاح)/,
    ],
  },
  {
    intent: "marketplace_help",
    patterns: [
      /\b(marketplace|buy service|hire|services|freelance)\b/i,
      /(السوق|الخدمات|استأجر|اشتري خدمة|سوق العمل)/,
    ],
  },
  {
    intent: "become_creator",
    patterns: [
      /\b(become.*(creator|freelancer|seller)|sell.*service|post.*service)\b/i,
      /(أصبح منشئ|اصير فريلانسر|أبيع خدمة|انشر خدمة)/,
    ],
  },
  {
    intent: "my_services",
    patterns: [
      /\b(my services|my listings|services i)\b/i,
      /(خدماتي|منشوراتي)/,
    ],
  },
  {
    intent: "order_help",
    patterns: [
      /\b(how.*order|place.*order|buy.*service)\b/i,
      /(كيف أطلب|كيف اطلب|كيف أشتري خدمة)/,
    ],
  },
  {
    intent: "my_orders",
    patterns: [
      /\b(my orders|my purchases|my projects|my requests)\b/i,
      /(طلباتي|مشترياتي|مشاريعي)/,
    ],
  },
  {
    intent: "chat_help",
    patterns: [
      /\b(chat|message|talk.*creator|contact)\b/i,
      /(الدردشة|الشات|الرسائل|تواصل)/,
    ],
  },
  {
    intent: "profile_help",
    patterns: [
      /\b(profile|my account|settings|edit.*profile)\b/i,
      /(الملف الشخصي|حسابي|الإعدادات|تعديل حسابي)/,
    ],
  },
  {
    intent: "pricing",
    patterns: [
      /\b(price|cost|how much|fee|payment)\b/i,
      /(السعر|التكلفة|كم|الدفع|مبلغ)/,
    ],
  },
  {
    intent: "technical_support",
    patterns: [
      /\b(problem|error|bug|not working|issue|broken|help.*fix)\b/i,
      /(مشكلة|خطأ|ما يشتغل|عطل|صعوبة|ما يعمل)/,
    ],
  },
  {
    intent: "about_platform",
    patterns: [
      /\b(what is eduspark|about.*platform|how.*work)\b/i,
      /(ما هي|عن المنصة|كيف تعمل|اشرح|ايش هي)/,
    ],
  },
];

// ─── Classifier ──────────────────────────────────────────────────────────────

export interface ClassificationResult {
  intent: AiIntent;
  language: DetectedLanguage;
  confidence: number; // 0-1
}

export function classifyIntent(message: string): ClassificationResult {
  const normalized = message.trim();
  const language = detectLanguage(normalized);

  if (!normalized) {
    return { intent: "fallback", language, confidence: 0 };
  }

  for (const { intent, patterns } of INTENT_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return { intent, language, confidence: 0.9 };
      }
    }
  }

  return { intent: "fallback", language, confidence: 0.3 };
}