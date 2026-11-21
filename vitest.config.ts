import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    unstubGlobals: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      include: ["src/**", "bin/**"],
      reporter: ["text-summary", "lcov"],
      // The coverage floors: CI and the gate fail under any of them. Raise
      // them by hand as coverage rises; never lower one to get a change in.
      thresholds: {
        lines: 86,
        branches: 84,
        functions: 82,
        statements: 86,
      },
    },
  },
});
