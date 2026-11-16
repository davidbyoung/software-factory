import { describe, expect, it } from "vitest";
import { allowedTools, FACTORY_REVIEW_TOOLS } from "../src/review-tools.mts";

describe("allowedTools", () => {
  it("gives the review only the factory's own tools when the settings name no command", () => {
    expect(allowedTools([])).toBe(FACTORY_REVIEW_TOOLS.join(","));
  });

  it("adds each command the settings name as a Bash prefix, after the factory's own", () => {
    expect(
      allowedTools(["npx vitest run", "node"]).split(",").slice(-2),
    ).toEqual(["Bash(npx vitest run:*)", "Bash(node:*)"]);
  });

  it("lets the review read the diff and comment, and run no repository's command of its own", () => {
    expect(FACTORY_REVIEW_TOOLS).toContain("Bash(git diff:*)");
    expect(FACTORY_REVIEW_TOOLS).toContain("Bash(gh pr comment:*)");
    expect(FACTORY_REVIEW_TOOLS).toContain(
      "mcp__github_inline_comment__create_inline_comment",
    );
    expect(FACTORY_REVIEW_TOOLS.join(",")).not.toMatch(/npx|node:|eslint|tsc/);
  });
});
