import { defineConfig } from "vitest/config";
import path from "path";

// Integration tests run against a REAL Postgres + Redis (see docker-compose.test
// notes in tests/README.md). They never touch the dev database: point
// DATABASE_URL at a throwaway database before running `npm test`.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    fileParallelism: false, // one shared DB → run files sequentially
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      NODE_ENV: "test",
      NEXTAUTH_SECRET: "test-secret-test-secret-test-secret-123456",
      NEXTAUTH_URL: "http://localhost:3000",
    },
  },
});
