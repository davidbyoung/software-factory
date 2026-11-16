// The proof the package works outside the repository it is developed in:
// packs this folder, installs the tarball into an empty repository in a
// temporary folder, and runs the factory there.
//
//   npm run pack-check
//
// It fails when a command exits non-zero, when the sync wrote no skill,
// when a hook entry does not point into the installed package, or when a
// packed file names the repository the factory was drawn out of
// (`host-names.mts`). That last check stands between the package and
// publishing.
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { hostWordsIn } from "./host-names.mts";

const PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const { name } = JSON.parse(
  readFileSync(join(PACKAGE, "package.json"), "utf8"),
);

/** The shortest settings file the configuration page gives. */
const SETTINGS = "version: 1\nrepository: your-name/your-repo\n";

function run(cmd: string, args: string[], cwd: string): string {
  console.log(`$ ${[cmd, ...args].join(" ")}`);
  const out = execFileSync(cmd, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  if (out.trim()) console.log(out.trimEnd());
  return out;
}

/** Every file under `dir`, but its own dependencies. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    if (entry === "node_modules") return [];
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

function fail(message: string): never {
  console.error(`pack-check failed: ${message}`);
  process.exit(1);
}

const dir = mkdtempSync(join(tmpdir(), "factory-pack-"));
try {
  const tarball = run(
    "npm",
    ["pack", "--silent", "--pack-destination", dir],
    PACKAGE,
  )
    .trim()
    .split("\n")
    .at(-1)!;
  const repo = join(dir, "scratch");
  mkdirSync(join(repo, ".claude"), { recursive: true });
  run("git", ["init", "-q"], repo);
  writeFileSync(
    join(repo, "package.json"),
    '{ "name": "scratch", "private": true }\n',
  );
  writeFileSync(join(repo, ".claude/factory.yaml"), SETTINGS);
  run(
    "npm",
    ["install", "--no-audit", "--no-fund", "--silent", join(dir, tarball)],
    repo,
  );

  for (const args of [
    ["sync"],
    ["sync", "--check"],
    ["config", "check"],
    ["plugins"],
  ]) {
    try {
      run("npx", ["--no-install", "factory", ...args], repo);
    } catch {
      fail(`factory ${args.join(" ")} exited non-zero`);
    }
  }

  const installed = join(repo, "node_modules", name);
  const named = filesUnder(installed).flatMap((path) => {
    const file = relative(installed, path);
    return hostWordsIn(readFileSync(path, "utf8"), file).map(
      (line) => `${file}: ${line}`,
    );
  });
  if (named.length > 0)
    fail(
      `the package names the repository it was drawn out of:\n${named.join("\n")}`,
    );

  if (!existsSync(join(installed, "settings.schema.json")))
    fail("the installed package holds no settings.schema.json");

  const skills = join(repo, ".claude/skills");
  const written = existsSync(skills)
    ? readdirSync(skills).filter((s) => existsSync(join(skills, s, "SKILL.md")))
    : [];
  if (written.length === 0) fail("the sync wrote no skill");

  const hooks = JSON.parse(
    readFileSync(join(repo, ".claude/settings.json"), "utf8"),
  ).hooks as Record<string, { hooks: { command: string }[] }[]>;
  const commands = Object.values(hooks).flatMap((groups) =>
    groups.flatMap((g) => g.hooks.map((h) => h.command)),
  );
  const outside = commands.filter((c) => !c.includes(`node_modules/${name}/`));
  if (commands.length !== 5 || outside.length > 0)
    fail(`a hook entry does not point into the package: ${outside.join("; ")}`);

  console.log(
    `pack-check passed: ${written.length} skills, ${commands.length} hook entries`,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
