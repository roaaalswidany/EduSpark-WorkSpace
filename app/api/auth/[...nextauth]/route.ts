import NextAuth, { type AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(db),

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,     // 30 days
    updateAge: 24 * 60 * 60,        // re-issue token once per day
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
        const parsed = credentialsSchema.safeParse(credentials);

        if (!parsed.success) {
          throw new Error("INVALID_INPUT");
        }

        const { email, password } = parsed.data;

        const user = await db.user.findUnique({
          where: { email: email.toLowerCase().trim() },
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
          throw new Error("NO_ACCOUNT");
        }

        if (!user.isActive) {
          throw new Error("ACCOUNT_DISABLED");
        }

        if (!user.password) {
          throw new Error("OAUTH_ACCOUNT");
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
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
    async jwt({ token, user, trigger, session }) {
      // Initial sign-in: populate token from DB user
      if (user) {
        token.id = user.id;
        token.role = user.role as Role;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image ?? null;
      }

      // Session update triggered by useSession().update()
      if (trigger === "update" && session) {
        if (session.name) token.name = session.name;
        if (session.image) token.picture = session.image;
        if (session.role) token.role = session.role as Role;
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