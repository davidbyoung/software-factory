// A session may link only its own run's ticket: a pull request, or a commit
// on the default branch, closes each ticket its text says it closes.
import type { CodeHost } from "../code-host/types.mts";
import type { Tickets } from "../tickets/types.mts";
import type { RunFile } from "./index.mts";

/** A ticket the text links that is not this run's, as its system writes it,
 * by the factory's own lines and by any wording the code host acts on. */
export function otherLinked(
  on: {
    codeHost: Pick<CodeHost, "closesIn">;
    tickets: Pick<Tickets, "linksIn" | "ref">;
    run: Pick<RunFile, "ref">;
  },
  text: string,
): string | undefined {
  const { closes, partOf } = on.tickets.linksIn(text);
  return [
    ...[...closes, ...partOf].map((key) => on.tickets.ref(key)),
    ...on.codeHost.closesIn(text),
  ].find((ref) => ref !== on.run.ref);
}
