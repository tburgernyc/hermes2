# syntax=docker/dockerfile:1

# =============================================================================
# Hermes 2.0 — apps/web (Next.js 15 standalone) production image.
#
# Build context MUST be the repo root (so the pnpm lockfile and every
# workspace manifest are available for a --frozen-lockfile install):
#
#   docker build -f Dockerfile -t hermes-web .
#
# Multi-stage:
#   deps    -> install the full workspace from the frozen lockfile
#   builder -> build only @hermes/web to a Next.js standalone bundle
#   runner  -> slim, non-root image containing just the standalone output
# =============================================================================

# ---- Base: pin Node 22 + enable corepack-managed pnpm -----------------------
FROM node:22.22.3-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Match the locked toolchain: pnpm 9 via corepack (no global npm install).
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

# ---- deps: install dependencies against the frozen lockfile ------------------
FROM base AS deps
# Copy only manifests + lockfile first for maximum layer-cache reuse: deps are
# only reinstalled when a package.json or the lockfile changes, not on every
# source edit. EVERY workspace importer in pnpm-lock.yaml must have its
# package.json present here, or `pnpm install --frozen-lockfile` fails on the
# missing importer. When a new package is added under apps/ or packages/, add
# a COPY line for its package.json below.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/ai/package.json ./packages/ai/package.json
COPY packages/emails/package.json ./packages/emails/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---- builder: build the standalone output for @hermes/web -------------------
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
# Reuse the entire installed workspace from the deps stage. This preserves
# pnpm's symlinked node_modules layout (root store + per-package links).
COPY --from=deps /app ./
# Overlay the source tree. node_modules is excluded via .dockerignore, so this
# adds sources without clobbering the installed dependencies above.
COPY . .
# Build ONLY the web app (and any workspace deps it requires).
RUN pnpm --filter @hermes/web build

# ---- runner: minimal runtime image -----------------------------------------
FROM node:22.22.3-bookworm-slim AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# server.js honors these to bind on all interfaces inside the container.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

# Run as a dedicated non-root user.
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

# Standalone bundle: with outputFileTracingRoot set to the repo root, the
# output preserves the monorepo layout, so the server entrypoint and its
# pruned node_modules live under apps/web/ inside .next/standalone.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# The standalone server does NOT copy static assets or public/ — copy them
# into the matching nested locations so server.js can serve them.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

# In a monorepo the standalone entrypoint nests under apps/web.
CMD ["node", "apps/web/server.js"]
