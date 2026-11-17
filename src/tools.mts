// Every tool the factory has built, by kind and by the name a setting gives
// it: how to open it, and its setup (`setup.mts`). `init`, `doctor`, and
// `remove` take this as a parameter, so a test adds a tool of its own.
import { claudeCodeSetup, DEFAULT_AGENT } from "./agent/index.mts";
import {
  githubRepository,
  githubCodeHostSetup,
} from "./code-host/github-setup.mts";
import { openCodeHost, type CodeHost } from "./code-host/index.mts";
import type { Settings } from "./config.mts";
import { gh } from "./lib/gh.mts";
import type { Part } from "./parts.mts";
import { openRunner, type Runner } from "./runner/index.mts";
import type {
  Chosen,
  SecretStep,
  SetupContext,
  SetupStep,
  ToolSetup,
} from "./setup.mts";
import { githubTickets } from "./tickets/github.mts";
import { githubTicketsSetup } from "./tickets/github-setup.mts";
import { openTickets, type Tickets } from "./tickets/index.mts";
import { ghTransport } from "./tickets/transport.mts";
import { githubActionsSetup } from "./runner/setup.mts";
import { BUILT, type Built } from "./tool-names.mts";

export type Tool = { label: string; setup: ToolSetup };

export type Registry = {
  codeHost: Record<
    string,
    Tool & {
      /** The repository a remote's address names, or null for one on
       * another code host. */
      repositoryOf(remote: string): string | null;
      open(repository: string): CodeHost;
    }
  >;
  tickets: Record<
    string,
    Tool & {
      /** The keys it adds under `tickets`. */
      keys: readonly string[];
      open(
        target: { repository: string; board: number | null },
        settings: Settings | null,
      ): Tickets | Promise<Tickets>;
    }
  >;
  runner: Record<string, Tool & { open(repository: string): Runner }>;
  agent: Record<string, Tool>;
};

export const TOOLS: Registry = {
  codeHost: {
    github: {
      label: "GitHub",
      setup: githubCodeHostSetup,
      repositoryOf: githubRepository,
      open: (repository) => openCodeHost(repository),
    },
  },
  tickets: {
    github: {
      label: "GitHub Issues",
      keys: BUILT.tickets.github!,
      setup: githubTicketsSetup,
      open: (target, settings) =>
        settings
          ? openTickets(settings, target).then((o) => o.tickets)
          : githubTickets({
              transport: ghTransport(gh),
              repository: target.repository,
              board: target.board,
            }),
    },
  },
  runner: {
    "github-actions": {
      label: "GitHub Actions",
      setup: githubActionsSetup,
      open: (repository) => openRunner(repository),
    },
  },
  agent: { [DEFAULT_AGENT]: { label: "Claude Code", setup: claudeCodeSetup } },
};

/** The names and keys the settings accept, as `config.mts` checks them. */
export function builtOf(r: Registry): Built {
  return {
    codeHost: Object.keys(r.codeHost),
    tickets: Object.fromEntries(
      Object.entries(r.tickets).map(([name, t]) => [name, t.keys]),
    ),
    runner: Object.keys(r.runner),
  };
}

/** The tools in use, in the order setup asks for them. */
export function inUse(r: Registry, chosen: Chosen): Tool[] {
  return [
    r.agent[chosen.agent]!,
    r.codeHost[chosen.codeHost]!,
    r.tickets[chosen.tickets]!,
    r.runner[chosen.runner]!,
  ];
}

/** Each tool's steps for the context, with the tool's label. */
export function stepsOf(
  r: Registry,
  c: SetupContext,
): { tool: string; step: SetupStep }[] {
  return inUse(r, c.chosen).flatMap((t) =>
    (t.setup.steps?.(c) ?? []).map((step) => ({ tool: t.label, step })),
  );
}

/** The secret steps among them. */
export function secretSteps(
  r: Registry,
  c: SetupContext,
): { tool: string; step: SecretStep }[] {
  return stepsOf(r, c).filter(
    (s): s is { tool: string; step: SecretStep } => s.step.kind === "secret",
  );
}

/** The same context for other parts. */
export const withParts = (c: SetupContext, parts: Iterable<Part>) => ({
  ...c,
  parts: new Set(parts),
});
