// Which code host a name picks, built for a command in a session or CI.
// `github` is the only one, and the settings refuse any other value of
// `code-host.type` before this runs (`config.mts`). A command that has not
// read the settings asks for the default.
import { spawnSync } from "node:child_process";
import { gh, ghIn, type Gh, type GhIn } from "../lib/gh.mts";
import { ghTransport } from "../tickets/transport.mts";
import {
  githubCodeHost,
  githubOrganization,
  githubOwner,
  githubServes,
} from "./github.mts";
import type { CodeHost, OrganizationHost } from "./types.mts";
import { handed } from "../handoff/index.mts";
import { BUILT, unsupported } from "../tool-names.mts";

export * from "./types.mts";
/** What a run works with under an owner's own app: a token of the app's
 * for the run's repositories, and the sign-in that takes one. */
export { runToken, signIn } from "./github-app.mts";

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
  return handed(
    "codeHost",
    githubCodeHost({
      transport: ghTransport(run),
      repository,
      cli: run,
      token: ghToken,
    }),
  );
}

/** Each code host an organization can be set up on, by the name
 * `code-host.type` gives it, reached through the GitHub CLI. */
export function organizationHosts(
  run: Gh = gh,
  runIn: GhIn = ghIn,
): Record<string, OrganizationHost> {
  return {
    github: {
      label: "GitHub",
      serves: githubServes,
      ownerOf: githubOwner,
      addressOf: (owner) => `https://github.com/${owner}`,
      organization: (name) =>
        githubOrganization({
          transport: ghTransport(run),
          name,
          cli: runIn,
          token: ghToken,
        }),
    },
  };
}
