import path from "node:path";
import type { NextConfig } from "next";

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
};

export default nextConfig;
