// eduspark/lib/ai/career-path-generator.ts
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

// ─── Constants ────────────────────────────────────────────────────

const MODEL_NAME = "gemini-3.8-flash";
const MAX_OUTPUT_TOKENS = 8192;      // ↑ from 4096 (avoids JSON truncation)
const REQUEST_TIMEOUT_MS = 90_000;   // ↑ from default 10s
const MAX_RETRIES = 2;

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

// ─── Zod Validation ──────────────────────────────────────────────

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
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: REQUEST_TIMEOUT_MS,
        retryOptions: {
          attempts: MAX_RETRIES + 1,
          initialDelayMs: 2000,
          maxDelayMs: 8000,
        },
      },
    });
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
- **عدد الخطوات: 4-6 خطوات فقط** (لا تزيد)
- كل خطوة: عنوان قصير + وصف 2-3 جمل
- Skills: 2-4 مهارات لكل خطوة
- **الـ courseSlug يجب أن يكون exact من القائمة أعلاه** (أو null إذا لا يوجد)
- المدة الكلية = مجموع مدد الخطوات
- **اجعل الرد مختصرًا ومباشرًا** — لا تكتب أي نص قبل أو بعد JSON

## صيغة الرد (JSON فقط)
\`\`\`json
{
  "goal": "${goal}",
  "level": "BEGINNER",
  "description": "وصف موجز (2-3 جمل)",
  "estimatedWeeks": 24,
  "steps": [
    {
      "title": "عنوان الخطوة",
      "description": "وصف الخطوة (2-3 جمل)",
      "courseSlug": "exact-slug" أو null,
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
Build a personalized learning path to achieve the goal based on:
1. Current user level (don't re-teach known skills)
2. Available courses (use EXACT slug from list above)
3. Logical order from fundamentals to advanced
4. Realistic duration in weeks

## Strict Rules
- **Steps: 4-6 MAX** (no more)
- Each step: short title + 2-3 sentence description
- Skills: 2-4 per step
- **courseSlug MUST be exact from list above** (or null)
- Total weeks = sum of step durations
- **Keep response concise** — no text before/after JSON

## Response Format (JSON only)
\`\`\`json
{
  "goal": "${goal}",
  "level": "BEGINNER",
  "description": "Brief description (2-3 sentences)",
  "estimatedWeeks": 24,
  "steps": [
    {
      "title": "Step title",
      "description": "2-3 sentence description",
      "courseSlug": "exact-slug" or null,
      "estimatedWeeks": 4,
      "skills": ["skill 1", "skill 2"]
    }
  ]
}
\`\`\``;
}

// ─── Helpers ──────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("503") ||
    msg.includes("unavailable") ||
    msg.includes("timeout") ||
    msg.includes("connect timeout") ||
    msg.includes("etimedout") ||
    msg.includes("econnreset") ||
    msg.includes("fetch failed") ||
    msg.includes("429") ||
    msg.includes("rate")
  );
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

  const prompt = buildPrompt(goal.trim(), context, availableCourses);

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const waitMs = 2000 * attempt;
        console.log(
          `[CAREER_PATH] Retry attempt ${attempt}/${MAX_RETRIES} after ${waitMs}ms...`
        );
        await sleep(waitMs);
      }

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
        lastError = new Error("EMPTY_RESPONSE");
        continue;
      }

      // Extract JSON (handle ```json ... ``` wrapping)
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : text.trim();

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        console.error(
          "[CAREER_PATH] JSON parse failed. Preview:",
          jsonStr.slice(0, 300)
        );
        lastError = new Error("INVALID_JSON");
        continue; // Retry on JSON parse failure (may be truncated)
      }

      const validation = GeneratedPathSchema.safeParse(parsed);
      if (!validation.success) {
        console.error(
          "[CAREER_PATH] Validation failed:",
          validation.error.flatten()
        );
        lastError = new Error("INVALID_STRUCTURE");
        continue;
      }

      return { success: true, data: validation.data };
    } catch (error) {
      lastError = error;
      console.error(
        `[CAREER_PATH] Attempt ${attempt + 1} failed:`,
        error instanceof Error ? error.message : error
      );

      if (!isRetryableError(error)) {
        break;
      }
    }
  }

  // All retries failed — map error
  const msg =
    lastError instanceof Error ? lastError.message : "Unknown error";

  if (msg.includes("429") || msg.toLowerCase().includes("rate")) {
    return { success: false, error: "RATE_LIMITED" };
  }
  if (msg === "INVALID_JSON" || msg === "INVALID_STRUCTURE") {
    return { success: false, error: "GEMINI_ERROR" };
  }

  return { success: false, error: "GEMINI_ERROR" };
}