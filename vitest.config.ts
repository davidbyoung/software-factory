import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // A session in the cloud runs these with its own set.
    env: { FACTORY_HANDOFF: "" },
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
      // The one exception: when deleting well-covered code drops the total
      // under a floor, a build may lower that floor to the new total, and
      // its pull request says which floor moved and why.
      thresholds: {
        lines: 86,
        branches: 84,
        functions: 82,
        statements: 86,
      },
    },
  },
});
