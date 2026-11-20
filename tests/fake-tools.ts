// Tools the factory has not built, registered beside today's in a test:
// a ticket system with a site address and a token of its own, and a coding
// agent whose configuration is one file. Each proves a new tool is set up,
// checked, and removed with no edit to init, doctor, or remove.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Agent, Answer, Question } from "../src/agent/types.mts";
import type { ToolSetup } from "../src/setup.mts";
import type { Tickets } from "../src/tickets/types.mts";
import type { Registry } from "../src/tools.mts";

export const FAKE_TOKEN = "FAKE_TICKETS_TOKEN";
export const FAKE_PAGE = "https://tickets.example/tokens";
export const FAKE_AGENT_FILE = "FAKEAGENT.md";

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
 * their place when `alone`. */
export function withFakeTickets(
  base: Registry,
  tickets: Tickets,
  alone = false,
): Registry {
  return {
    ...base,
    tickets: {
      ...(alone ? {} : base.tickets),
      fake: {
        label: "Fake Tickets",
        keys: ["site"],
        setup: fakeTicketsSetup,
        open: () => tickets,
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
        ? { state: "pass", text: `Fake Agent: ${FAKE_AGENT_FILE} is there` }
        : {
            state: "fail",
            text: `Fake Agent: ${FAKE_AGENT_FILE} is there`,
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
