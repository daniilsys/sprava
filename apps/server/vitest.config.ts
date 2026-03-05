import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./__tests__/setup.ts"],
    include: ["./__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/generated/**", "src/server.ts"],
    },
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
