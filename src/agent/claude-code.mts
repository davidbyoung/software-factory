// Claude Code as the factory's coding agent: the token it needs, the
// configuration `factory sync` writes for it, and how `remove` takes that
// configuration out.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { listed } from "../lib/listed.mts";
import { AGENT_KEY, AGENT_TOKEN, type Part } from "../parts.mts";
import type { ToolSetup, Unconfigured } from "../setup.mts";
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
const SYNC = "Run npx --no-install factory sync";
const READS: Part[] = ["review", "cloud"];

const read = (root: string, path: string) =>
  existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : null;

export const claudeCodeSetup: ToolSetup = {
  found: (c) =>
    c.hasCommand(COMMAND)
      ? LABEL
      : `${LABEL}, which is not installed: sessions and its token need it`,

  steps: (c) => {
    const parts = READS.filter((p) => c.parts.has(p));
    if (!parts.length) return [];
    const installed = c.hasCommand(COMMAND);
    const name = installed ? AGENT_TOKEN : AGENT_KEY;
    return [
      {
        kind: "secret",
        needs: parts.map((part) => ({ part, anyOf: [AGENT_TOKEN, AGENT_KEY] })),
        storeAs: [name],
        intro: installed
          ? ["", `The coding agent's token: running ${COMMAND} setup-token...`]
          : [],
        get: installed ? { command: [COMMAND, "setup-token"] } : undefined,
        prompt: installed
          ? "Paste the token it printed (leave empty to do this later):"
          : "Paste an API key from the Claude Console (leave empty to do this later):",
        skipped: `No ${name} stored.`,
        stored: (names) => `Stored as ${names.join(", ")}.`,
      },
    ];
  },

  checks: async (c) => [
    hasImport(read(c.root, CLAUDE_MD))
      ? {
          state: "pass",
          text: `${LABEL}: ${CLAUDE_MD} imports the factory's rules`,
        }
      : {
          state: "fail",
          text: `${LABEL}: ${CLAUDE_MD} imports the factory's rules`,
          fix: SYNC,
        },
    hasFactoryHooks(read(c.root, SETTINGS_JSON))
      ? {
          state: "pass",
          text: `${LABEL}: ${SETTINGS_JSON} has the factory's hooks`,
        }
      : {
          state: "fail",
          text: `${LABEL}: ${SETTINGS_JSON} has the factory's hooks`,
          fix: SYNC,
        },
    c.hasCommand(COMMAND)
      ? { state: "pass", text: `${LABEL}: the ${COMMAND} command is installed` }
      : {
          state: "fail",
          text: `${LABEL}: the ${COMMAND} command is installed`,
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
