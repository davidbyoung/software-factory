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
  /** `unknown`: the check can't be made from the repository, and fails
   * nothing. */
  state: "pass" | "fail" | "off" | "unknown";
  text: string;
  /** What to do about a failure. */
  fix?: string;
  /** The heading `doctor` prints it under: a tool's name, or one of its
   * own. */
  group?: string;
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
  verify?: (
    value: string,
    say?: (line: string) => void,
  ) => Promise<{
    lines: string[];
    account?: string;
    /** Values to keep beside it in the file on the machine. */
    kept?: Record<string, string>;
  }>;
  /** Another secret that meets the same needs, which a command may offer
   * in this one's place. */
  or?: SecretStep;
  /** Printed once it is stored. */
  stored: (names: string[], account?: string) => string;
  /** Set on the secret the tool's `kept` names. `serves` says whether a
   * value this machine holds still does for the parts on: it resolves to
   * the account the value belongs to, when the tool knows, and rejects
   * with the line to print before asking for another. */
  machine?: {
    serves?: (
      value: string,
      owner: string,
    ) => Promise<{ account?: string; kept?: Record<string, string> }>;
  };
};

/** A secret a person also keeps in the file on their machine
 * (`lib/credentials.mts`), for their next repository: the name it is filed
 * under there, what a line calls it, such as `GitHub token`, and every
 * secret a job reads it from. An organization stores its own once, so
 * `init` asks for it only in a repository a person owns. */
export type Kept = { name: string; what: string; secrets: string[] };

/** One value of a credential, stored under its own name. */
export type CredentialPart = { name: string; prompt: string; masked: boolean };

/** A secret of one or more parts, asked for in order and checked together,
 * such as an email and an API token. With `machine`, it is also kept in
 * the file on this machine (`lib/credentials.mts`), filed under the value
 * of the setting `machine.under` names under `tickets`. */
export type CredentialStep = {
  kind: "credential";
  needs: Need[];
  parts: CredentialPart[];
  /** Printed before the first part is read. */
  intro: string[];
  get?: { page: string } | { command: string[] };
  /** Resolves to the account the values belong to, and lines to print;
   * rejects with an `HttpError` when the system refuses them, or with any
   * other error whose message is the line to print. */
  check: (
    values: Record<string, string>,
    site: string,
  ) => Promise<{ account: string; lines: string[] }>;
  /** The line printed for a refusal, before asking again. */
  refused: (reason: string) => string;
  /** Printed when a part is left empty, before "Run ... init again". */
  skipped: string;
  /** Where a token is revoked, for `remove`. */
  revoke?: { page: string };
  machine: { under: string } | null;
};

export type SetupStep = ValueStep | SecretStep | CredentialStep;

/** The names a secret or a credential is stored under. */
export const namesOf = (step: SecretStep | CredentialStep): string[] =>
  step.kind === "secret" ? step.storeAs : step.parts.map((p) => p.name);

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
  /** The one secret among its steps that a person keeps on their machine
   * too. */
  kept?: Kept;
  /** The credential the tool reads, which needs no context to name, so a
   * command finds it without setting up. Asked after its steps. */
  credential?: CredentialStep;
  checks?(c: WithSecrets): Promise<Check[]>;
  /** What `remove` prints as left to remove by hand. */
  leftovers?(c: WithSecrets): string[];
  /** Its own files with the factory's part taken out, for `remove`: only
   * those the factory's part is in. */
  unconfigure?(c: SetupContext): Unconfigured[];
};
