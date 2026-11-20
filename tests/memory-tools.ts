// The factory's registry with each built tool opening an in-memory fake, so
// `init`, `doctor`, and `remove` run their real setups with no network. A
// test adds a tool of its own by spreading the result.
import type { Agent } from "../src/agent/types.mts";
import type { CodeHost } from "../src/code-host/types.mts";
import type { Settings } from "../src/config.mts";
import type { Part } from "../src/parts.mts";
import type { SetupContext } from "../src/setup.mts";
import type { Runner } from "../src/runner/types.mts";
import type { Tickets } from "../src/tickets/types.mts";
import { TOOLS, type Registry } from "../src/tools.mts";
import { scriptedAgent } from "./fake-tools";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";

export function memoryTools(o: {
  codeHost: CodeHost;
  runner: Runner;
  tickets: Tickets;
  /** Claude Code's answers, which never run claude. */
  agent?: Agent;
}): Registry {
  return {
    codeHost: { github: { ...TOOLS.codeHost.github!, open: () => o.codeHost } },
    tickets: { github: { ...TOOLS.tickets.github!, open: () => o.tickets } },
    runner: {
      "github-actions": {
        ...TOOLS.runner["github-actions"]!,
        open: () => o.runner,
      },
    },
    agent: {
      "claude-code": {
        ...TOOLS.agent["claude-code"]!,
        agent: o.agent ?? scriptedAgent(),
      },
    },
  };
}

/** A setup context over the in-memory fakes, with today's tools chosen. */
export function memoryContext(
  parts: Part[],
  o: { tickets?: string; settings?: Settings | null; claude?: boolean } = {},
): SetupContext {
  return {
    repository: "acme/site",
    root: "/nowhere",
    parts: new Set(parts),
    chosen: {
      codeHost: "github",
      tickets: o.tickets ?? "github",
      runner: "github-actions",
      agent: "claude-code",
    },
    settings: o.settings ?? null,
    hasCommand: (name) => name !== "claude" || o.claude !== false,
    opened: {
      codeHost: memoryCodeHost([], { owner: "dave" }).codeHost,
      runner: memoryRunner().runner,
      tickets: memoryTickets([]).tickets,
    },
  };
}
