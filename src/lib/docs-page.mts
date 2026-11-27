// The address of a page of the factory's own docs. The docs are not in
// the package or in a user's repository, so a command that names a page
// prints its address on the code host.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { organizationHosts } from "../code-host/index.mts";

export const FACTORY_REPOSITORY = "davidbyoung/software-factory";

/** Each page and heading a command prints, under `docs/`. A test fails
 * when one is missing. */
export const DOCS_PAGES = {
  firstTicket: "get-started/quick-start.md#4-open-a-ticket",
  freePlan: "integrations/github-organizations.md#on-githubs-free-plan",
  secretsDoNotReach:
    "integrations/github-organizations.md#when-the-organizations-secrets-do-not-reach-you",
  developerNext: "setup/organization.md#what-each-developer-does-next",
  settingsVersion2: "maintain/upgrade-notes.md#moving-to-settings-version-2",
  commandsRunForYou: "reference/cli-internal.md",
} as const;

/** A page of the factory's own docs as the installed version has it: at
 * the release's tag, or on `main` for a version that is no release. */
export function docsPage(version: string, page: string): string {
  const [owner, name] = FACTORY_REPOSITORY.split("/") as [string, string];
  const at = /^\d+\.\d+\.\d+$/.test(version) ? `v${version}` : "main";
  return `${organizationHosts().github!.addressOf(owner)}/${name}/blob/${at}/docs/${page}`;
}

/** The installed package's version, from its own `package.json`: two
 * folders up from this file, in `src/lib/` and in `dist/lib/` alike. */
export function installedVersion(): string {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  return (
    JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      version: string;
    }
  ).version;
}
