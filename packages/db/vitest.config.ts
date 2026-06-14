import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/helpers/setup.ts"],
    // DB tests share one Neon database; run files serially to keep connection use low and
    // avoid cross-file interference. Each test still isolates via BEGIN … ROLLBACK.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
