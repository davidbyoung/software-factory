// A repository's settings as `lunamill sync` leaves them: the settings file,
// and a lock whose settings are the file's own lines, current with it.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { settingsHash } from "../src/preset.mts";

/** A lock whose settings are `settings`, made from `settings`. */
export function lockFor(settings: string): string {
  return [
    "version: 0.0.0-test",
    "presets: []",
    `settings-hash: ${settingsHash(settings, null)}`,
    "settings:",
    ...settings
      .trimEnd()
      .split("\n")
      .map((l) => `  ${l}`),
    "overridden: {}",
    "files: []",
    "",
  ].join("\n");
}

/** `.claude/lunamill.yaml` in `repo` with these settings, and its lock. */
export function writeSettings(repo: string, settings: string) {
  mkdirSync(join(repo, ".claude"), { recursive: true });
  writeFileSync(join(repo, ".claude/lunamill.yaml"), settings);
  writeFileSync(join(repo, ".claude/lunamill.lock"), lockFor(settings));
}
