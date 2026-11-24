// Every tool the factory has built, by kind and by the name a setting gives
// it: how to open it, and its setup (`setup.mts`). `init`, `doctor`, and
// `remove` take this as a parameter, so a test adds a tool of its own.
import { spawn } from "node:child_process";
import {
  claudeCodeAgent,
  claudeCodeSetup,
  DEFAULT_AGENT,
} from "./agent/index.mts";
import type { Agent } from "./agent/types.mts";
import {
  githubForkOf,
  githubRepository,
  githubCodeHostSetup,
} from "./code-host/github-setup.mts";
import { openCodeHost, type CodeHost } from "./code-host/index.mts";
import type { Settings } from "./config.mts";
import type { Part } from "./parts.mts";
import { openRunner, type Runner } from "./runner/index.mts";
import type {
  Chosen,
  CredentialStep,
  Kept,
  SecretStep,
  SetupContext,
  SetupStep,
  ToolSetup,
} from "./setup.mts";
import {
  openGithubTickets,
  type OpenOptions,
  type OpenTarget,
} from "./tickets/github-open.mts";
import { githubTicketsSetup } from "./tickets/github-setup.mts";
import type { Tickets } from "./tickets/types.mts";
import { githubActionsSetup } from "./runner/setup.mts";
import { specTools, type SpecTools } from "./specs/index.mts";
import { BUILT, type Built, type LabelFault } from "./tool-names.mts";

export type Tool = {
  label: string;
  setup: ToolSetup;
  /** Why it refuses a label name, where it limits names beyond their not
   * being empty. */
  labelFault?: LabelFault;
};

export type Registry = {
  codeHost: Record<
    string,
    Tool & {
      /** The repository a remote's address names, or null for one on
       * another code host. */
      repositoryOf(remote: string): string | null;
      /** The repository one was forked from, or null for one that is no
       * fork. Rejects when the code host cannot say. */
      forkOf(repository: string): Promise<string | null>;
      open(repository: string): CodeHost;
    }
  >;
  tickets: Record<
    string,
    Tool & {
      /** The keys it adds under `tickets`. */
      keys: readonly string[];
      /** Whether it has statuses of its own, as Jira does. */
      statuses?: boolean;
      /** The adapter alone: `openTickets` (`tickets/index.mts`) adds the
       * credential and the ticket fields a command reads it with. */
      open(
        target: OpenTarget,
        settings: Settings | null,
        opts?: OpenOptions,
      ): Tickets | Promise<Tickets>;
    }
  >;
  runner: Record<string, Tool & { open(repository: string): Runner }>;
  agent: Record<string, Tool & { agent: Agent }>;
  specs: SpecTools;
};

export const TOOLS: Registry = {
  codeHost: {
    github: {
      label: "GitHub",
      setup: githubCodeHostSetup,
      repositoryOf: githubRepository,
      forkOf: (repository) => githubForkOf(repository),
      open: (repository) => openCodeHost(repository),
    },
  },
  tickets: {
    github: {
      label: "GitHub Issues",
      keys: BUILT.tickets.github!,
      setup: githubTicketsSetup,
      open: (target, _settings, opts) => openGithubTickets(target, opts),
    },
  },
  runner: {
    "github-actions": {
      label: "GitHub Actions",
      setup: githubActionsSetup,
      open: (repository) => openRunner(repository),
    },
  },
  agent: {
    [DEFAULT_AGENT]: {
      label: "Claude Code",
      setup: claudeCodeSetup,
      agent: claudeCodeAgent(spawn),
    },
  },
  specs: specTools(),
};

const faultsOf = (tools: Record<string, Tool>) =>
  Object.fromEntries(
    Object.entries(tools).flatMap(([name, t]) =>
      t.labelFault ? [[name, t.labelFault]] : [],
    ),
  );

/** The names and keys the settings accept, as `config.mts` checks them. */
export function builtOf(r: Registry): Built {
  return {
    codeHost: Object.keys(r.codeHost),
    tickets: Object.fromEntries(
      Object.entries(r.tickets).map(([name, t]) => [name, t.keys]),
    ),
    runner: Object.keys(r.runner),
    specs: Object.fromEntries(
      Object.entries(r.specs).map(([name, t]) => [name, t.defaultCheck]),
    ),
    labelFaults: {
      tickets: faultsOf(r.tickets),
      codeHost: faultsOf(r.codeHost),
    },
    statuses: Object.entries(r.tickets)
      .filter(([, t]) => t.statuses)
      .map(([name]) => name),
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

/** The names the tools in use are registered under, in `inUse`'s order. */
const namesInUse = (chosen: Chosen) => [
  chosen.agent,
  chosen.codeHost,
  chosen.tickets,
  chosen.runner,
];

/** A step with its tool's label, and the name the tool is registered
 * under. */
type Of<S> = { tool: string; name: string; step: S };

/** Each tool's steps for the context. */
export function stepsOf(r: Registry, c: SetupContext): Of<SetupStep>[] {
  const names = namesInUse(c.chosen);
  return inUse(r, c.chosen).flatMap((t, i) =>
    [
      ...(t.setup.steps?.(c) ?? []),
      ...(t.setup.credential ? [t.setup.credential] : []),
    ].map((step) => ({ tool: t.label, name: names[i]!, step })),
  );
}

/** The secret and credential steps among them. */
export function secretSteps(
  r: Registry,
  c: SetupContext,
): Of<SecretStep | CredentialStep>[] {
  return stepsOf(r, c).filter(
    (s): s is Of<SecretStep | CredentialStep> =>
      s.step.kind === "secret" || s.step.kind === "credential",
  );
}

/** Each tool in use that keeps a secret on a person's machine, by the name
 * it is registered under. */
export function keptBy(
  r: Registry,
  chosen: Pick<Chosen, "agent" | "codeHost">,
): { name: string; kept: Kept }[] {
  return [
    { name: chosen.codeHost, kept: r.codeHost[chosen.codeHost]!.setup.kept },
    { name: chosen.agent, kept: r.agent[chosen.agent]!.setup.kept },
  ].filter((k): k is { name: string; kept: Kept } => k.kept !== undefined);
}

/** The same context for other parts. */
export const withParts = (c: SetupContext, parts: Iterable<Part>) => ({
  ...c,
  parts: new Set(parts),
});
