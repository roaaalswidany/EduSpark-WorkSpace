# syntax=docker/dockerfile:1
# Multi-stage build for the EduSpark web app (Next.js 16, npm workspaces monorepo).
# Build context = REPOSITORY ROOT:
#   docker build -f eduspark/Dockerfile \
#     --build-arg NEXT_PUBLIC_CHAT_SERVER_URL=https://chat.example.com -t eduspark-web .

FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# ─── Dependencies ────────────────────────────────────────────
# npm workspaces hoist everything into /app/node_modules (there is no eduspark/node_modules).
FROM base AS deps
COPY package.json package-lock.json ./
COPY eduspark/package.json ./eduspark/
COPY eduspark-chat-server/package.json ./eduspark-chat-server/
# --ignore-scripts: eduspark's `postinstall` runs `prisma generate`, which needs the schema
# (not copied yet). Generation happens explicitly in the builder stage.
RUN npm ci --ignore-scripts

# ─── Builder ─────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# prisma.config.ts requires DATABASE_URL to exist at generate/build time. This dummy value is
# never used to connect. NOTE: if any page is statically generated at build time and queries the
# database, the build needs a reachable DB (or mark that page `export const dynamic = "force-dynamic"`).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
# Public env vars are inlined into the client bundle at BUILD time.
ARG NEXT_PUBLIC_CHAT_SERVER_URL=http://localhost:3001
ENV NEXT_PUBLIC_CHAT_SERVER_URL=$NEXT_PUBLIC_CHAT_SERVER_URL
ENV NEXT_TELEMETRY_DISABLED=1

# The ERD generator writes to eduspark/docs/ (which .dockerignore excludes).
RUN mkdir -p eduspark/docs && cd eduspark && npx prisma generate
RUN cd eduspark && npx next build

# ─── Runner ──────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/eduspark ./eduspark
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./

USER nextjs
WORKDIR /app/eduspark
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ > /dev/null 2>&1 || exit 1

CMD ["npm", "start"]
