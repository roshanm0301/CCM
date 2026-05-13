# =============================================================================
# CCM API — Multi-stage Dockerfile
# Build context: monorepo root (set in docker-compose.yml)
#
# Stage 1: Build TypeScript to JavaScript
# Stage 2: Production runtime — non-root user, no devDependencies
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /workspace

# Copy workspace manifests first for layer cache optimization
COPY package.json package-lock.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

# Install all dependencies (devDeps required for TypeScript compilation)
RUN npm ci --ignore-scripts

# Copy shared packages
COPY packages/config/ ./packages/config/
COPY packages/types/ ./packages/types/

# Build @ccm/types so its dist/ declarations are available to the API build
WORKDIR /workspace/packages/types
RUN npm run build

# Reset WORKDIR to monorepo root before copying app source
WORKDIR /workspace

# Copy the API source
COPY apps/api/ ./apps/api/

# Compile TypeScript — output lands in /workspace/apps/api/dist
WORKDIR /workspace/apps/api
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production
# Only compiled JS + production node_modules + non-root user
# -----------------------------------------------------------------------------
FROM node:22-alpine AS production

# Create a non-root group and user for security
RUN addgroup -S ccm && adduser -S ccm -G ccm

WORKDIR /app

ENV NODE_ENV=production

# Copy manifests for production dependency installation
COPY package.json package-lock.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY apps/api/package.json ./apps/api/

# Install only production dependencies and clean cache to minimise image size
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled output from build stage
COPY --from=build /workspace/apps/api/dist ./apps/api/dist

# Copy @ccm/types compiled JS — required at runtime (enums are real JS objects)
COPY --from=build /workspace/packages/types/dist ./packages/types/dist

# Transfer ownership to non-root user
RUN chown -R ccm:ccm /app

USER ccm

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health/live || exit 1

CMD ["node", "apps/api/dist/main.js"]
