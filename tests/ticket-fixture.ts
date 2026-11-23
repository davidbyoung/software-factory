// A ticket as a test writes it: open or closed, with the factory's record
// in its comments, as GitHub keeps both. `asIssue` turns it into the ticket
// the rules read, with the record and when it finished.
import type { Issue } from "../src/lib/work-status.mts";
import { recordOf } from "../src/tickets/record-comments.mts";
import type { Entry, TicketComment } from "../src/tickets/types.mts";

export type GithubIssue = Omit<Issue, "record" | "finishedAt" | "comments"> & {
  state?: "open" | "closed";
  closedAt?: string | null;
  finishedAt?: string | null;
  comments?: TicketComment[];
  record?: Entry[];
};

export function asIssue<T extends GithubIssue>(
  t: T,
): Omit<T, "state" | "closedAt"> & Issue {
  const { state, closedAt, ...rest } = t;
  const comments = t.comments ?? [];
  return {
    ...rest,
    comments,
    record: t.record ?? recordOf(comments),
    finishedAt:
      t.finishedAt !== undefined
        ? t.finishedAt
        : state === "closed"
          ? (closedAt ?? null)
          : null,
  };
}
