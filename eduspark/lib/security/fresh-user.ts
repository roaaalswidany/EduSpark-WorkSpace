import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

/**
 * Authoritative role/status read straight from the database.
 *
 * The role inside the NextAuth JWT is a snapshot taken at login and can be up
 * to 30 days stale. Anything that grants privileges (admin mutations, creating
 * services) must use this instead of trusting `session.user.role`.
 */
export async function getFreshUser(
  userId: string
): Promise<{ role: Role; isActive: boolean; emailVerified: Date | null } | null> {
  return db.user.findUnique({
    where: { id: userId },
    select: { role: true, isActive: true, emailVerified: true },
  });
}
