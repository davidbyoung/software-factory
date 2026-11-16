#!/usr/bin/env node
// The `factory` command's launcher: plain JavaScript, which only carries out
// what `chooseEntry` in launch.js decides. Installed once on a machine
// (`npm install -g`), it hands each run to the copy the repository it is run
// from installed, so every repository keeps its own version.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chooseEntry } from "./launch.js";

const here = dirname(dirname(fileURLToPath(import.meta.url)));

/** The package name a manifest declares, or null when there is none. */
function readName(manifest) {
  try {
    return JSON.parse(readFileSync(manifest, "utf8")).name ?? null;
  } catch {
    return null;
  }
}

const name = readName(join(here, "package.json"));
const choice = chooseEntry({
  cwd: process.cwd(),
  here,
  name,
  exists: existsSync,
  readName,
  realpath: (path) => {
    try {
      return realpathSync(path);
    } catch {
      return path;
    }
  },
});

if ("missing" in choice) {
  console.error(
    `${choice.missing} has no copy of the factory installed. Install it there with: npm install --save-dev ${name}`,
  );
  process.exit(1);
}

await import(pathToFileURL("run" in choice ? choice.run : choice.launch).href);
