import { withAuth, type NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";

// Route → allowed roles map.
//
// NOTE: Admins are RESTRICTED to the administration panel only.
// They must not participate in student/creator flows (enrolling in courses,
// ordering services, publishing content, earning XP, etc.) because they are
// platform operators, not participants.
//
// Any route NOT listed here passes through for authenticated users
// (e.g. /dashboard/chat, /dashboard/notifications, /dashboard/profile,
//  /dashboard/settings, and the main /dashboard hub).
const ROUTE_ROLES: Array<{ prefix: string; allowed: Role[] }> = [
  // ── Admin-only ────────────────────────────────────────────────
  { prefix: "/admin", allowed: ["ADMIN"] },
  { prefix: "/dashboard/admin", allowed: ["ADMIN"] },

  // ── Participation-only (admin explicitly excluded) ────────────
  { prefix: "/dashboard/creator", allowed: ["CREATOR"] },
  { prefix: "/dashboard/student", allowed: ["STUDENT", "CREATOR"] },
  { prefix: "/dashboard/orders", allowed: ["STUDENT", "CREATOR"] },
  { prefix: "/dashboard/projects", allowed: ["STUDENT", "CREATOR"] },
  { prefix: "/dashboard/career-path", allowed: ["STUDENT", "CREATOR"] },
  { prefix: "/dashboard/achievements", allowed: ["STUDENT", "CREATOR"] },
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
      // Admins who try to access participation pages get bounced
      // to their own panel (silent, no confusing "Unauthorized" page).
      if (role === "ADMIN") {
        return "/dashboard/admin";
      }
      // Everyone else (wrong role) → explicit error page.
      return "/unauthorized";
    }
  }

  return null;
}

export default withAuth(
  function proxy(req: NextRequestWithAuth) {
    const role = req.nextauth.token?.role as Role | undefined;

    const redirectPath = getRedirectUrl(req, role);

    if (redirectPath) {
      const url = req.nextUrl.clone();
      url.pathname = redirectPath;
      // Preserve the attempted URL so we can show context if needed.
      url.searchParams.set("from", req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // withAuth runs our middleware only when this returns true.
      // If token is missing, NextAuth redirects to signIn automatically.
      authorized({ token }) {
        return token !== null;
      },
    },
  }
);

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"],
};