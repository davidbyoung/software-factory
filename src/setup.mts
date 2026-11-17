// What a tool tells `init`, `doctor`, and `remove`: the values and secrets
// it needs, its own checks, and what it leaves behind. Each kind of tool
// (code host, ticket system, runner, and coding agent) registers one of
// these in `tools.mts`, so a new tool is set up, checked, and removed
// without an edit to those commands.
import type { CodeHost } from "./code-host/types.mts";
import type { Settings } from "./config.mts";
import type { Part } from "./parts.mts";
import type { Runner } from "./runner/types.mts";
import type { Tickets } from "./tickets/types.mts";

/** The repository rule that requires the review's verdict, by name, so
 * removing it is deleting that one rule. */
export const RULE = "Software factory";

export type Check = {
  state: "pass" | "fail" | "off";
  text: string;
  /** What to do about a failure. */
  fix?: string;
};

/** A secret is needed for a part that is on, or always when `part` is
 * null, and any one of `anyOf` being set meets it. */
export type Need = { part: Part | null; anyOf: string[] };

/** A value written under the tool's kind's block of the settings. */
export type ValueStep = {
  kind: "value";
  /** Its key, such as `site` under `tickets`. */
  key: string;
  part: Part | null;
  ask: string;
  fallback?: string;
};

export type SecretStep = {
  kind: "secret";
  needs: Need[];
  /** The names a pasted value is stored under. */
  storeAs: string[];
  /** Printed before the value is read. */
  intro: string[];
  get?: { page: string } | { command: string[] };
  /** The masked prompt. */
  prompt: string;
  /** Printed when nothing is pasted, before "Run ... init again". */
  skipped: string;
  /** Resolves to lines to print, and the account the value belongs to
   * when the tool knows it; rejects with the line to print before asking
   * again. */
  verify?: (value: string) => Promise<{ lines: string[]; account?: string }>;
  /** Printed once it is stored. */
  stored: (names: string[], account?: string) => string;
};

export type SetupStep = ValueStep | SecretStep;

/** The name of each kind's tool in use. */
export type Chosen = {
  codeHost: string;
  tickets: string;
  runner: string;
  agent: string;
};

export type Opened = { codeHost: CodeHost; runner: Runner; tickets: Tickets };

export type SetupContext = {
  repository: string;
  root: string;
  parts: ReadonlySet<Part>;
  chosen: Chosen;
  settings: Settings | null;
  hasCommand: (name: string) => boolean;
  opened: Opened;
};

/** The secrets set, or null when the runner could not list them. */
export type WithSecrets = SetupContext & { secrets: string[] | null };

/** A file of the tool's own, as it reads with the factory's part taken
 * out: null to delete it. */
export type Unconfigured = { path: string; text: string | null };

export type ToolSetup = {
  /** Its row under Found, when it says more than its label. */
  found?(c: Pick<SetupContext, "hasCommand">): string;
  steps?(c: SetupContext): SetupStep[];
  checks?(c: WithSecrets): Promise<Check[]>;
  /** What `remove` prints as left to remove by hand. */
  leftovers?(c: WithSecrets): string[];
  /** Its own files with the factory's part taken out, for `remove`: only
   * those the factory's part is in. */
  unconfigure?(c: SetupContext): Unconfigured[];
};
