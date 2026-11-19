import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import type { Role } from "@prisma/client";

const intlMiddleware = createMiddleware(routing);

const ADMIN_REVIEW_PATHS = [
  /^\/dashboard\/creator\/courses\/[^/]+\/edit(\/.*)?$/,
  /^\/dashboard\/creator\/courses\/[^/]+\/quiz(\/.*)?$/,
];

const ROUTE_ROLES: Array<{ prefix: string; allowed: Role[] }> = [
  { prefix: "/admin", allowed: ["ADMIN"] },
  { prefix: "/dashboard/admin", allowed: ["ADMIN"] },
  { prefix: "/dashboard/creator", allowed: ["CREATOR"] },
  { prefix: "/dashboard/student", allowed: ["STUDENT", "CREATOR"] },
  { prefix: "/dashboard/orders", allowed: ["STUDENT", "CREATOR"] },
  { prefix: "/dashboard/projects", allowed: ["STUDENT", "CREATOR"] },
  { prefix: "/dashboard/career-path", allowed: ["STUDENT", "CREATOR"] },
  { prefix: "/dashboard/achievements", allowed: ["STUDENT", "CREATOR"] },
];

function getRedirectPath(pathname: string, role: Role | undefined): string | null {
  if (role === "ADMIN" && ADMIN_REVIEW_PATHS.some((re) => re.test(pathname))) {
    return null;
  }
  for (const rule of ROUTE_ROLES) {
    if (!pathname.startsWith(rule.prefix)) continue;
    const isAllowed = role !== undefined && rule.allowed.includes(role);
    if (!isAllowed) {
      if (role === "ADMIN") return "/dashboard/admin";
      return "/unauthorized";
    }
  }
  return null;
}

function detectLocale(pathname: string): "en" | "ar" {
  const match = pathname.match(/^\/(en|ar)(?=\/|$)/);
  return (match?.[1] as "en" | "ar") || "en";
}

function localizeHref(path: string, locale: "en" | "ar"): string {
  // For default locale (en), no prefix; for ar, prefix it
  return locale === "en" ? path : `/${locale}${path}`;
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const locale = detectLocale(pathname);

  // Strip locale to check protected routes (ignore /en, /ar)
  const pathNoLocale = pathname.replace(/^\/(en|ar)(?=\/|$)/, "") || "/";
  const isProtected =
    pathNoLocale.startsWith("/dashboard") || pathNoLocale.startsWith("/admin");

  // ── Protected routes: verify auth & role ─────────────────────
  if (isProtected) {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
      const loginUrl = new URL(localizeHref("/auth/login", locale), req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const role = token.role as Role | undefined;
    const redirectPath = getRedirectPath(pathNoLocale, role);

    if (redirectPath) {
      const target = localizeHref(redirectPath, locale);
      const url = new URL(target, req.url);
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  }

  // ── Apply locale routing (detection, rewrite) ────────────────
  return intlMiddleware(req);
}

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};