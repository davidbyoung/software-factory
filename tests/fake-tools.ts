// Tools kodor has not built, registered beside today's in a test:
// a ticket system with a site address and a token of its own, and a coding
// agent whose configuration is one file. Each proves a new tool is set up,
// checked, and removed with no edit to init, doctor, or remove.
import { EventEmitter } from "node:events";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import type { Spawn } from "../src/agent/claude-code.mts";
import type { Agent, Answer, Question } from "../src/agent/types.mts";
import type { CredentialStep, ToolSetup } from "../src/setup.mts";
import { HttpError } from "../src/tickets/transport.mts";
import type { Tickets } from "../src/tickets/types.mts";
import type { Registry } from "../src/tools.mts";

export const FAKE_TOKEN = "FAKE_TICKETS_TOKEN";
export const FAKE_PAGE = "https://tickets.example/tokens";
export const FAKE_AGENT_FILE = "FAKEAGENT.md";
export const FAKE_EMAIL = "FAKE_TICKETS_EMAIL";
export const FAKE_REVOKE = "https://tickets.example/revoke";
/** The token Fake Tickets refuses with a 401. */
export const REFUSED = "bad";

/** Fake Tickets' credential, an email and a token kept on the machine too,
 * as Jira's is. */
export const fakeCredential: CredentialStep = {
  kind: "credential",
  needs: [{ part: null, anyOf: [FAKE_TOKEN] }],
  parts: [
    {
      name: FAKE_EMAIL,
      prompt: "The email of your Fake Tickets account:",
      masked: false,
    },
    {
      name: FAKE_TOKEN,
      prompt: "Paste the Fake Tickets token (leave empty to do this later):",
      masked: true,
    },
  ],
  intro: ["", `Fake Tickets' token: opening ${FAKE_PAGE}`],
  get: { page: FAKE_PAGE },
  check: async (values) => {
    if (values[FAKE_TOKEN] === REFUSED)
      throw new HttpError(401, "refused", "Unauthorized");
    if (values[FAKE_TOKEN] === "down") throw new Error("Fake Tickets is down.");
    return { account: "Fake User", lines: [] };
  },
  refused: (reason) =>
    `Fake Tickets refused that email and token: ${reason}. Paste another.`,
  skipped: "No Fake Tickets credential stored.",
  revoke: { page: FAKE_REVOKE },
  machine: { under: "site" },
};

/** The adapter with every call to the system refused, as a system
 * refuses a token; what it answers without calling, such as a key, stays. */
function refusing(tickets: Tickets): Tickets {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(tickets))
    out[k] =
      typeof v === "function"
        ? (...args: unknown[]) => {
            const r = (v as (...a: unknown[]) => unknown).apply(tickets, args);
            if (!(r instanceof Promise)) return r;
            r.catch(() => {});
            return Promise.reject(
              new HttpError(401, "refused", "Unauthorized"),
            );
          }
        : v;
  return out as Tickets;
}

const fakeTicketsSetup: ToolSetup = {
  steps: () => [
    {
      kind: "value",
      key: "site",
      part: null,
      ask: "Your ticket system's address",
    },
    {
      kind: "secret",
      needs: [{ part: null, anyOf: [FAKE_TOKEN] }],
      storeAs: [FAKE_TOKEN],
      intro: ["", `Fake Tickets' token: opening ${FAKE_PAGE}`],
      get: { page: FAKE_PAGE },
      prompt: "Paste the Fake Tickets token (leave empty to do this later):",
      skipped: "No Fake Tickets token stored.",
      verify: async (value) => {
        if (value === "bad") throw new Error("That token is refused.");
        return { lines: [] };
      },
      stored: (names) => `Stored as ${names.join(", ")}.`,
    },
  ],
  checks: async (c) => [
    c.settings?.tickets.options.site === "down"
      ? {
          state: "fail",
          text: "Fake Tickets can be reached",
          fix: "check tickets.site",
        }
      : { state: "pass", text: "Fake Tickets can be reached" },
  ],
  leftovers: () => ["Delete your Fake Tickets token"],
};

