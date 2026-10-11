import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const pkg = (path: string) => fileURLToPath(new URL(`./packages/${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    // Tests use the packages' source code, not `dist/`.
    alias: [
      { find: /^@bull\/runtime\/react$/, replacement: pkg("runtime/src/react.tsx") },
      { find: /^@bull\/runtime$/, replacement: pkg("runtime/src/index.ts") },
      { find: /^@bull\/core$/, replacement: pkg("core/src/index.ts") },
    ],
  },
  test: {
    include: ["packages/*/test/**/*.test.{ts,tsx}", "examples/*/src/**/*.test.{ts,tsx}"],
  },
});
