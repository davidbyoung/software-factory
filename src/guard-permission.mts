// The PermissionRequest hook, run as `lunamill guard permission`. Claude Code
// protects `.claude/`, and an unattended `claude -p` run denies any write
// there that nothing approves. In a run Lunamill's action started
// (`LUNAMILL_UNATTENDED=1`), this approves a write to the repository's own
// files under `.claude/`, and says nothing otherwise, so a person at a
// keyboard is still asked, and so is any other workflow that runs Claude.
import { readFileSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import * as say from "./lib/output.mts";

export type PermissionInput = {
  cwd?: string;
  tool_name?: string;
  tool_input?: { file_path?: string };
};

const WRITES = new Set(["Write", "Edit", "MultiEdit"]);

// The hooks that guard the run itself.
const NEVER = new Set(["settings.json", "settings.local.json"]);

/** Whether a build may write `file`: a path inside `.claude/` of the project
 * but `.claude/settings.json` and `.claude/settings.local.json`. The path is
 * resolved first, so one that climbs out with `..` is judged where it lands. */
export function buildMayWrite(file: string, projectDir: string): boolean {
  const claude = resolve(projectDir, ".claude");
  const inside = relative(claude, resolve(projectDir, file));
  if (inside === "" || inside === ".." || inside.startsWith(`..${sep}`))
    return false;
  return !NEVER.has(inside);
}

/** The hook's answer: the JSON that approves the call, or null for no
 * answer, which leaves the decision to whoever it was left to before. */
export function permission(
  input: PermissionInput,
  env: Record<string, string | undefined>,
): string | null {
  if (env.LUNAMILL_UNATTENDED !== "1") return null;
  const file = input.tool_input?.file_path;
  if (!input.tool_name || !WRITES.has(input.tool_name) || !file) return null;
  const projectDir = env.CLAUDE_PROJECT_DIR || input.cwd;
  if (!projectDir || !buildMayWrite(file, projectDir)) return null;
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PermissionRequest",
      decision: { behavior: "allow" },
    },
  });
}

export async function run(): Promise<number> {
  let input: PermissionInput = {};
  try {
    input = JSON.parse(readFileSync(0, "utf8") || "{}") as PermissionInput;
  } catch {
    return 0;
  }
  const answer = permission(input, process.env);
  if (answer) say.plain(answer);
  return 0;
}
