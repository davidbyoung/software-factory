// What a session's words may not do once they are on the default branch, as
// a pull request's title and body, or a commit's message, are when it merges.
import type { CodeHost } from "../code-host/types.mts";
import type { Runner } from "../runner/types.mts";
import type { Tickets } from "../tickets/types.mts";
import { AUTHOR, type RunFile } from "./index.mts";

type On = {
  codeHost: Pick<CodeHost, "closesIn">;
  runner: Pick<Runner, "skipsRuns">;
  tickets: Pick<Tickets, "linksIn" | "ref">;
  run: Pick<RunFile, "ref" | "committer">;
};

/** What is wrong with the text, if anything: it links a ticket that is not
 * this run's, by the factory's own lines or in any wording the code host
 * acts on, or it keeps CI from running. */
export function textFault(on: On, text: string): string | undefined {
  const { closes, partOf } = on.tickets.linksIn(text);
  const other = [
    ...[...closes, ...partOf].map((key) => on.tickets.ref(key)),
    ...on.codeHost.closesIn(text),
  ].find((ref) => ref !== on.run.ref);
  if (other) return `links ${other}, which is not this run's`;
  if (on.runner.skipsRuns(text)) return "keeps CI from running";
  return undefined;
}

export type Commit = {
  id: string;
  author: string;
  committer: string;
  message: string;
};

/** The format `git log -z` prints what `commitsIn` reads in. */
export const COMMITS = "--format=%H%n%an <%ae>%n%cn <%ce>%n%B";

export const commitsIn = (log: string): Commit[] =>
  log
    .split("\0")
    .filter((c) => c.trim() !== "")
    .map((c) => {
      const [id, author, committer, ...message] = c.split("\n");
      return { id, author, committer, message: message.join("\n") };
    });

/** What is wrong with the first commit that has something wrong with it. */
export function commitsFault(on: On, commits: Commit[]): string | undefined {
  const named = (who: { name: string; email: string }) =>
    `${who.name} <${who.email}>`;
  const committer = named(on.run.committer);
  for (const c of commits) {
    const fault = textFault(on, c.message);
    if (fault) return `a commit's message ${fault}`;
    if (c.committer !== committer)
      return `commit ${c.id.slice(0, 7)} is committed by ${c.committer}, not ${committer}`;
    if (c.author !== named(AUTHOR) && c.author !== committer)
      return `commit ${c.id.slice(0, 7)} is written by ${c.author}, not ${named(AUTHOR)}`;
  }
  return undefined;
}

/** `textFault` for the run a session is in. */
export async function sessionFault(
  run: RunFile,
): Promise<(text: string) => string | undefined> {
  const { loadSettings, reachOf } = await import("../config.mts");
  const { openCodeHost } = await import("../code-host/index.mts");
  const { openRunner } = await import("../runner/index.mts");
  const { openTickets } = await import("../tickets/index.mts");
  const settings = await loadSettings();
  const { repository, codeHost, runner } = await reachOf(process.env);
  const { tickets } = await openTickets(settings, {
    repository,
    board: settings.tickets.board,
  });
  const on = {
    codeHost: openCodeHost(repository, codeHost),
    runner: openRunner(repository, runner),
    tickets,
    run,
  };
  return (text) => textFault(on, text);
}
