// Several repositories on one in-memory code host, for a ticket that names
// more than its own: each repository's pull requests, files, and writers.
import { listMarker, type Listed } from "../src/lib/repositories.mts";
import {
  memoryCodeHost,
  type MemoryCodeHostOptions,
  type PullSeed,
} from "./memory-code-host";

/** A lock of a version that can build a ticket from another repository. */
export const LOCK =
  "version: 0.6.0\nsettings:\n  tickets:\n    fields:\n      repositories: none\n";
export const OLD_LOCK =
  "version: 0.5.0\nsettings:\n  tickets:\n    fields:\n      spec: none\n";
export const LOCK_FILE = ".claude/kodor.lock";

export type Place = Omit<MemoryCodeHostOptions, "contents"> & {
  pulls?: PullSeed[];
  lock?: string | null;
};

/** The repositories by name, each set up and written by `dev` unless it
 * says otherwise. */
export function network(places: Record<string, Place>) {
  const hosts = Object.fromEntries(
    Object.entries(places).map(([name, { pulls, lock, ...options }]) => [
      name,
      memoryCodeHost(
        (pulls ?? []).map((p) => ({
          ...p,
          head: {
            sha: `head${p.number}`,
            branch: `branch-${p.number}`,
            repository: name,
            ...p.head,
          },
        })),
        {
          writers: ["dev"],
          contents: lock === null ? {} : { [LOCK_FILE]: lock ?? LOCK },
          ...options,
        },
      ),
    ]),
  );
  return {
    hosts,
    reach: async (name: string) => {
      const found = hosts[name];
      if (found) return found.codeHost;
      return memoryCodeHost([], { unseen: true }).codeHost;
    },
  };
}

export const API: Listed = { name: "acme/api", after: [] };
export const WEB: Listed = { name: "acme/web", after: ["acme/api"] };
export const SECTION =
  "## Repositories\n\n- acme/api\n- acme/web, after acme/api\n";

let next = 1;
/** The note that confirms a list, as a comment on the ticket. */
export const confirming = (list: Listed[], author = "dev", at = "12:00") => ({
  id: `note-${next++}`,
  author,
  createdAt: `2026-11-09T${at}:00Z`,
  body: `Repositories.\n\n${listMarker(list)}\n<!-- agent -->`,
});
