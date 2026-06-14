import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/helpers/setup.ts"],
    // DB-backed logic tests share one database; run files serially. Each test isolates via a
    // transaction that is always rolled back, so nothing commits to the shared DB.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
