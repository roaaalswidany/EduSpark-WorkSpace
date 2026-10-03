import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // Retrieve the raw, signed NextAuth JWT — this is the same token
    // the standalone chat server will verify against NEXTAUTH_SECRET.
    const rawToken = await getToken({
      req,
      raw: true,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!rawToken) {
      return NextResponse.json(
        { error: "No active session found." },
        { status: 401 }
      );
    }

    // Never cache — always issue a fresh token for socket auth
    return NextResponse.json(
      { token: rawToken },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
        },
      }
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to retrieve authentication token." },
      { status: 500 }
    );
  }
}