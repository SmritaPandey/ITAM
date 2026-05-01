FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY prisma ./prisma/

# Force dev deps install regardless of NODE_ENV
RUN npm install --include=dev

RUN npx prisma generate

COPY . .
RUN npx nest build

# --- Production stage ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
EXPOSE ${PORT:-4100}
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
