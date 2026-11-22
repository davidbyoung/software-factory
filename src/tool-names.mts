// The tools the factory has built, by the name a setting gives each, and the
// keys a ticket system adds under `tickets`. `config.mts` checks the
// settings against these, and `tools.mts` registers what each name runs; a
// test fails when the two differ. It imports nothing that imports the
// settings, so both can read it.
import { listed } from "./lib/listed.mts";

export type Built = {
  codeHost: readonly string[];
  /** Each ticket system, with the keys it adds under `tickets`. */
  tickets: Readonly<Record<string, readonly string[]>>;
  runner: readonly string[];
  /** Each spec tool, with the check \`specs.check\` defaults to. */
  specs: Readonly<Record<string, string>>;
  /** Why a ticket system or code host refuses a label name, or null, for
   * each that limits names beyond their not being empty. */
  labelFaults: {
    tickets: Readonly<Record<string, LabelFault>>;
    codeHost: Readonly<Record<string, LabelFault>>;
  };
};

export type LabelFault = (name: string) => string | null;

export const BUILT: Built = {
  codeHost: ["github"],
  tickets: { github: [] },
  runner: ["github-actions"],
  specs: {
    openspec:
      "npx --no-install openspec validate --all --strict --no-interactive",
  },
  labelFaults: { tickets: {}, codeHost: {} },
};

/** The words every command fails with for a name that is not built, such
 * as `tickets.type "jira" is not supported. "github" is the only ticket
 * system built.` */
export function unsupported(
  key: string,
  name: string,
  noun: string,
  built: readonly string[],
): string {
  const names = built.map((n) => `"${n}"`);
  return names.length === 1
    ? `${key} "${name}" is not supported. ${names[0]} is the only ${noun} built.`
    : `${key} "${name}" is not supported. The ${noun}s built are ${listed(names)}.`;
}
