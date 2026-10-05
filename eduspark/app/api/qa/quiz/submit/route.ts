// app/api/qa/quiz/submit/route.ts
import { NextRequest, NextResponse } from "next/server";
import { submitQuizAction } from "@/actions/lms/submit-quiz";

const STATUS_MAP: Record<string, number> = {
  UNAUTHORIZED: 401,
  INVALID_INPUT: 400,
  QUIZ_NOT_FOUND: 404,
  NOT_ENROLLED: 403,
  QUESTION_COUNT_MISMATCH: 400,
  INVALID_QUESTION_IDS: 400,
  SERVER_ERROR: 500,
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "INVALID_JSON" },
      { status: 400 }
    );
  }

  const result = await submitQuizAction(body as Parameters<typeof submitQuizAction>[0]);

  return NextResponse.json(result, {
    status: result.success ? 200 : STATUS_MAP[result.error] ?? 400,
  });
}