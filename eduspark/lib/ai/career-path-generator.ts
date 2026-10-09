// eduspark/lib/ai/career-path-generator.ts
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// ─── Constants ────────────────────────────────────────────────────

const MODEL_NAME = "gemini-3.8-flash";
const MAX_OUTPUT_TOKENS = 4096;

// ─── Types ────────────────────────────────────────────────────────

export interface CareerPathContext {
  userName: string;
  currentLevel: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  existingCourses: Array<{ title: string; level: string }>;
  existingCertificates: Array<{ courseTitle: string }>;
  preferredLanguage: "ar" | "en";
}

export interface GeneratedStep {
  title: string;
  description: string;
  courseSlug: string | null;
  estimatedWeeks: number;
  skills: string[];
}

export interface GeneratedPath {
  goal: string;
  level: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  description: string;
  estimatedWeeks: number;
  steps: GeneratedStep[];
}

export interface GenerateResult {
  success: boolean;
  data?: GeneratedPath;
  error?: string;
}

// ─── Zod Validation Schema (for AI response) ─────────────────────

const GeneratedPathSchema = z.object({
  goal: z.string().min(3).max(200),
  level: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]),
  description: z.string().min(20).max(1000),
  estimatedWeeks: z.number().int().min(1).max(104),
  steps: z
    .array(
      z.object({
        title: z.string().min(3).max(200),
        description: z.string().min(20).max(1500),
        courseSlug: z.string().nullable(),
        estimatedWeeks: z.number().int().min(1).max(52),
        skills: z.array(z.string()).min(1).max(10),
      })
    )
    .min(3)
    .max(12),
});

// ─── Gemini Client ────────────────────────────────────────────────

let aiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[CAREER_PATH] GEMINI_API_KEY not set");
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

// ─── Prompt Builder ───────────────────────────────────────────────

