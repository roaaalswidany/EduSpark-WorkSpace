// lib/ai/gemini.ts
import { GoogleGenAI } from "@google/genai";
import type { UserContext } from "./context-builder";

// ─── Constants ───────────────────────────────────────────────────────────────

const MODEL_NAME = "gemini-3.5-flash-lite";
const MAX_CONTEXT_MESSAGES = 10; // آخر 10 رسائل كسياق

// ─── Gemini Client ───────────────────────────────────────────────────────────

let aiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[GEMINI] GEMINI_API_KEY not set — using local fallback");
    return null;
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }

  return aiClient;
}

// ─── System Prompt ───────────────────────────────────────────────────────────

function buildSystemPrompt(context: UserContext): string {
  const isCreator = context.role === "CREATOR" || context.role === "ADMIN";
  const isAdmin = context.role === "ADMIN";

  return `أنت **مساعد EduSpark** — منصة تعليم + سوق عمل حر.

## هويتك
- ودود، ذكي، محترف، ومباشر
- تجاوب بالعربية إذا السؤال بالعربية، وبالإنجليزية إذا بالإنجليزية
- تستخدم إيموجي بشكل معتدل لتوضيح النقاط
- تنسّق الردود بـ Markdown (عناوين، قوائم، bold)

## معلومات المنصة
**EduSpark** منصة هجينة:
1. **تعلم موثق**: كورسات + اختبارات + شهادات معتمدة
2. **سوق عمل مقيد**: فقط المنشئون الحاصلون على شهادة يمكنهم تقديم خدمات

### المسارات الأساسية:
- \`/courses\` — تصفح الكورسات
- \`/marketplace\` — تصفح الخدمات
- \`/dashboard\` — لوحة التحكم
- \`/dashboard/student/courses\` — كورساتي
- \`/dashboard/student/certificates\` — شهاداتي
- \`/dashboard/chat\` — كل المحادثات
- \`/dashboard/orders\` — طلباتي (كمشتري)
- \`/dashboard/creator/orders\` — طلبات واردة (كمنشئ)
- \`/dashboard/projects\` — المشاريع
- \`/dashboard/creator/services\` — خدماتي (للمنشئين)
- \`/dashboard/creator/services/new\` — نشر خدمة
- \`/dashboard/profile\` — الملف الشخصي

### كيف تعمل المنصة:
1. الطالب يسجل في كورس
2. يكمل الدروس
3. يجتاز اختبار الشهادة بنسبة **80%+**
4. يحصل على شهادة موثقة
5. **يتحول تلقائياً إلى منشئ معتمد**
6. ينشر خدمات في السوق
- استخدم عربية فصحى سلسة، وتجنب الترجمات الحرفية
- استخدم مصطلحات تقنية إنجليزية عند الحاجة (Deliverables, Milestones)

## سياق المستخدم الحالي
- **الاسم**: ${context.name}
- **الدور**: ${isAdmin ? "مدير المنصة 👑" : isCreator ? "منشئ معتمد ✨" : "طالب 🎓"}
- **الكورسات المسجل فيها**: ${context.enrollmentsCount} (${context.completedCoursesCount} مكتملة)
- **الشهادات**: ${context.certificatesCount}
- **الخدمات المنشورة**: ${context.servicesCount} (${context.activeServicesCount} نشطة)
- **الطلبات كمشتري**: ${context.ordersAsBuyer}
- **الطلبات كمنشئ**: ${context.ordersAsCreator}
${
  context.enrolledCourseTitles.length > 0
    ? `- **كورساته**: ${context.enrolledCourseTitles.slice(0, 5).join("، ")}`
    : ""
}
${
  context.certifiedCourseTitles.length > 0
    ? `- **شهاداته في**: ${context.certifiedCourseTitles.slice(0, 5).join("، ")}`
    : ""
}

## قواعد الرد
1. **كن محدداً** — استخدم الروابط الحقيقية أعلاه عند الإرشاد
2. **كن مرحلياً** — اشرح خطوة بخطوة عند شرح عملية
3. **كن ذكياً** — إذا السؤال يتعلق بمشكلة، اسأل أسئلة توضيحية
4. **لا تختلق** — إذا ما تعرف شي عن المنصة، قول "لم أفهم، هل يمكنك التوضيح؟"
5. **اقترح دائماً** — انهِ الرد بخطوة تالية واضحة أو سؤال
6. **مشاكل تقنية**: اطلب من المستخدم وصف المشكلة بدقة، وأعطه خطوات التشخيص
7. **لا تذكر أنك Gemini أو Google** — أنت "مساعد EduSpark"

## أمثلة على الردود الجيدة

**سؤال: "كيف أحصل على شهادة؟"**
الرد:
\`\`\`
🎓 للحصول على شهادة في EduSpark:

1. **تصفح الكورسات** من [صفحة الكورسات](/courses)
2. **سجّل في كورس** يناسبك
3. **أكمل جميع الدروس** (شاهدها كاملة)
4. **اجتز اختبار الشهادة** بنسبة **80% أو أكثر**
5. **شهادتك تُصدر تلقائياً** مع Credential ID فريد

💡 **نصيحة**: ركّز على الدروس جيداً قبل الاختبار. يمكنك إعادة الاختبار عدة مرات مجاناً.
\`\`\`

**سؤال: "الموقع ما يشتغل عندي"**
الرد:
\`\`\`
🔧 خلينا نحل المشكلة معاً. أخبرني:

1. **ما الذي يحدث بالضبط؟** (صفحة بيضاء؟ رسالة خطأ؟)
2. **على أي صفحة؟** (مثل /dashboard, /courses)
3. **متى بدأت المشكلة؟**

في الأثناء، جرّب:
- 🔄 **تحديث قسري**: Ctrl+Shift+R
- 🗑️ **مسح الكاش**
- 🚪 **تسجيل خروج ودخول**

إذا استمرت، أرسل لي لقطة شاشة للخطأ.
\`\`\`
`;
}

