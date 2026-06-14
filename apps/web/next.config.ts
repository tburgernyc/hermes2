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
};

export default nextConfig;
