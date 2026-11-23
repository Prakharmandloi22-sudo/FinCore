# Multi-stage Dockerfile for FinCore Core Backend
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=4000

# Install curl for healthcheck
RUN apk add --no-cache curl

# Security: run as non-root user 'node' (built-in in node:alpine)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY src/db/migrations ./src/db/migrations

USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "dist/server.js"]

