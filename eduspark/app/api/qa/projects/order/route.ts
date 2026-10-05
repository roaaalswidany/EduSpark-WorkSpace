// app/api/qa/projects/order/route.ts
import { NextRequest, NextResponse } from "next/server";
import { orderServiceAction } from "@/actions/projects/order-service";

const STATUS_MAP: Record<string, number> = {
  UNAUTHORIZED: 401,
  INVALID_INPUT: 400,
  SERVICE_NOT_FOUND: 404,
  SERVICE_INACTIVE: 400,
  SELF_ORDER: 403,
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

  const result = await orderServiceAction(body as Parameters<typeof orderServiceAction>[0]);

  return NextResponse.json(result, {
    status: result.success ? 200 : STATUS_MAP[result.error] ?? 400,
  });
}