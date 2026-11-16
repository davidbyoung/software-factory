import { parseSettings } from "../src/config.mts";
import type { Gh } from "../src/lib/gh.mts";

/** The factory's settings as the scripts' tests read them: this repository
 * and its board, with builds started from the board. */
export const fakeSettings = async () =>
  parseSettings(
    {
      version: 1,
      repository: "acme/widgets",
      tickets: { board: 1 },
      builds: { trigger: "own-server" },
    },
    () => true,
  );

/** A gh runner that answers by the first route whose pattern matches the
 * joined arguments, and records every call. An Error answer rejects, as gh
 * does on a failed request. */
export function fakeGh(routes: [RegExp, unknown | (() => unknown)][]) {
  const calls: string[] = [];
  const run: Gh = async (args) => {
    const line = args.join(" ");
    calls.push(line);
    const route = routes.find(([pattern]) => pattern.test(line));
    if (!route) throw new Error(`unexpected gh call: ${line}`);
    const answer =
      typeof route[1] === "function" ? (route[1] as () => unknown)() : route[1];
    if (answer instanceof Error) throw answer;
    return typeof answer === "string" ? answer : JSON.stringify(answer);
  };
  return { run, calls };
}

export const LOCAL_VIEWER = { data: { viewer: { login: "acme" } } };
