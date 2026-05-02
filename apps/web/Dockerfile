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

# Standalone output path (monorepo: .next/standalone/apps/web/)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./apps/web/.next/static
COPY --from=builder /app/public ./apps/web/public

EXPOSE 3100
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

WORKDIR /app/apps/web
CMD ["node", "server.js"]
