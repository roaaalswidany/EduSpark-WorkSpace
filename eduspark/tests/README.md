# Integration tests

These tests run the real Server Actions against a **real PostgreSQL + Redis**.
They **TRUNCATE all tables and FLUSH the Redis db** — never point them at your dev data.
`tests/setup.ts` refuses to start unless the database name contains `test` and Redis uses db >= 1.

```bash
# 1) one-time: create a throwaway database and apply the real migrations
createdb eduspark_test
DATABASE_URL=postgresql://USER:PASS@localhost:5432/eduspark_test npx prisma migrate deploy

# 2) run
DATABASE_URL=postgresql://USER:PASS@localhost:5432/eduspark_test \
REDIS_URL=redis://:REDISPASS@localhost:6379/1 \
npm test --workspace=eduspark
```

Outgoing email and real-time notifications are mocked; everything else is real.

## Chat end-to-end (optional, real WebSockets)
`tests/chat-e2e.test.ts` talks to a RUNNING production chat server and is skipped unless `CHAT_E2E_URL` is set:
```bash
cd eduspark-chat-server && npm run build
JWT_SECRET=... INTERNAL_API_SECRET=... REDIS_URL=redis://:PASS@localhost:6379/1 DATABASE_URL=<test db> node dist/server.js &
cd ../eduspark && CHAT_E2E_URL=http://localhost:3001 JWT_SECRET=... INTERNAL_API_SECRET=... npm test
```
