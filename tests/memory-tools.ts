// The factory's registry with each built tool opening an in-memory fake, so
// `init`, `doctor`, and `remove` run their real setups with no network. A
// test adds a tool of its own by spreading the result.
import { claudeCodeSetupWith, type Spawn } from "../src/agent/claude-code.mts";
import type { Agent } from "../src/agent/types.mts";
import type { CodeHost } from "../src/code-host/types.mts";
import type { Settings } from "../src/config.mts";
import type { Part } from "../src/parts.mts";
import type { SetupContext } from "../src/setup.mts";
import type { Runner } from "../src/runner/types.mts";
import type { SpecTools } from "../src/specs/index.mts";
import type { SpecTool } from "../src/specs/types.mts";
import type { Tickets } from "../src/tickets/types.mts";
import { TOOLS, type Registry } from "../src/tools.mts";
import { scriptedAgent, tryingSpawn } from "./fake-tools";
import { memoryCodeHost } from "./memory-code-host";
import { memoryRunner } from "./memory-runner";
import { memoryTickets } from "./memory-tickets";

export function memoryTools(o: {
  codeHost: CodeHost;
  runner: Runner;
  tickets: Tickets;
  /** Claude Code's answers, which never run claude. */
  agent?: Agent;
  /** What stands in for claude when a pasted credential is tried: one
   * that takes every credential unless given. */
  spawn?: Spawn;
  /** How long such a try may take, in milliseconds. */
  tryMs?: number;
  /** The spec tools, in place of the built ones. */
  specs?: SpecTools;
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
        setup: claudeCodeSetupWith(o.spawn ?? tryingSpawn().spawn, {
          tryMs: o.tryMs,
        }),
        agent: o.agent ?? scriptedAgent(),
      },
    },
    specs: o.specs ?? TOOLS.specs,
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

/** A spec tool that is not OpenSpec: it keeps a ticket's spec in one page
 * that later tickets update, folds nothing in, installs with pip, and ends
 * with a skill, so nothing outside \`src/specs/\` can assume OpenSpec. */
export function pagesSpecTool(o: { installed?: boolean } = {}): SpecTool {
  return {
    name: "Pages",
    label: "Pages: each ticket's spec is a page in pages/",
    install: {
      package: "pages-cli",
      via: "pip install",
      installed: () => o.installed ?? false,
    },
    defaultCheck: "pages check",
    env: {},
    processFiles: ["pages/config.yaml"],
    runs: () => true,
    list: () => [{ name: "search", path: "pages/search.md" }],
    folder: () => "pages/",
    started: () => false,
    start: () => 0,
    files: (id) => [
      {
        kind: "update",
        path: "pages/SITEMAP.md",
        what: `A line for ticket ${id}`,
      },
      { kind: "new", path: `pages/${id}.md`, what: "The Spec" },
    ],
    then: "/pages-review",
    finished: () => false,
    finish: () => 0,
    foldsInto: "pages/",
  };
}
