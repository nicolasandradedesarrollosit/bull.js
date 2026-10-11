import { defineConfig } from "vitest/config";

// E2E: runs the built binary (`packages/cli/dist/bin.js`) the way a user would.
export default defineConfig({
  test: {
    include: ["e2e/**/*.test.ts"],
    testTimeout: 60_000,
  },
});
