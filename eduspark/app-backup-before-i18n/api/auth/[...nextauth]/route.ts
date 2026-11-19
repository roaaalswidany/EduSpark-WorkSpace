import NextAuth, { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type Role } from "@prisma/client";
import { headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  checkRateLimit,
  getClientIdentifier,
  RateLimits,
} from "@/lib/security/rate-limit";
import { auditLog, AuditActions } from "@/lib/security/audit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(db),

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },

  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
    newUser: "/auth/welcome",
  },

  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        // ── 1. Validate input ─────────────────────────────────────
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          throw new Error("INVALID_INPUT");
        }

        const { email, password } = parsed.data;
        const normalizedEmail = email.toLowerCase().trim();

        // ── 2. Rate limiting (IP + Email) ─────────────────────────
        try {
          const hdrs = await headers();
          const ipIdentifier = getClientIdentifier(hdrs);
          const emailIdentifier = `email:${normalizedEmail}`;

          const [ipLimit, emailLimit] = await Promise.all([
            checkRateLimit(RateLimits.AUTH_LOGIN_IP, ipIdentifier),
            checkRateLimit(RateLimits.AUTH_LOGIN, emailIdentifier),
          ]);

          if (!ipLimit.allowed || !emailLimit.allowed) {
            void auditLog({
              action: AuditActions.AUTH_LOGIN_RATE_LIMITED,
              metadata: {
                email: normalizedEmail,
                ipIdentifier,
                ipRemaining: ipLimit.remaining,
                emailRemaining: emailLimit.remaining,
              },
              severity: "CRITICAL",
            });
            console.warn(
              `[AUTH_RATE_LIMIT] Blocked — IP:${ipIdentifier} email:${normalizedEmail}`
            );
            throw new Error("RATE_LIMITED");
          }
        } catch (err) {
          if (err instanceof Error && err.message === "RATE_LIMITED") {
            throw err;
          }
          console.warn("[AUTH_RATE_LIMIT] Check failed:", err);
        }

        // ── 3. Fetch user ─────────────────────────────────────────
        const user = await db.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            password: true,
            role: true,
            isActive: true,
            emailVerified: true,
          },
        });

        if (!user) {
          void auditLog({
            action: AuditActions.AUTH_LOGIN_FAILED,
            metadata: { email: normalizedEmail, reason: "NO_ACCOUNT" },
            severity: "WARNING",
          });
          throw new Error("NO_ACCOUNT");
        }

        if (!user.isActive) {
          void auditLog({
            action: AuditActions.AUTH_LOGIN_FAILED,
            userId: user.id,
            metadata: { email: normalizedEmail, reason: "ACCOUNT_DISABLED" },
            severity: "WARNING",
          });
          throw new Error("ACCOUNT_DISABLED");
        }

        if (!user.password) {
          throw new Error("OAUTH_ACCOUNT");
        }

        // ── 4. Verify password ────────────────────────────────────
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
          void auditLog({
            action: AuditActions.AUTH_LOGIN_FAILED,
            userId: user.id,
            metadata: { email: normalizedEmail, reason: "INVALID_PASSWORD" },
            severity: "WARNING",
          });
          throw new Error("INVALID_PASSWORD");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image ?? null,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as Role;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image ?? null;
      }

      // SECURITY: with NextAuth v4 the `session` argument of this callback is
      // the request body sent by the browser (`update(data)`), i.e. it is
      // attacker-controlled. Never copy fields from it. On an update trigger we
      // simply re-read the authoritative values from the database.
      if (trigger === "update" && token.id) {
        const fresh = await db.user.findUnique({
          where: { id: token.id },
          select: { role: true, name: true, image: true, isActive: true },
        });
        if (fresh?.isActive) {
          token.role = fresh.role;
          token.name = fresh.name;
          token.picture = fresh.image ?? null;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.name = token.name ?? "";
        session.user.email = token.email ?? "";
        session.user.image = token.picture as string | null | undefined;
      }

      return session;
    },
  },

  events: {
    async signIn({ user, isNewUser }) {
      void auditLog({
        action: AuditActions.AUTH_LOGIN_SUCCESS,
        userId: user.id!,
        metadata: { isNewUser: !!isNewUser },
      });

      if (isNewUser) {
        await db.notification.create({
          data: {
            userId: user.id!,
            title: "Welcome to EduSpark! 🎉",
            body: "Your account is ready. Start exploring courses and building your skills.",
            link: "/dashboard",
          },
        });
      }
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };