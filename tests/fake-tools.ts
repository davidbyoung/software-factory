// Tools the factory has not built, registered beside today's in a test:
// a ticket system with a site address and a token of its own, and a coding
// agent whose configuration is one file. Each proves a new tool is set up,
// checked, and removed with no edit to init, doctor, or remove.
import { existsSync } from "node:fs";
import { join } from "node:path";
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

/** The registry with Fake Agent in place of the coding agent. */
export function withFakeAgent(base: Registry): Registry {
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
  return { ...base, agent: { "fake-agent": { label: "Fake Agent", setup } } };
}

/** The registry with a second code host, which recognizes no remote. */
export function withSecondCodeHost(base: Registry): Registry {
  return {
    ...base,
    codeHost: {
      ...base.codeHost,
      elsewhere: {
        ...base.codeHost.github!,
        label: "Elsewhere",
        repositoryOf: () => null,
      },
    },
  };
}
