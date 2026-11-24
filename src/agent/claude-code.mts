// Claude Code as the factory's coding agent: the token it needs, the
// configuration `factory sync` writes for it, how `remove` takes that
// configuration out, and how it answers one question for `init`.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listed } from "../lib/listed.mts";
import { AGENT_KEY, AGENT_TOKEN, type Part } from "../parts.mts";
import type { ToolSetup, Unconfigured } from "../setup.mts";
import type { Agent, Answer } from "./types.mts";
import {
  CLAUDE_MD,
  hasAnyFactoryHook,
  hasFactoryHooks,
  hasImport,
  SETTINGS_JSON,
  withoutHooks,
  withoutImport,
} from "../sync.mts";

export const LABEL = "Claude Code";
const COMMAND = "claude";
const SYNC = "Run factory sync";
const READS: Part[] = ["review", "cloud"];

/** How the token `claude setup-token` prints and an API key each start. */
const TOKEN_START = "sk-ant-oat";
const KEY_START = "sk-ant-api";

/** The choice a pasted value belongs to, where the command offers one. */
const belongs = (choice?: string) =>
  choice ? ` It belongs to the choice "${choice}".` : "";

/** Why a pasted value is not the token `claude setup-token` prints, as the
 * line to print, or null for one that is. No line holds any of the value:
 * what is pasted in its place is often another secret, such as the code
 * the browser gives to paste back to that command. `keyChoice` names the
 * choice that takes an API key. */
export function tokenFault(value: string, keyChoice?: string): string | null {
  if (value.startsWith(TOKEN_START)) return null;
  const copy = `Copy the line ${COMMAND} setup-token printed after "Your OAuth token", and paste that.`;
  if (value.startsWith(KEY_START))
    return `That is an API key, not the token: the token starts ${TOKEN_START}01-.${belongs(keyChoice)} ${copy}`;
  const code = value.includes("#")
    ? ` If it has a # in it, it is the code the browser gave you for ${COMMAND} setup-token.`
    : "";
  return `That is not the token: it starts ${TOKEN_START}01-, and what you pasted starts differently.${code} ${copy}`;
}

/** Why a pasted value is not an API key, as `tokenFault` says why one is
 * not the token. `tokenChoice` names the choice that takes the token. */
export function keyFault(value: string, tokenChoice?: string): string | null {
  if (value.startsWith(KEY_START)) return null;
  const paste = "Paste the key from the Anthropic console.";
  return value.startsWith(TOKEN_START)
    ? `That is the token ${COMMAND} setup-token prints, not an API key: one starts ${KEY_START}.${belongs(tokenChoice)} ${paste}`
    : `That is not an API key: one starts ${KEY_START}. ${paste}`;
}

const read = (root: string, path: string) =>
  existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null;

/** Claude Code's setup, with what starts `claude` when a pasted credential
 * is tried, and how long a try may take. */
