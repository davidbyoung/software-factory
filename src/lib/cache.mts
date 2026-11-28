// Where kodor keeps what it downloads, on the machine and outside
// any repository: each version of itself, and each commit of a preset's
// repository.
import { join } from "node:path";

/** The cache's folder. `bin/launch.js`, which loads nothing from `src/`,
 * has its own `cacheRoot`, and the two give the same folder. */
export function cacheRoot(
  env: Record<string, string | undefined>,
  home: string,
): string {
  return join(env.XDG_CACHE_HOME || join(home, ".cache"), "kodor");
}

/** The folder one commit of a preset's repository is checked out in:
 * `presets/HOST/OWNER/NAME/COMMIT`. */
export function presetCommitDir(
  cache: string,
  host: string,
  repository: string,
  commit: string,
): string {
  return join(cache, "presets", host, ...repository.split("/"), commit);
}
