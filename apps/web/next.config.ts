import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

import { HSTS_VALUE, STATIC_SECURITY_HEADERS } from "./lib/security-headers";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for Docker.
  output: "standalone",
  // pnpm/Turborepo monorepo: trace from the repo root (two levels up from
  // apps/web) so symlinked workspace deps are copied into the standalone
  // output. With this set, the standalone server.js is emitted at
  // .next/standalone/apps/web/server.js (path relative to the tracing root).
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
  // Native / server-only deps reached through @hermes/core + @hermes/db must be required at runtime
  // (and traced into the standalone output), not webpack-bundled — webpack can't parse argon2's .node
  // binary, and pg has optional native bindings.
  serverExternalPackages: ["@node-rs/argon2", "pg"],
  // serverExternalPackages alone doesn't externalize these transitive (workspace-package) deps under
  // pnpm, so force them external on the Node server build too. Edge/client builds never import them.
  webpack: (config, { isServer, nextRuntime }) => {
    if (isServer && nextRuntime === "nodejs") {
      const externals = config.externals as unknown[];
      externals.push("@node-rs/argon2", "pg");
    }
    return config;
  },
  // Security headers (CLAUDE.md §7). These are PROTOCOL-INDEPENDENT and applied to EVERY response —
  // including /api + static assets that bypass the middleware matcher. The per-request nonce'd CSP comes
  // from middleware.ts (it cannot be static); see lib/security-headers.ts for the rationale.
  async headers() {
    return [
      { source: "/:path*", headers: [...STATIC_SECURITY_HEADERS] },
      {
        // HSTS only when the request actually arrived over https (the Fly proxy stamps this). Gating on
        // x-forwarded-proto keeps it OFF the plaintext http that `next start` / e2e use, so a browser is
        // never told to force-https on http://localhost.
        source: "/:path*",
        has: [{ type: "header", key: "x-forwarded-proto", value: "https" }],
        headers: [{ key: "Strict-Transport-Security", value: HSTS_VALUE }],
      },
    ];
  },
};

// Wrap with Sentry. Source maps are generated + uploaded ONLY when SENTRY_AUTH_TOKEN is present (set in
// CI only — never shipped to Fly); without it this is a no-op and the build needs no network or secret.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
