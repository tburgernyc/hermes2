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
#   deps     -> install the full workspace from the frozen lockfile
#   builder  -> build @hermes/web (+ its workspace libs) to a Next.js standalone bundle
#   migrator -> compile @hermes/db into a self-contained DB-migration bundle (release_command)
#   runner   -> slim, non-root image: the standalone output + the migration bundle
# =============================================================================

# ---- Base: pin Node 22 + enable corepack-managed pnpm -----------------------
FROM node:22.22.3-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
# Match the locked toolchain: pnpm 9 via corepack (no global npm install). Pin EXACTLY the
# version in package.json's `packageManager` field — corepack honors that field at runtime, so
# a mismatched prepare here just forces a redundant download of the real version on first use.
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate
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
COPY packages/inngest/package.json ./packages/inngest/package.json
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
# Build @hermes/web AND its workspace dependencies, in topological order. The trailing "..."
# selects web PLUS everything it depends on (@hermes/db|core|ai|inngest|emails), so each lib's
# `tsc` emits its dist/ BEFORE `next build` resolves it. This is load-bearing: the libs are
# imported via their package `exports` → ./dist/index.js, and .dockerignore strips every dist/
# from the build context — so a clean image has none until they are built here. A bare
# `--filter @hermes/web build` would fail to resolve @hermes/* (module not found).
RUN pnpm --filter "@hermes/web..." build

# ---- migrator: compiled, self-contained DB-migration bundle -----------------
# Fly's [deploy] release_command (fly.toml) runs `node /app/migrator/dist/migrate.js` in a
# one-off Machine BEFORE any new Machine takes traffic — a non-zero exit ABORTS the deploy, so
# a failed or partial migration never reaches production. The slim runner ships no tsx and no
# devDeps, so the migration entry must be COMPILED (not `tsx src/migrate.ts`) and must travel
# with its prod deps + the SQL files. `pnpm deploy --prod` produces exactly that: a directory
# with a real (symlink-free) node_modules holding only the prod closure (pg / drizzle-orm /
# dotenv), the built dist/ (incl. migrate.js), and the migrations/ SQL tree that migrate.js
# reads at ../migrations relative to dist/. It connects as MIGRATION_DATABASE_URL (the Neon
# OWNER role) from Fly secrets — prod DB creds therefore never touch CI (CLAUDE.md §4/§7).
FROM base AS migrator
COPY --from=deps /app ./
COPY . .
RUN pnpm --filter @hermes/db build \
 && pnpm --filter @hermes/db deploy --prod /migrator

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

# Compiled, self-contained DB-migration bundle for the Fly release_command (fly.toml [deploy]).
# Has its OWN node_modules — invoked as `node /app/migrator/dist/migrate.js`, never imported by
# the web server. Adds only the migrator's prod closure to the image; the runtime app is unchanged.
COPY --from=migrator --chown=nextjs:nodejs /migrator ./migrator

USER nextjs
EXPOSE 3000

# In a monorepo the standalone entrypoint nests under apps/web.
CMD ["node", "apps/web/server.js"]
