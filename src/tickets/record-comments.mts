// A ticket's record kept as comments, as GitHub keeps it: each entry is a
// comment whose visible text is followed by its hidden marker lines and the
// agent mark. Only an adapter reads or writes this format; everything above
// the adapter sees entries (`Entry` in `types.mts`).
import type { Entry, NewEntry, TicketComment } from "./types.mts";

export const AGENT_MARK = "<!-- agent -->";

/** The account the pull request review's summary is posted from. Its cost
 * marker counts without the agent mark. */
export const CI_BOT = "github-actions[bot]";

/** The marker of a merge that closed the ticket. GitHub shows the merge on
 * the ticket itself, so its adapter posts nothing for it. */
export const MERGED_MARKER = "<!-- work-status: merged -->";

const MARKER =
  /^<!-- (?:work-status: |cost: |cost-total: |reviewer-run: |reviewer-runs session=)/;

/** A comment's lines outside fenced code blocks, trimmed. */
export function linesOutsideFences(body: string): string[] {
  const lines: string[] = [];
  let fence: string | null = null;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    const opener = /^(`{3,}|~{3,})/.exec(line)?.[1];
    if (opener) {
      if (fence === null) fence = opener;
      else if (opener[0] === fence[0] && opener.length >= fence.length)
        fence = null;
      continue;
    }
    if (fence === null) lines.push(line);
  }
  return lines;
}

/** The comment an entry is posted as. */
export function renderEntry(entry: NewEntry): string {
  if (entry.markers.length === 0) return `${entry.text}\n${AGENT_MARK}`;
  return `${entry.text}\n\n${entry.markers.join("\n")}\n${AGENT_MARK}`;
}

/** The marker lines a comment carries, read as the record reads them: each
 * on a line of its own, outside a fenced code block, in a comment with the
 * agent mark or from the review's bot. */
export function markersIn(comment: TicketComment): string[] {
  if (!comment.body.includes(AGENT_MARK) && comment.author !== CI_BOT)
    return [];
  return linesOutsideFences(comment.body).filter((line) => MARKER.test(line));
}

/** The comment as an entry of the record, or null when it carries no
 * marker. */
export function entryOf(comment: TicketComment): Entry | null {
  const markers = markersIn(comment);
  if (markers.length === 0) return null;
  const text = comment.body
    .split(/\r?\n/)
    .filter((l) => !markers.includes(l.trim()) && l.trim() !== AGENT_MARK)
    .join("\n")
    .trim();
  return {
    id: comment.id,
    at: comment.createdAt,
    author: comment.author,
    text,
    markers,
  };
}

/** The record a ticket's comments hold, oldest first. */
export const recordOf = (comments: TicketComment[]): Entry[] =>
  comments.flatMap((c) => entryOf(c) ?? []);
