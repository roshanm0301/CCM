# =============================================================================
# CCM Web — Multi-stage Dockerfile
# Build context: monorepo root (set in docker-compose.yml)
#
# Stage 1: Build the Vite + React application
# Stage 2: Serve with nginx (minimal production image)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build
# -----------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /workspace

# Copy workspace manifests for dependency resolution (layer cache optimization)
COPY package.json package-lock.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/

# Install all workspace dependencies
RUN npm ci --ignore-scripts

# Copy shared package source
COPY packages/config/ ./packages/config/
COPY packages/types/ ./packages/types/

# Build @ccm/types so its dist/ declarations are available to the web build
WORKDIR /workspace/packages/types
RUN npm run build

# Reset WORKDIR to monorepo root before copying app source
WORKDIR /workspace

# Copy icon generator and run it to create placeholder icons
COPY scripts/ ./scripts/
RUN node scripts/create-placeholder-icons.mjs

# Copy the web app source
COPY apps/web/ ./apps/web/

# Accept build-time arg for API base URL (baked into the bundle).
# Default is intentionally EMPTY so Axios uses same-origin relative URLs
# and nginx proxies /api/* to the ccm-api container transparently.
# Only override this if you are deploying the frontend to a separate origin
# (e.g. a CDN) and need to point at an absolute backend URL.
ARG VITE_API_BASE_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Explicitly set NODE_ENV=production so build options that read
# process.env['NODE_ENV'] (e.g. sourcemap: false in vite.config.ts)
# evaluate correctly without relying on Vite's implicit behaviour.
ENV NODE_ENV=production

# Build the Vite app
WORKDIR /workspace/apps/web
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production — nginx serving static files
# server_tokens off and security headers are set in ops/nginx/default.conf
# -----------------------------------------------------------------------------
FROM nginx:stable-alpine AS production

# Remove default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy built static assets from Stage 1
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

# Copy the CCM nginx configuration (path relative to monorepo root context)
COPY ops/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]

# -----------------------------------------------------------------------------
# Stage 3: Development — Vite dev server with HMR
# Source files are mounted as volumes at runtime — no COPY of app source.
# Changes to src/, public/, index.html are reflected instantly via HMR.
# -----------------------------------------------------------------------------
FROM node:22-alpine AS development

WORKDIR /workspace

# Install workspace dependencies (lock-file driven, no scripts)
COPY package.json package-lock.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY apps/web/package.json ./apps/web/
RUN npm ci --ignore-scripts

# Build shared types so TS declarations are available at dev-server start
COPY packages/config/ ./packages/config/
COPY packages/types/ ./packages/types/
WORKDIR /workspace/packages/types
RUN npm run build

# Generate placeholder icons (scripts not in mounted volume)
WORKDIR /workspace
COPY scripts/ ./scripts/
RUN node scripts/create-placeholder-icons.mjs

# Copy web manifests and config — source is mounted as volume at runtime
COPY apps/web/package.json        ./apps/web/
COPY apps/web/tsconfig.json       ./apps/web/
COPY apps/web/vite.config.ts      ./apps/web/
COPY apps/web/vitest.config.ts    ./apps/web/
COPY apps/web/index.html          ./apps/web/

WORKDIR /workspace/apps/web

EXPOSE 5173

# --host 0.0.0.0 required so Docker exposes the port outside the container
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]
