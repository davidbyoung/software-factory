#!/usr/bin/env node
// The `kodor` command's launcher: plain JavaScript, which only carries out
// what `chooseEntry` in launch.js decides. Installed once on a machine
// (`npm install -g`), it runs the version of kodor each repository
// names in its lock, downloading that version into the cache the first time.
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { styleText } from "node:util";
import { cacheRoot, chooseEntry, install } from "./launch.js";

const here = dirname(dirname(fileURLToPath(import.meta.url)));

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** Prints a line on standard error, dim for a note and with a red mark for
 * a fault, as `src/lib/output.mts` would: the launcher loads nothing of it. */
function report(line, kind) {
  const color = (look, text) =>
    styleText(look, text, { stream: process.stderr });
  console.error(
    kind === "note"
      ? color("dim", line)
      : line.replace(/^✗/, (mark) => color("red", mark)),
  );
}

/** The package name a manifest declares, or null when there is none. */
function readName(manifest) {
  try {
    return JSON.parse(readFileSync(manifest, "utf8")).name ?? null;
  } catch {
    return null;
  }
}

const manifest = JSON.parse(readFileSync(join(here, "package.json"), "utf8"));
const choice = chooseEntry({
  cwd: process.cwd(),
  here,
  name: manifest.name,
  version: manifest.version,
  cache: cacheRoot(process.env, homedir()),
  env: process.env,
  command: process.argv[2],
  exists: existsSync,
  readName,
  read,
});

if ("fault" in choice) {
  report(choice.fault);
  process.exit(1);
}

if ("download" in choice) {
  const { version, entry } = choice.download;
  report(
    `Downloading kodor ${version}, which this repository names. This happens once.`,
    "note",
  );
  const why = install(choice.download, {
    name: manifest.name,
    pid: process.pid,
    npm: (args) => {
      const run = spawnSync("npm", args, {
        encoding: "utf8",
        shell: process.platform === "win32",
      });
      return {
        status: run.status,
        output: `${run.stdout ?? ""}\n${run.stderr ?? ""}\n${run.error?.message ?? ""}`,
      };
    },
    mkdir: (path) => mkdirSync(path, { recursive: true }),
    rename: renameSync,
    remove: (path) => rmSync(path, { recursive: true, force: true }),
    exists: existsSync,
  });
  if (why !== null) {
    report(
      `✗ This repository names kodor ${version}, and it could not be downloaded: ${why}`,
    );
    process.exit(1);
  }
  await import(pathToFileURL(entry).href);
} else {
  await import(pathToFileURL(choice.run).href);
}
