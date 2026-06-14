#!/usr/bin/env bash
# =============================================================================
# Hermes 2.0 — SessionStart hook (PROJECT_PLAN §Phase 0).
#
# Runs once at the start of a Claude Code session: installs workspace deps from
# the frozen lockfile, then runs the full Turbo gate (lint, test, build) so the
# session begins from a known-green state.
#
# Invoked by .claude/settings.json (SessionStart -> startup|resume). Also safe
# to run by hand from the repo root:  bash .claude/hooks/session-start.sh
#
# SECRETS RULE (CLAUDE.md §4): this script must NEVER `export` any secret. In
# particular it must not export ANTHROPIC_API_KEY into the shell that runs
# Claude Code — doing so makes Claude Code bill per-token via the API key
# instead of the Max subscription. We only read package files; we set nothing.
#
# stdout from this hook is added to Claude's context, so we keep it terse.
# A non-zero exit is surfaced to the operator but does not abort the session.
# =============================================================================
set -euo pipefail

# Run from the repo root regardless of where the hook is invoked from.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "[session-start] hermes2 — installing deps + running lint/test/build"

# Use the corepack-pinned pnpm from package.json (packageManager field).
corepack enable >/dev/null 2>&1 || true

pnpm install --frozen-lockfile
pnpm turbo lint test build

echo "[session-start] OK — workspace is green."
