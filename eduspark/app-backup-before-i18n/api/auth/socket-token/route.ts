import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // getToken WITHOUT raw returns the DECODED payload (NextAuth handles
    // the JWE decryption internally using NEXTAUTH_SECRET).
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      return NextResponse.json(
        { error: "No active session found." },
        { status: 401 }
      );
    }

    // Re-sign as a standard JWS (HS256) — 3 parts — that the chat server
    // can verify with jsonwebtoken using the same secret.
    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Server misconfiguration: NEXTAUTH_SECRET missing." },
        { status: 500 }
      );
    }

    const chatToken = jwt.sign(
  {
    sub: token.sub ?? token.id,
    id: token.id ?? token.sub,
    name: token.name,
    email: token.email,
    role: token.role,
    picture: token.picture,
  },
  secret,
  { algorithm: "HS256", expiresIn: "1h" }
);

    return NextResponse.json(
      { token: chatToken },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("[SOCKET_TOKEN_ROUTE]", error);
    return NextResponse.json(
      { error: "Failed to retrieve authentication token." },
      { status: 500 }
    );
  }
}