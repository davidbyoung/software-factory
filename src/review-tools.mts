// Prints the tools the pull request review may use, as the one comma-separated value
// the review step passes to `--allowedTools`: the factory's own, then a
// `Bash(COMMAND:*)` for each of the settings' `pr-review.commands`.
//
//   FACTORY_SETTINGS=base-settings.yaml factory review tools
//
// The workflow reads the settings from the pull request's base commit, so
// a change to the settings alone cannot widen what its own review may run.
import { loadSettings, SettingsError } from "./config.mts";

/** What every review may do: read, edit its scratch copy, read the history
 * and the pull request, and comment on it. */
export const FACTORY_REVIEW_TOOLS = [
  "Read",
  "Grep",
  "Glob",
  "Edit",
  "Write",
  "Bash(git diff:*)",
  "Bash(git log:*)",
  "Bash(git show:*)",
  "Bash(git merge-base:*)",
  "Bash(git status:*)",
  "Bash(git checkout:*)",
  "Bash(git stash:*)",
  "Bash(gh pr view:*)",
  "Bash(gh pr diff:*)",
  "Bash(gh pr comment:*)",
  "Bash(gh api:*)",
  "mcp__github_inline_comment__create_inline_comment",
];

export function allowedTools(commands: string[]): string {
  return [...FACTORY_REVIEW_TOOLS, ...commands.map((c) => `Bash(${c}:*)`)].join(
    ",",
  );
}

export async function run(): Promise<number> {
  try {
    const s = await loadSettings();
    console.log(allowedTools(s.prReview?.commands ?? []));
    return 0;
  } catch (e) {
    if (!(e instanceof SettingsError)) throw e;
    console.error(e.message);
    return 1;
  }
}
