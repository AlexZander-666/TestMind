# Multi-stage build for TestMind v1.0
# Stage 1: Base dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy package files
COPY package.json pnpm-workspace.yaml ./
COPY packages/*/package.json ./packages/
COPY packages/shared/package.json ./packages/shared/
COPY packages/core/package.json ./packages/core/
COPY packages/cli/package.json ./packages/cli/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Stage 2: Build
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/*/node_modules ./packages/*/node_modules

# Copy source code
COPY . .

# Build all packages
RUN pnpm build

# Remove dev dependencies
RUN pnpm prune --prod

# Stage 3: Production runtime
FROM node:20-alpine AS runtime
RUN apk add --no-cache libc6-compat

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S testmind -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=testmind:nodejs /app/packages/core/dist ./core
COPY --from=builder --chown=testmind:nodejs /app/packages/cli/dist ./cli
COPY --from=builder --chown=testmind:nodejs /app/packages/shared/dist ./shared
COPY --from=builder --chown=testmind:nodejs /app/node_modules ./node_modules

# Copy license and config files
COPY --chown=testmind:nodejs LICENSE ./
COPY --chown=testmind:nodejs package.json ./

# Create data directory
RUN mkdir -p /data && chown -R testmind:nodejs /data

# Set environment variables
ENV NODE_ENV=production \
    TESTMIND_HOME=/data \
    TESTMIND_PORT=3000 \
    TESTMIND_LOG_LEVEL=info

# Switch to non-root user
USER testmind

# Expose ports
EXPOSE 3000 9229

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => {r.statusCode === 200 ? process.exit(0) : process.exit(1)})"

# Volume for persistent data
VOLUME ["/data"]

# Start command
CMD ["node", "cli/index.js", "server", "--port", "3000"]
