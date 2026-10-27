import type { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { BADGE_CATALOG } from "@/lib/gamification/badges";
import { CATEGORIES } from "@/prisma/seed/categories";

/**
 * Idempotent production bootstrap. Safe to run on every container start.
 *
 * Why this exists: badges, categories and the first admin used to exist only
 * through the DEMO seed script (which also wipes data). A fresh deployment
 * without it could never award a badge, never create a service (no categories)
 * and had no admin account.
 */
export async function ensureBadges(db: PrismaClient): Promise<number> {
  for (const b of BADGE_CATALOG) {
    const data = {
      name: b.name, nameAr: b.nameAr, description: b.description,
      descriptionAr: b.descriptionAr, icon: b.icon, tier: b.tier, xpReward: b.xpReward,
    };
    await db.badge.upsert({ where: { key: b.key }, create: { key: b.key, ...data }, update: data });
  }
  return BADGE_CATALOG.length;
}

export async function ensureCategories(db: PrismaClient): Promise<number> {
  for (const c of CATEGORIES) {
    await db.category.upsert({
      where: { slug: c.slug },
      create: { name: c.name, slug: c.slug, description: c.description, icon: c.icon },
      update: { name: c.name, description: c.description, icon: c.icon },
    });
  }
  return CATEGORIES.length;
}

/**
 * Creates the first ADMIN from env (ADMIN_EMAIL / ADMIN_PASSWORD) when no
 * admin exists. Never overwrites or promotes an existing account.
 */
export async function ensureAdmin(
  db: PrismaClient,
  env: { email?: string; password?: string; name?: string }
): Promise<"created" | "exists" | "skipped"> {
  if ((await db.user.count({ where: { role: "ADMIN" } })) > 0) return "exists";
  if (!env.email || !env.password) return "skipped";
  if (env.password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  const email = env.email.trim().toLowerCase();
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) return "skipped";
  await db.user.create({
    data: {
      name: env.name?.trim() || "Administrator",
      email,
      password: await bcrypt.hash(env.password, 12),
      role: "ADMIN",
      emailVerified: new Date(),
    },
  });
  return "created";
}

export async function ensureBaseData(
  db: PrismaClient,
  env: { email?: string; password?: string; name?: string } = {}
) {
  const badges = await ensureBadges(db);
  const categories = await ensureCategories(db);
  const admin = await ensureAdmin(db, env);
  return { badges, categories, admin };
}
