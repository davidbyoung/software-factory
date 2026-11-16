import { describe, expect, it } from "vitest";
import { buildMayWrite, permission } from "../src/guard-permission.mts";

const DIR = "/work/repo";
const ALLOW = JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PermissionRequest",
    decision: { behavior: "allow" },
  },
});
const UNATTENDED = { FACTORY_UNATTENDED: "1", CLAUDE_PROJECT_DIR: DIR };
const edit = (file_path: string, tool_name = "Edit") => ({
  tool_name,
  tool_input: { file_path },
});

describe("factory guard permission", () => {
  it.each([
    [".claude/skills/write-posts/SKILL.md"],
    [`${DIR}/.claude/agents/ui-reviewer.md`],
    [".claude/factory.yaml"],
    [".claude/change-types.md"],
  ])("approves a write to %s in an unattended run", (file) => {
    expect(permission(edit(file), UNATTENDED)).toBe(ALLOW);
    expect(permission(edit(file, "Write"), UNATTENDED)).toBe(ALLOW);
  });

  it.each([
    [".claude/settings.json"],
    [".claude/settings.local.json"],
    [`${DIR}/.claude/settings.json`],
    [".claude/skills/../settings.json"],
    ["src/pages/page.tsx"],
    [".claude/../src/pages/page.tsx"],
    [".claude/skills/../../package.json"],
    ["/etc/passwd"],
    [`${DIR}/.claude-other/x.md`],
    [".claude"],
  ])("does not approve a write to %s", (file) => {
    expect(permission(edit(file), UNATTENDED)).toBeNull();
  });

  it("says nothing without FACTORY_UNATTENDED=1", () => {
    const env = { CLAUDE_PROJECT_DIR: DIR };
    expect(permission(edit(".claude/factory.yaml"), env)).toBeNull();
    expect(
      permission(edit(".claude/factory.yaml"), {
        ...env,
        FACTORY_UNATTENDED: "0",
      }),
    ).toBeNull();
  });

  it("says nothing for a tool that does not write a file", () => {
    expect(
      permission(
        {
          tool_name: "Bash",
          tool_input: { file_path: ".claude/factory.yaml" },
        },
        UNATTENDED,
      ),
    ).toBeNull();
    expect(permission({ tool_name: "Edit" }, UNATTENDED)).toBeNull();
  });

  it("judges a relative path from the hook's cwd when no project directory is set", () => {
    expect(
      permission(
        { ...edit(".claude/factory.yaml"), cwd: DIR },
        { FACTORY_UNATTENDED: "1" },
      ),
    ).toBe(ALLOW);
  });

  it("buildMayWrite refuses the project's own .claude directory", () => {
    expect(buildMayWrite(".claude", DIR)).toBe(false);
  });
});
