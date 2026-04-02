# ─────────────────────────────────────────────
# Stage 1 — Install dependencies
# ─────────────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Install libc compat for native modules (ssh2, etc.)
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json ./
# Install ALL deps (including devDeps — tsx is needed at runtime)
RUN npm ci

# ─────────────────────────────────────────────
# Stage 2 — Build Next.js
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# NEXT_PUBLIC_ vars are embedded at build time by Next.js.
# Pass your public WebSocket URL here (must match your deployment domain).
# For same-host deployments, use: wss://your-domain.com
# For HTTP-only/local:            ws://your-domain.com
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# ─────────────────────────────────────────────
# Stage 3 — Production runner
# ─────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV PORT=3000

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy Next.js build output
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy server source (tsx compiles at runtime)
COPY --from=builder --chown=nextjs:nodejs /app/server ./server
COPY --from=builder --chown=nextjs:nodejs /app/types ./types

# Copy config files needed by tsx / Next.js at runtime
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json

# Copy node_modules (includes tsx and all runtime deps)
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

USER nextjs

EXPOSE 3000

# Single process: Next.js HTTP + WebSocket SSH server on port 3000
CMD ["npm", "start"]
