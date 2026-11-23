#!/usr/bin/env node
// The `factory` command's launcher: plain JavaScript, which only carries out
// what `chooseEntry` in launch.js decides. Installed once on a machine
// (`npm install -g`), it runs the version of the factory each repository
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
import { cacheRoot, chooseEntry, install } from "./launch.js";

const here = dirname(dirname(fileURLToPath(import.meta.url)));

function read(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
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
  console.error(choice.fault);
  process.exit(1);
}

if ("download" in choice) {
  const { version, entry } = choice.download;
  console.error(
    `Downloading the factory ${version}, which this repository names. This happens once.`,
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
    console.error(
      `✗ This repository names the factory ${version}, and it could not be downloaded: ${why}`,
    );
    process.exit(1);
  }
  await import(pathToFileURL(entry).href);
} else {
  await import(pathToFileURL(choice.run).href);
}
