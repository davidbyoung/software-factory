// The proof the package works outside the repository it is developed in:
// packs this folder, installs the tarball once on a machine, as a person
// does, and runs the factory in an empty repository in a temporary folder.
//
//   npm run pack-check
//
// It fails when a command exits non-zero, when the sync wrote no skill or
// either workflow file, when it left a package.json or node_modules in the
// repository, when a hook entry does not run the machine's factory, or
// when a packed file names the repository the factory was drawn out of
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
import { CODE_HOST_YAML } from "./settings-fixture.ts";

const PACKAGE = fileURLToPath(new URL("..", import.meta.url));
const { name } = JSON.parse(
  readFileSync(join(PACKAGE, "package.json"), "utf8"),
);

const REPOSITORY = "your-name/your-repo";

/** The shortest settings file the configuration page gives. */
const SETTINGS = `version: 2\nrepository: ${REPOSITORY}\n${CODE_HOST_YAML}\n`;

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
  // Once on the machine, as a person installs it: a prefix of its own
  // stands in for the machine's, and the repository holds no package.json.
  const prefix = join(dir, "machine");
  run(
    "npm",
    [
      "install",
      "--global",
      "--prefix",
      prefix,
      "--no-audit",
      "--no-fund",
      "--silent",
      join(dir, tarball),
    ],
    dir,
  );
  const factory = join(prefix, "bin", "factory");
  const repo = join(dir, "scratch");
  mkdirSync(join(repo, ".claude"), { recursive: true });
  run("git", ["init", "-q"], repo);
  // The remote the settings name, and its default branch, as a clone has
  // them: the sync reads the default branch from that remote.
  run(
    "git",
    ["remote", "add", "origin", `https://github.com/${REPOSITORY}`],
    repo,
  );
  run(
    "git",
    ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"],
    repo,
  );
  writeFileSync(join(repo, ".claude/factory.yaml"), SETTINGS);

  for (const args of [
    ["sync"],
    ["sync", "--check"],
    ["config", "check"],
    ["plugins"],
  ]) {
    try {
      run(factory, args, repo);
    } catch {
      fail(`factory ${args.join(" ")} exited non-zero`);
    }
  }
  for (const left of ["package.json", "node_modules", ".github/actions"])
    if (existsSync(join(repo, left)))
      fail(`the sync left ${left} in the repository`);
  for (const file of ["factory.yml", "factory-review.yml"])
    if (!existsSync(join(repo, ".github/workflows", file)))
      fail(`the sync wrote no .github/workflows/${file}`);

  const installed = join(prefix, "lib", "node_modules", name);
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
  const outside = commands.filter((c) => !/(^|; )factory [a-z]/.test(c));
  if (commands.length !== 5 || outside.length > 0)
    fail(
      `a hook entry does not run the machine's factory: ${outside.join("; ")}`,
    );

  console.log(
    `pack-check passed: ${written.length} skills, ${commands.length} hook entries`,
  );
} finally {
  rmSync(dir, { recursive: true, force: true });
}
