/**
 * Safety rails for the DEMO seed (prisma/seed.ts).
 *
 * The seed WIPES all content (courses, services, projects, enrollments, chats…)
 * and creates demo accounts that share a PUBLIC password (see config.ts).
 * It must therefore never run against a deployed / remote database by accident.
 */
const LOCAL_HOSTS = new Set([
  "localhost", "127.0.0.1", "::1", "[::1]",
  "postgres", "db", "host.docker.internal", // docker-compose service names
]);

export function databaseHost(databaseUrl: string | undefined): string {
  if (!databaseUrl) throw new Error("DATABASE_URL is not set.");
  try {
    return new URL(databaseUrl).hostname.toLowerCase();
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
}

export function assertSeedAllowed(env: Record<string, string | undefined> = process.env): void {
  if (env.NODE_ENV === "production" && env.ALLOW_SEED_IN_PRODUCTION !== "true") {
    throw new Error(
      "Refusing to run the demo seed with NODE_ENV=production: it deletes data and creates " +
        "accounts with a publicly known password. Use `npm run bootstrap` for production."
    );
  }
  const host = databaseHost(env.DATABASE_URL);
  if (!LOCAL_HOSTS.has(host) && env.ALLOW_SEED_REMOTE !== "true") {
    throw new Error(
      `Refusing to run the demo seed against a non-local database host ("${host}"): it WIPES data. ` +
        "If this is a throwaway cloud dev database, re-run with ALLOW_SEED_REMOTE=true."
    );
  }
}