/** The registry with Fake Tickets beside the ticket systems it has, or in
 * their place when `alone`. With `credential`, it reads an email and a
 * token kept on the machine in place of its one token, and records the
 * credential each open was given in `opened`. */
export function withFakeTickets(
  base: Registry,
  tickets: Tickets,
  alone = false,
  o: {
    credential?: boolean;
    opened?: (Record<string, string> | undefined)[];
  } = {},
): Registry {
  const setup: ToolSetup = o.credential
    ? {
        steps: () => fakeTicketsSetup.steps!({} as never).slice(0, 1),
        credential: fakeCredential,
        checks: fakeTicketsSetup.checks!,
      }
    : fakeTicketsSetup;
  return {
    ...base,
    tickets: {
      ...(alone ? {} : base.tickets),
      fake: {
        label: "Fake Tickets",
        keys: ["site"],
        setup,
        open: (_target, _settings, opts) => {
          o.opened?.push(opts?.credential);
          return opts?.credential?.[FAKE_TOKEN] === REFUSED
            ? refusing(tickets)
            : tickets;
        },
      },
    },
  };
}

/** An agent that plays its answers in turn and records each question;
 * one asked past its answers fails, so a test never reaches a real one. */
export function scriptedAgent(
  answers: Answer[] = [],
  o: { installed?: boolean } = {},
): Agent & { asked: Question[] } {
  const asked: Question[] = [];
  return {
    asked,
    installed: () => o.installed ?? true,
    answer: async (q) => {
      asked.push(q);
      return (
        answers.shift() ?? {
          failed: { code: 1, error: "the test scripted no answer" },
        }
      );
    },
  };
}

/** The registry with Fake Agent in place of the coding agent. */
export function withFakeAgent(
  base: Registry,
  agent: Agent = scriptedAgent(),
): Registry {
  const setup: ToolSetup = {
    checks: async (c) => [
      existsSync(join(c.root, FAKE_AGENT_FILE))
        ? { state: "pass", text: `${FAKE_AGENT_FILE} is there` }
        : {
            state: "fail",
            text: `${FAKE_AGENT_FILE} is there`,
            fix: "Run fake-agent init",
          },
    ],
  };
  return {
    ...base,
    agent: { "fake-agent": { label: "Fake Agent", setup, agent } },
  };
}

/** The registry with more code hosts, which recognize no remote. */
export function withCodeHosts(base: Registry, ...labels: string[]): Registry {
  return {
    ...base,
    codeHost: {
      ...base.codeHost,
      ...Object.fromEntries(
        labels.map((label) => [
          label.toLowerCase(),
          { ...base.codeHost.github!, label, repositoryOf: () => null },
        ]),
      ),
    },
  };
}

/** The registry with a second runner. */
export function withSecondRunner(base: Registry): Registry {
  return {
    ...base,
    runner: {
      ...base.runner,
      "fake-runner": {
        ...base.runner["github-actions"]!,
        label: "Fake Runner",
      },
    },
  };
}

/** How one try of a credential ends: taken, refused with what Claude Code
 * says, or never answered. */
export type Try = "taken" | { refused: string } | "hangs";

/** A stand-in for the coding agent's command when a pasted credential is
 * tried: each run ends as the next of `tries` says, and as taken once
 * they run out. It records the environment each run was given, and never
 * starts a process. */
export function tryingSpawn(tries: Try[] = []) {
  const queue = [...tries];
  const envs: Record<string, string | undefined>[] = [];
  const spawn: Spawn = (_command, _args, options) => {
    envs.push({ ...options.env });
    const how = queue.shift() ?? "taken";
    const child = new EventEmitter() as EventEmitter & {
      stdout: PassThrough;
      stderr: PassThrough;
      kill(): boolean;
    };
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => {
      setImmediate(() => child.emit("close", null));
      return true;
    };
    if (how !== "hangs")
      setImmediate(() => {
        child.stdout.end(
          JSON.stringify(
            how === "taken"
              ? { is_error: false, result: "ok" }
              : { is_error: true, result: how.refused },
          ),
        );
        child.stderr.end("");
        setImmediate(() => child.emit("close", how === "taken" ? 0 : 1));
      });
    return child;
  };
  return { spawn, envs };
}