export function claudeCodeSetupWith(
  spawn: Spawn,
  o: { tryMs?: number } = {},
): ToolSetup {
  /** A check for a pasted credential: its shape, then whether Claude
   * Code takes it. One it refuses is asked for again, and one that could
   * not be tried is stored, with a line that says so. */
  const checked =
    (
      name: string,
      what: string,
      fault: (value: string) => string | null,
      again: string,
    ) =>
    async (value: string, say?: (line: string) => void) => {
      const wrong = fault(value);
      if (wrong) throw new Error(wrong);
      say?.(`Trying the ${what}...`);
      const tried = await tryCredential(spawn, name, value, o.tryMs);
      if ("refused" in tried)
        throw new Error(
          `${LABEL} refused that ${what}: ${tried.refused}. ${again}`,
        );
      return {
        lines:
          "untried" in tried
            ? [
                `Could not try the ${what} (${tried.untried}), so it is stored untried.`,
              ]
            : [],
      };
    };
  return {
    kept: {
      name: AGENT_TOKEN,
      what: "Claude token",
      secrets: [AGENT_TOKEN, AGENT_KEY],
    },

    steps: (c) => {
      const parts = READS.filter((p) => c.parts.has(p));
      if (!parts.length) return [];
      return [
        {
          kind: "secret",
          needs: parts.map((part) => ({
            part,
            anyOf: [AGENT_TOKEN, AGENT_KEY],
          })),
          storeAs: [AGENT_TOKEN],
          intro: [
            "",
            `The coding agent's token: running ${COMMAND} setup-token...`,
          ],
          get: { command: [COMMAND, "setup-token"] },
          prompt:
            "Paste the token it printed, the line that starts sk-ant-oat01- (leave empty to do this later):",
          skipped: `No ${AGENT_TOKEN} stored.`,
          verify: checked(
            AGENT_TOKEN,
            "token",
            tokenFault,
            "If it was printed over two lines, copy both, then paste it again.",
          ),
          stored: (names) => `Stored as ${names.join(", ")}.`,
          machine: {},
          or: {
            kind: "secret",
            needs: parts.map((part) => ({
              part,
              anyOf: [AGENT_TOKEN, AGENT_KEY],
            })),
            storeAs: [AGENT_KEY],
            intro: [""],
            prompt: "Paste the API key (leave empty to do this later):",
            skipped: `No ${AGENT_KEY} stored.`,
            verify: checked(
              AGENT_KEY,
              "API key",
              keyFault,
              "Copy the whole key from the Anthropic console, then paste it again.",
            ),
            stored: (names) => `Stored as ${names.join(", ")}.`,
          },
        },
      ];
    },

    checks: async (c) => [
      hasImport(read(c.root, CLAUDE_MD))
        ? {
            state: "pass",
            text: `${CLAUDE_MD} imports the factory's rules`,
          }
        : {
            state: "fail",
            text: `${CLAUDE_MD} imports the factory's rules`,
            fix: SYNC,
          },
      hasFactoryHooks(read(c.root, SETTINGS_JSON))
        ? {
            state: "pass",
            text: `${SETTINGS_JSON} has the factory's hooks`,
          }
        : {
            state: "fail",
            text: `${SETTINGS_JSON} has the factory's hooks`,
            fix: SYNC,
          },
      c.hasCommand(COMMAND)
        ? { state: "pass", text: `The ${COMMAND} command is installed` }
        : {
            state: "fail",
            text: `The ${COMMAND} command is installed`,
            fix: "Install Claude Code, then sign in",
          },
    ],

    leftovers: (c) => {
      const names = [AGENT_TOKEN, AGENT_KEY].filter(
        (n) => c.secrets === null || c.secrets.includes(n),
      );
      if (!names.length) return [];
      const one = names.length === 1;
      return [
        `Delete the secret${one ? "" : "s"} ${listed(names)}${c.secrets === null ? " if set" : ""}, unless another workflow uses ${one ? "it" : "them"}`,
      ];
    },

    unconfigure: (c) => {
      const out: Unconfigured[] = [];
      const settings = read(c.root, SETTINGS_JSON);
      if (settings !== null && hasAnyFactoryHook(settings))
        out.push({ path: SETTINGS_JSON, text: withoutHooks(settings) });
      const instructions = read(c.root, CLAUDE_MD);
      if (instructions !== null && hasImport(instructions))
        out.push({ path: CLAUDE_MD, text: withoutImport(instructions) });
      return out;
    },
  };
}

/** The part of a child process `answer` uses. */
export type Child = {
  stdout: NodeJS.ReadableStream | null;
  stderr: NodeJS.ReadableStream | null;
  kill(): boolean;
  on(event: "close", listener: (code: number | null) => void): unknown;
  on(event: "error", listener: (e: Error) => void): unknown;
};

export type Spawn = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    stdio: ["ignore", "pipe", "pipe"];
    env?: Record<string, string | undefined>;
  },
) => Child;

const firstLine = (text: string): string | null =>
  text
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean) ?? null;

/** How one run of `claude -p` ended: past its time, not started, or
 * exited, with what it printed. */
type Ran =
  | { timedOut: true }
  | { notStarted: string | null }
  | {
      code: number | null;
      json: { structured_output?: unknown; is_error?: unknown };
      /** What its answer says, or "" when it gave none. */
      result: string;
      stderr: string;
    };

/** Asks Claude Code one thing: `claude -p` with no tools, on its smallest
 * model, run from an empty folder so no project's settings or hooks load.
 * Its standard input is closed: left open, it waits three seconds for
 * input and then warns on stderr that none came. */
