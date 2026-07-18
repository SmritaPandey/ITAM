FROM node:20.19-alpine AS builder
WORKDIR /app

# Bust Railway layer cache when source changes meaningfully
ARG CACHE_BUST=20260718-vapt-auth
RUN echo "cachebust=$CACHE_BUST"

COPY package.json ./
COPY prisma ./prisma/

# Install all deps (including dev for build + prisma generate)
RUN npm install --include=dev

RUN npx prisma generate

COPY . .
# Prefer tsc output (dist/main.js or dist/src/main.js); fail loudly on type errors
RUN npx nest build && (test -f dist/main.js -o -f dist/src/main.js || (echo "missing main.js" && find dist -name '*.js' | head -40 && exit 1))

# --- Production stage ---
FROM node:20.19-alpine
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
    curl \
    && addgroup -g 10001 qsasset \
    && adduser -u 10001 -G qsasset -h /app -D -s /sbin/nologin qsasset

# Copy built app + prisma + seed + tsconfig (for ts-node seed)
COPY --from=builder --chown=qsasset:qsasset /app/dist ./dist
COPY --from=builder --chown=qsasset:qsasset /app/node_modules ./node_modules
COPY --from=builder --chown=qsasset:qsasset /app/prisma ./prisma
COPY --from=builder --chown=qsasset:qsasset /app/package.json ./
COPY --from=builder --chown=qsasset:qsasset /app/tsconfig.json ./
COPY --from=builder --chown=qsasset:qsasset /app/agent ./agent
COPY --chown=qsasset:qsasset docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

USER qsasset
EXPOSE ${PORT:-4100}
ENTRYPOINT ["/app/docker-entrypoint.sh"]