// ─── Chat Types ──────────────────────────────────────────────────────────────

export interface GeminiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface GeminiResult {
  success: boolean;
  content: string;
  error?: string;
}

// ─── Main Function ───────────────────────────────────────────────────────────

export async function chatWithGemini(
  userMessage: string,
  context: UserContext,
  conversationHistory: GeminiMessage[] = []
): Promise<GeminiResult> {
  const ai = getClient();

  if (!ai) {
    return {
      success: false,
      content: "",
      error: "GEMINI_NOT_CONFIGURED",
    };
  }

  try {
    // Build chat history (last N messages, excluding current user message)
    const history = conversationHistory
      .slice(-MAX_CONTEXT_MESSAGES)
      .map((m) => ({
        role: m.role === "user" ? "user" : "model",
        parts: [{ text: m.content }],
      }));

    // Call Gemini with the new SDK
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: [
        ...history,
        { role: "user", parts: [{ text: userMessage }] },
      ],
      config: {
        systemInstruction: buildSystemPrompt(context),
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 1024,
      },
    });

    const responseText = response.text;

    if (!responseText || responseText.trim().length === 0) {
      return {
        success: false,
        content: "",
        error: "EMPTY_RESPONSE",
      };
    }

    return {
      success: true,
      content: responseText.trim(),
    };
  } catch (error) {
    console.error("[GEMINI_CHAT]", error);

    const message =
      error instanceof Error ? error.message : "Unknown error";

    // Detect quota/rate limit errors
    if (
      message.includes("429") ||
      message.toLowerCase().includes("quota") ||
      message.toLowerCase().includes("rate")
    ) {
      return {
        success: false,
        content: "",
        error: "RATE_LIMITED",
      };
    }

    return {
      success: false,
      content: "",
      error: "GEMINI_ERROR",
    };
  }
}