function run(
  spawn: Spawn,
  o: {
    prompt: string;
    schema?: object;
    timeoutMs: number;
    env?: Record<string, string | undefined>;
  },
): Promise<Ran> {
  return new Promise<Ran>((resolve) => {
    const cwd = mkdtempSync(join(tmpdir(), "factory-ask-"));
    const child = spawn(
      COMMAND,
      [
        "-p",
        o.prompt,
        "--output-format",
        "json",
        ...(o.schema ? ["--json-schema", JSON.stringify(o.schema)] : []),
        "--tools",
        "",
        "--model",
        "haiku",
        "--setting-sources",
        "",
      ],
      {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
        ...(o.env ? { env: o.env } : {}),
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (b: Buffer) => (stdout += String(b)));
    child.stderr?.on("data", (b: Buffer) => (stderr += String(b)));
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, o.timeoutMs);
    const done = (ran: Ran) => {
      clearTimeout(timer);
      rmSync(cwd, { recursive: true, force: true });
      resolve(ran);
    };
    child.on("error", (e) => done({ notStarted: firstLine(e.message) }));
    child.on("close", (code: number | null) => {
      if (timedOut) return done({ timedOut: true });
      let json: { structured_output?: unknown; result?: unknown } = {};
      try {
        json = JSON.parse(stdout) ?? {};
      } catch {
        // Not JSON: no answer, and no result line to fall back to.
      }
      done({
        code,
        json,
        result: typeof json.result === "string" ? json.result : "",
        stderr,
      });
    });
  });
}

/** What Claude Code says of a credential it will not take. */
const REFUSAL =
  /\b40[13]\b|authenticat|unauthori[sz]ed|invalid (?:bearer )?token|invalid (?:x-)?api.?key|expired|revoked/i;

/** Whether Claude Code takes a credential: one small thing asked with it
 * in the child's environment, under `name`, and with no other credential
 * there to answer in its place. It is in no argument and no message. */
export async function tryCredential(
  spawn: Spawn,
  name: string,
  value: string,
  timeoutMs = 30_000,
): Promise<{ ok: true } | { refused: string } | { untried: string }> {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env[AGENT_TOKEN];
  delete env[AGENT_KEY];
  env[name] = value;
  const ran = await run(spawn, {
    prompt: "Answer with the one word: ok",
    timeoutMs,
    env,
  });
  if ("timedOut" in ran)
    return { untried: `it took longer than ${timeoutMs / 1000} seconds` };
  if ("notStarted" in ran)
    return { untried: ran.notStarted ?? `${COMMAND} did not start` };
  if (ran.code === 0 && ran.json.is_error !== true) return { ok: true };
  const said = (
    firstLine(ran.result) ??
    firstLine(ran.stderr) ??
    `it failed with exit code ${ran.code ?? 1}`
  )
    .replace(/^Failed to authenticate[.:]\s+(?=\S)/, "")
    .replace(/\.$/, "");
  return REFUSAL.test(`${ran.result}\n${ran.stderr}`)
    ? { refused: said }
    : { untried: said };
}

/** Claude Code's answer to one question, in the shape a schema gives. */
export function claudeCodeAgent(spawn: Spawn): Agent {
  return {
    installed: (hasCommand) => hasCommand(COMMAND),
    answer: async (q): Promise<Answer> => {
      const ran = await run(spawn, q);
      if ("timedOut" in ran) return { timedOut: true };
      if ("notStarted" in ran)
        return { failed: { code: 1, error: ran.notStarted } };
      if (ran.code !== 0)
        return {
          failed: {
            code: ran.code ?? 1,
            // What it says went wrong is in its answer; stderr may hold
            // only a warning.
            error: firstLine(ran.result) ?? firstLine(ran.stderr),
          },
        };
      if (ran.json.structured_output !== undefined)
        return { answer: ran.json.structured_output };
      try {
        return { answer: JSON.parse(ran.result) };
      } catch {
        return { answer: undefined };
      }
    },
  };
}

export const claudeCodeSetup: ToolSetup = claudeCodeSetupWith(spawn);
