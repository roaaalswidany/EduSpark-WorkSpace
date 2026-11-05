# Multi-stage build for EduSpark (Next.js app)
# Uses Node 22 Alpine + Prisma + standalone-ish output

FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# ─── Dependencies ────────────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
COPY eduspark/package.json ./eduspark/
COPY eduspark-chat-server/package.json ./eduspark-chat-server/
RUN npm install --include-workspace-root

# ─── Builder ─────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/eduspark/node_modules ./eduspark/node_modules
COPY . .
RUN cd eduspark && npx prisma generate
ENV NEXT_TELEMETRY_DISABLED=1
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

CMD ["npm", "start"]
