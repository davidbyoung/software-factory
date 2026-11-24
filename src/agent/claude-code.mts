// Claude Code as the factory's coding agent: the token it needs, the
// configuration `factory sync` writes for it, how `remove` takes that
// configuration out, and how it answers one question for `init`.
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

export const claudeCodeSetup: ToolSetup = {
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
        needs: parts.map((part) => ({ part, anyOf: [AGENT_TOKEN, AGENT_KEY] })),
        storeAs: [AGENT_TOKEN],
        intro: [
          "",
          `The coding agent's token: running ${COMMAND} setup-token...`,
        ],
        get: { command: [COMMAND, "setup-token"] },
        prompt:
          "Paste the token it printed, the line that starts sk-ant-oat01- (leave empty to do this later):",
        skipped: `No ${AGENT_TOKEN} stored.`,
        verify: async (value) => {
          const fault = tokenFault(value);
          if (fault) throw new Error(fault);
          return { lines: [] };
        },
        stored: (names) => `Stored as ${names.join(", ")}.`,
        machine: {},
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
  options: { cwd: string; stdio: ["ignore", "pipe", "pipe"] },
) => Child;

const firstLine = (text: string): string | null =>
  text
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean) ?? null;

/** Claude Code's answer to one question: `claude -p` with no tools, on its
 * smallest model, run from an empty folder so no project's settings or
 * hooks load. Its standard input is closed: left open, it waits three
 * seconds for input and then warns on stderr that none came. */
export function claudeCodeAgent(spawn: Spawn): Agent {
  return {
    installed: (hasCommand) => hasCommand(COMMAND),
    answer: (q) =>
      new Promise<Answer>((resolve) => {
        const cwd = mkdtempSync(join(tmpdir(), "factory-ask-"));
        const child = spawn(
          COMMAND,
          [
            "-p",
            q.prompt,
            "--output-format",
            "json",
            "--json-schema",
            JSON.stringify(q.schema),
            "--tools",
            "",
            "--model",
            "haiku",
            "--setting-sources",
            "",
          ],
          { cwd, stdio: ["ignore", "pipe", "pipe"] },
        );
        let stdout = "";
        let stderr = "";
        child.stdout?.on("data", (b: Buffer) => (stdout += String(b)));
        child.stderr?.on("data", (b: Buffer) => (stderr += String(b)));
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          child.kill();
        }, q.timeoutMs);
        const done = (answer: Answer) => {
          clearTimeout(timer);
          rmSync(cwd, { recursive: true, force: true });
          resolve(answer);
        };
        child.on("error", (e) =>
          done({ failed: { code: 1, error: firstLine(e.message) } }),
        );
        child.on("close", (code: number | null) => {
          if (timedOut) return done({ timedOut: true });
          let json: { structured_output?: unknown; result?: unknown } = {};
          try {
            json = JSON.parse(stdout) ?? {};
          } catch {
            // Not JSON: no answer, and no result line to fall back to.
          }
          const result = typeof json.result === "string" ? json.result : "";
          if (code !== 0)
            return done({
              failed: {
                code: code ?? 1,
                // What it says went wrong is in its answer; stderr may
                // hold only a warning.
                error: firstLine(result) ?? firstLine(stderr),
              },
            });
          if (json.structured_output !== undefined)
            return done({ answer: json.structured_output });
          try {
            return done({ answer: JSON.parse(result) });
          } catch {
            return done({ answer: undefined });
          }
        });
      }),
  };
}
