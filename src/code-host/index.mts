// Which code host a name picks, built for a command in a session or CI.
// `github` is the only one, and the settings refuse any other value of
// `code-host.type` before this runs (`config.mts`). A command that has not
// read the settings asks for the default.
import { spawnSync } from "node:child_process";
import { gh, type Gh } from "../lib/gh.mts";
import { ghTransport } from "../tickets/transport.mts";
import { githubCodeHost } from "./github.mts";
import type { CodeHost } from "./types.mts";
import { BUILT, unsupported } from "../tool-names.mts";

export * from "./types.mts";

export const DEFAULT_CODE_HOST = "github" as const;

/** The message for a code host that is not built. */
export const unsupportedCodeHost = (
  type: string,
  built: readonly string[] = BUILT.codeHost,
) => unsupported("code-host.type", type, "code host", built);

/** The token the GitHub CLI is signed in with, read without a prompt, or
 * null when it is signed in as nobody or is not installed. */
function ghToken(): string | null {
  const r = spawnSync("gh", ["auth", "token"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
}

/** The code host of that name for the repository, reached through the
 * GitHub CLI. */
export function openCodeHost(
  repository: string,
  type: string = DEFAULT_CODE_HOST,
  run: Gh = gh,
): CodeHost {
  if (type !== "github") throw new Error(unsupportedCodeHost(type));
  return githubCodeHost({
    transport: ghTransport(run),
    repository,
    cli: run,
    token: ghToken,
  });
}
