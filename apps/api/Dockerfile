FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY prisma ./prisma/

# Install all deps (including dev for build + prisma generate)
RUN npm install --include=dev

RUN npx prisma generate

# Cache-bust: forces Docker to re-copy source and rebuild
ARG CACHEBUST=1
COPY . .
RUN npx nest build

# --- Production stage ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install network scanning tools for LAN discovery
RUN apk add --no-cache \
    nmap \
    nmap-scripts \
    iputils \
    net-tools \
    bind-tools \
    openssh-client \
    net-snmp-tools \
    traceroute \
    curl

# Copy built app + prisma + seed + tsconfig (for ts-node seed)
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/agent ./agent
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE ${PORT:-4100}
ENTRYPOINT ["/app/docker-entrypoint.sh"]
