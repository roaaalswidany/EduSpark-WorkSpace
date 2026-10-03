import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";

// Route → allowed roles map
const ROUTE_ROLES: Array<{ prefix: string; allowed: Role[] }> = [
  { prefix: "/admin", allowed: ["ADMIN"] },
  { prefix: "/dashboard/creator", allowed: ["CREATOR"] },
  { prefix: "/dashboard/student", allowed: ["STUDENT", "CREATOR"] },
];

function getRedirectUrl(
  req: NextRequestWithAuth,
  role: Role | undefined
): string | null {
  const { pathname } = req.nextUrl;

  for (const rule of ROUTE_ROLES) {
    if (!pathname.startsWith(rule.prefix)) continue;

    const isAllowed = role !== undefined && rule.allowed.includes(role);

    if (!isAllowed) {
      // Authenticated but wrong role → 403 page
      // Unauthenticated → handled by withAuth's authorized callback already
      return "/unauthorized";
    }
  }

  return null;
}

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const role = req.nextauth.token?.role as Role | undefined;

    const redirectPath = getRedirectUrl(req, role);

    if (redirectPath) {
      const url = req.nextUrl.clone();
      url.pathname = redirectPath;
      // Preserve the attempted URL so we can show context on the error page
      url.searchParams.set("from", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // withAuth runs our middleware only when this returns true
      // If token is missing, NextAuth redirects to signIn automatically
      authorized({ token }) {
        return token !== null;
      },
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
  ],
};