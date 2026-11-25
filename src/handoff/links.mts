// What a session may not say in a pull request or a commit: that it closes a
// ticket that is not its run's. Where GitHub reads more than this does, the
// pull request's own links say so (`session-publish.mts`).
import type { CodeHost } from "../code-host/types.mts";
import type { Tickets } from "../tickets/types.mts";
import { AUTHOR, type RunFile } from "./index.mts";

type On = {
  codeHost: Pick<CodeHost, "closesIn">;
  tickets: Pick<Tickets, "linksIn" | "ref">;
  run: Pick<RunFile, "ref" | "committer" | "others">;
};

/** What is wrong with the text, if anything. */
export function textFault(on: On, text: string): string | undefined {
  const { closes, partOf } = on.tickets.linksIn(text);
  const closed = [
    ...closes.map((key) => on.tickets.ref(key)),
    ...on.codeHost.closesIn(text),
  ];
  const all = [...closed, ...partOf.map((key) => on.tickets.ref(key))];
  const other = all.find((ref) => ref !== on.run.ref);
  if (other) return `links ${other}, which is not this run's`;
  // One of several repositories' merges closes nothing by itself.
  return on.run.others && closed.length > 0
    ? `closes ${on.run.ref}, which closes itself once every repository of its own has merged`
    : undefined;
}

export type Commit = {
  id: string;
  /** Their addresses: git writes some names another way than it is given. */
  author: string;
  committer: string;
  message: string;
};

/** The format `git log -z` prints what `commitsIn` reads in. */
export const COMMITS = "--format=%H%n%ae%n%ce%n%B";

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
  const committer = on.run.committer.email;
  for (const c of commits) {
    const fault = textFault(on, c.message);
    if (fault) return `a commit's message ${fault}`;
    const short = c.id.slice(0, 7);
    if (c.committer !== committer)
      return `commit ${short} is committed by ${c.committer}, not ${committer}`;
    if (c.author !== AUTHOR.email && c.author !== committer)
      return `commit ${short} is written by ${c.author}, not ${AUTHOR.email}`;
  }
  return undefined;
}

/** `textFault` for the run a session is in. */
export async function sessionFault(
  run: RunFile,
): Promise<(text: string) => string | undefined> {
  const { loadSettings, reachOf } = await import("../config.mts");
  const { openCodeHost } = await import("../code-host/index.mts");
  const { openTickets } = await import("../tickets/index.mts");
  const settings = await loadSettings();
  const { repository, codeHost } = await reachOf(process.env);
  const { tickets } = await openTickets(settings, {
    repository,
    board: settings.tickets.board,
  });
  const on = { codeHost: openCodeHost(repository, codeHost), tickets, run };
  return (text) => textFault(on, text);
}