function buildPrompt(
  goal: string,
  context: CareerPathContext,
  availableCourses: Array<{
    title: string;
    slug: string;
    level: string;
    tags: string[];
  }>
): string {
  const isArabic = context.preferredLanguage === "ar";

  const coursesList = availableCourses
    .map(
      (c) =>
        `- Title: "${c.title}" | Slug: "${c.slug}" | Level: ${c.level} | Tags: [${c.tags.join(", ")}]`
    )
    .join("\n");

  const userCourses =
    context.existingCourses.length > 0
      ? context.existingCourses
          .map((c) => `- ${c.title} (${c.level})`)
          .join("\n")
      : isArabic
      ? "لا يوجد"
      : "None";

  const userCerts =
    context.existingCertificates.length > 0
      ? context.existingCertificates.map((c) => `- ${c.courseTitle}`).join("\n")
      : isArabic
      ? "لا يوجد"
      : "None";

  if (isArabic) {
    return `أنت خبير في التطوير المهني وبناء المسارات التعليمية.

## هدف المستخدم
"${goal}"

## سياق المستخدم
- الاسم: ${context.userName}
- المستوى الحالي: ${context.currentLevel}
- الكورسات المسجل فيها حالياً:
${userCourses}
- الشهادات الحالية:
${userCerts}

## الكورسات المتاحة على المنصة
${coursesList}

## مهمتك
ابنِ مسار تعلم مخصص لتحقيق الهدف، بناءً على:
1. **مستوى المستخدم الحالي** — ابدأ من مستواه (لا تعيد تعليمه ما يعرفه)
2. **الكورسات المتاحة** — اربط كل خطوة بكورس فعلي (استخدم exact "Slug")
3. **ترتيب منطقي** — من الأساسيات إلى المتقدم
4. **مدة واقعية** — بالأسابيع (أسبوع = 5-10 ساعات تعلم)

## قواعد صارمة
- عدد الخطوات: 4-8 خطوات (لا أكثر)
- كل خطوة لها عنوان واضح ووصف 2-3 جمل
- Skills: 2-5 مهارات لكل خطوة
- الـ courseSlug يجب أن يكون **من القائمة أعلاه فقط** (أو null إذا لا يوجد كورس مناسب)
- المدة الكلية = مجموع مدد الخطوات
- الرد بالعربية الفصحى السلسة

## صيغة الرد (JSON فقط، بدون أي نص إضافي)
\`\`\`json
{
  "goal": "الهدف كما هو",
  "level": "BEGINNER | INTERMEDIATE | ADVANCED",
  "description": "وصف موجز للمسار (2-3 جمل)",
  "estimatedWeeks": 24,
  "steps": [
    {
      "title": "عنوان الخطوة",
      "description": "وصف تفصيلي للخطوة وما سيتم إنجازه",
      "courseSlug": "exact-slug-from-list" أو null,
      "estimatedWeeks": 4,
      "skills": ["مهارة 1", "مهارة 2"]
    }
  ]
}
\`\`\``;
  }

  return `You are a career development expert specialized in building personalized learning paths.

## User's Goal
"${goal}"

## User Context
- Name: ${context.userName}
- Current level: ${context.currentLevel}
- Currently enrolled courses:
${userCourses}
- Existing certificates:
${userCerts}

## Available Courses on Platform
${coursesList}

## Your Task
Build a personalized learning path to achieve the goal, based on:
1. **Current user level** — Start from their level (don't re-teach known skills)
2. **Available courses** — Link each step to an actual course (use exact "Slug")
3. **Logical order** — From fundamentals to advanced
4. **Realistic duration** — In weeks (week = 5-10 learning hours)

## Strict Rules
- Number of steps: 4-8 (no more)
- Each step has clear title and 2-3 sentence description
- Skills: 2-5 skills per step
- courseSlug MUST be from the list above (or null if no suitable course)
- Total duration = sum of step durations
- Response in clear English

## Response Format (JSON only, no extra text)
\`\`\`json
{
  "goal": "goal as provided",
  "level": "BEGINNER | INTERMEDIATE | ADVANCED",
  "description": "Brief path description (2-3 sentences)",
  "estimatedWeeks": 24,
  "steps": [
    {
      "title": "Step title",
      "description": "Detailed description of what will be accomplished",
      "courseSlug": "exact-slug-from-list" or null,
      "estimatedWeeks": 4,
      "skills": ["skill 1", "skill 2"]
    }
  ]
}
\`\`\``;
}

// ─── Main Function ────────────────────────────────────────────────

export async function generateCareerPath(
  goal: string,
  context: CareerPathContext,
  availableCourses: Array<{
    title: string;
    slug: string;
    level: string;
    tags: string[];
  }>
): Promise<GenerateResult> {
  const client = getClient();
  if (!client) {
    return { success: false, error: "GEMINI_NOT_CONFIGURED" };
  }

  if (!goal || goal.trim().length < 5) {
    return { success: false, error: "GOAL_TOO_SHORT" };
  }

  if (availableCourses.length === 0) {
    return { success: false, error: "NO_COURSES_AVAILABLE" };
  }

  try {
    const prompt = buildPrompt(goal.trim(), context, availableCourses);

    const response = await client.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    });

    const text = response.text;
    if (!text) {
      return { success: false, error: "EMPTY_RESPONSE" };
    }

    // Extract JSON from response (handle ```json ... ``` wrapping)
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text.trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error("[CAREER_PATH] Failed to parse JSON:", jsonStr.slice(0, 200));
      return { success: false, error: "INVALID_JSON" };
    }

    // Validate with Zod
    const validation = GeneratedPathSchema.safeParse(parsed);
    if (!validation.success) {
      console.error(
        "[CAREER_PATH] Validation failed:",
        validation.error.flatten()
      );
      return { success: false, error: "INVALID_STRUCTURE" };
    }

    return { success: true, data: validation.data };
  } catch (error) {
    console.error("[CAREER_PATH] Generation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.includes("429") || message.toLowerCase().includes("quota")) {
      return { success: false, error: "RATE_LIMITED" };
    }

    return { success: false, error: "GEMINI_ERROR" };
  }
}