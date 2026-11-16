// `factory doctor`: whether the repository's setup works, one line per
// check, each failure with what to do about it. `factory init` ends with the
// same checks.
//
// A stored secret cannot be read back, so a secret is checked only for
// being set.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { boardConfigOf, inspectBoard } from "./board.mts";
import { openCodeHost, type CodeHost } from "./code-host/index.mts";
import {
  defaultDeps,
  loadSettings,
  repoRoot,
  type Settings,
} from "./config.mts";
import { neededSecrets, PART_TEXT, PARTS, partsOn } from "./parts.mts";
import { openRunner, type Runner } from "./runner/index.mts";
import { differences, LOCK, PACKAGE, plan } from "./sync.mts";
import { openTickets, type Tickets } from "./tickets/index.mts";

export type Check = {
  state: "pass" | "fail" | "off";
  text: string;
  /** What to do about a failure. */
  fix?: string;
};

export type DoctorDeps = {
  settings: () => Promise<Settings>;
  /** The paths a sync would change. */
  outOfStep: (s: Settings) => string[];
  /** The version installed, and the one the repository's lock records. */
  versions: () => { installed: string; locked: string | null };
  open: (s: Settings) => {
    codeHost: CodeHost;
    runner: Runner;
    tickets: Tickets | Promise<Tickets>;
  };
  out: (line: string) => void;
};

const SYNC = "Run npx --no-install factory sync";
const INIT = "Run npx --no-install factory init";
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** -1, 0, or 1 as version `a` is older than, the same as, or newer than `b`. */
function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map(Number);
  const pb = b.split(/[.-]/).map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

export async function checks(d: DoctorDeps): Promise<Check[]> {
  const out: Check[] = [];
  let s: Settings;
  try {
    s = await d.settings();
  } catch (e) {
    return [{ state: "fail", text: "The settings are valid", fix: message(e) }];
  }
  out.push({ state: "pass", text: "The settings are valid" });

  const differ = d.outOfStep(s);
  out.push(
    differ.length === 0
      ? { state: "pass", text: "The factory's files match the settings" }
      : {
          state: "fail",
          text: "The factory's files match the settings",
          fix: `${differ.length} differ. ${SYNC}`,
        },
  );

  const { installed, locked } = d.versions();
  if (locked === null)
    out.push({
      state: "fail",
      text: `Version ${installed} is installed, but the repository records none`,
      fix: SYNC,
    });
  else if (compareVersions(installed, locked) === 0)
    out.push({
      state: "pass",
      text: `Version ${installed} is installed, as the repository records`,
    });
  else
    out.push({
      state: "fail",
      text: `Version ${installed} is installed, but the repository records ${locked}`,
      fix: compareVersions(installed, locked) < 0 ? "Run npm ci" : SYNC,
    });

  const { codeHost, runner, tickets } = d.open(s);
  try {
    out.push({
      state: "pass",
      text: `Signed in to the code host as ${await codeHost.signedInAs()}`,
    });
  } catch (e) {
    out.push({
      state: "fail",
      text: "Signed in to the code host",
      fix: message(e),
    });
  }

  let secrets: string[] | null;
  try {
    secrets = await runner.secretNames();
  } catch (e) {
    secrets = null;
    out.push({
      state: "fail",
      text: "The secrets can be listed",
      fix: message(e),
    });
  }
  const on = partsOn(s, secrets ?? []);
  const needed = neededSecrets(on);
  for (const part of PARTS) {
    if (!on.has(part)) {
      out.push({ state: "off", text: `${PART_TEXT[part].name}: off` });
      continue;
    }
    if (secrets === null) continue;
    const forPart = PART_TEXT[part].name.replace(/^./, (c) => c.toLowerCase());
    for (const need of needed.filter((n) => n.part === part)) {
      const found = need.anyOf.find((n) => secrets.includes(n));
      out.push(
        found
          ? { state: "pass", text: `${found} is set, for ${forPart}` }
          : {
              state: "fail",
              text: `${need.anyOf.join(" or ")} is not set, for ${forPart}`,
              fix: INIT,
            },
      );
    }
  }

  if (s.tickets.board !== null) {
    const number = s.tickets.board;
    try {
      const board = await (await tickets).board!.read();
      const { problems } = inspectBoard(board.fields, boardConfigOf(s));
      out.push(
        problems.length === 0
          ? {
              state: "pass",
              text: `Board ${number} has every column the settings name`,
            }
          : {
              state: "fail",
              text: `Board ${number}: ${problems.join("; ")}`,
              fix: INIT,
            },
      );
    } catch (e) {
      out.push({
        state: "fail",
        text: `Board ${number} can be read`,
        fix: message(e),
      });
    }
  }
  return out;
}

/** One check as a line: a tick, a cross with what to do, or a dash for a
 * part that is off. */
export function line(c: Check): string {
  if (c.state === "off") return `- ${c.text}`;
  if (c.state === "pass") return `✓ ${c.text}`;
  const fix = c.fix ?? "";
  // An instruction follows as its own sentence; a reason, after a colon.
  return `✗ ${c.text}${!fix ? "" : /^Run /.test(fix) ? `. ${fix}` : `: ${fix}`}`;
}

export async function main(_argv: string[], d: DoctorDeps): Promise<number> {
  const found = await checks(d);
  for (const c of found) d.out(line(c));
  return found.some((c) => c.state === "fail") ? 1 : 0;
}

/** The checks, run in the repository this command runs in. */
export function doctorDeps(root = repoRoot()): DoctorDeps {
  const settings = () => loadSettings(defaultDeps(root));
  return {
    settings,
    outOfStep: (s) => differences(root, plan(PACKAGE, root, s)),
    versions: () => {
      const installed = JSON.parse(
        readFileSync(join(PACKAGE, "package.json"), "utf8"),
      ).version as string;
      let locked: string | null = null;
      try {
        locked =
          /^version: (.+)$/m.exec(
            readFileSync(join(root, LOCK), "utf8"),
          )?.[1] ?? null;
      } catch {
        locked = null;
      }
      return { installed, locked };
    },
    open: (s) => ({
      codeHost: openCodeHost(s.repository, s.codeHost.type),
      runner: openRunner(s.repository, s.builds.runner),
      tickets: openTickets(s, {
        repository: s.repository,
        board: s.tickets.board,
      }).then((o) => o.tickets),
    }),
    out: (l) => console.log(l),
  };
}

export async function run(argv: string[]): Promise<number> {
  return main(argv, doctorDeps());
}
