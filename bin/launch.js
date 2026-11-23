// Which copy of the factory the `factory` command runs. Plain JavaScript,
// since Node will not run TypeScript from inside node_modules, and free of
// the file system, which `deps` stands in for, so it can be tested alone.
// In order:
//
//   1. The source in the repository it was run from: the first folder at or
//      above `cwd` that has `.git`, when it is this package's own repository,
//      its `package.json` carrying this package's name. So a git worktree
//      runs its own copy, not the one `npx` finds up the tree.
//   2. The copy that repository installed, in its `node_modules`, when that
//      is not this one: a global install hands the run to the repository's
//      own version, which its synced files were written by.
//   3. Nothing, when this copy lives outside that repository and the
//      repository has none of its own: the caller says how to install it.
//   4. Itself: `src/cli.mts` beside it when that exists, or `dist/cli.mjs`,
//      the compiled code an installed package ships. Outside any
//      repository, as in the poller's image, it always runs itself.

import { dirname, join, relative, isAbsolute } from "node:path";

/**
 * @param {{
 *   cwd: string,
 *   here: string,
 *   name: string,
 *   exists: (path: string) => boolean,
 *   readName: (manifest: string) => string | null,
 *   realpath: (path: string) => string,
 * }} deps
 * @returns {{ run: string } | { launch: string } | { missing: string }}
 */
export function chooseEntry(deps) {
  const { cwd, here, name, exists, readName, realpath } = deps;
  const root = repositoryRoot(cwd, exists);

  if (root) {
    const cli = join(root, "src", "cli.mts");
    if (exists(cli) && readName(join(root, "package.json")) === name)
      return { run: cli };

    const installed = join(root, "node_modules", ...name.split("/"));
    const isOurs = readName(join(installed, "package.json")) === name;
    const isThis = isOurs && realpath(installed) === realpath(here);
    if (isOurs && !isThis)
      return { launch: join(installed, "bin", "factory.js") };
    if (!isOurs && !inside(realpath(here), realpath(root)))
      return { missing: root };
  }

  const beside = join(here, "src", "cli.mts");
  return { run: exists(beside) ? beside : join(here, "dist", "cli.mjs") };
}

/** The first folder at or above `dir` that has `.git`, or null. */
function repositoryRoot(dir, exists) {
  for (;;) {
    if (exists(join(dir, ".git"))) return dir;
    if (dirname(dir) === dir) return null;
    dir = dirname(dir);
  }
}

function inside(path, folder) {
  const rel = relative(folder, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
