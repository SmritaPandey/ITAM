FROM node:20-alpine AS builder
WORKDIR /app

# Accept API URL as build arg (Next.js bakes NEXT_PUBLIC_* at build time)
ARG NEXT_PUBLIC_API_URL=http://localhost:4100/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Production stage (standalone) ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 10001 qsasset \
  && adduser -u 10001 -G qsasset -h /app -D -s /sbin/nologin qsasset

# Standalone output path (monorepo: .next/standalone/apps/web/)
COPY --from=builder --chown=qsasset:qsasset /app/.next/standalone ./
COPY --from=builder --chown=qsasset:qsasset /app/.next/static ./apps/web/.next/static
COPY --from=builder --chown=qsasset:qsasset /app/public ./apps/web/public

USER qsasset
EXPOSE 3100
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

WORKDIR /app/apps/web
CMD ["node", "server.js"]
