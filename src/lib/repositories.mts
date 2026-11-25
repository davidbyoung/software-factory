// A ticket's repositories: the list its Repositories section holds, the
// order they merge in, who confirmed the list, and how far each one is. It
// reads and writes text and answers from what it is given, and calls
// nothing.
import type { Entry } from "../tickets/types.mts";
import { fencedLines } from "./fences.mts";

/** Where the clones of a ticket's other repositories go on a machine, as
 * `.claude/settings.json` names it. */
export const WORK = "~/.local/share/software-factory/work";

/** One repository of a ticket's, and those it merges after. */
export type Listed = { name: string; after: string[] };

const HEADING = "## Repositories";
const NAME = String.raw`[\w.-]+(?:/[\w.-]+)+`;
const LINE = new RegExp(`^- (${NAME})((?:, after ${NAME})*)$`);

/** A line of the section that is not one the factory writes. */
export class SectionError extends Error {
  readonly line: string;
  constructor(line: string) {
    super(`can't read ${JSON.stringify(line)}`);
    this.name = "SectionError";
    this.line = line;
  }
}

/** Where the section is among the body's lines, its heading included, or
 * null when it has none. A sample of one in a code block is not it. */
function placeOf(lines: string[]): { from: number; to: number } | null {
  const fenced = fencedLines(lines.join("\n"));
  const heading = (line: string, i: number) =>
    !fenced[i] && /^##? /.test(line.trimEnd());
  const from = lines.findIndex(
    (line, i) => !fenced[i] && line.trimEnd() === HEADING,
  );
  if (from < 0) return null;
  const next = lines.findIndex((line, i) => i > from && heading(line, i));
  return { from, to: next < 0 ? lines.length : next };
}

/** The list the body's section holds, or null when it names none. */
export function listIn(body: string): Listed[] | null {
  const lines = body.split(/\r?\n/);
  const place = placeOf(lines);
  if (!place) return null;
  const list: Listed[] = [];
  for (const raw of lines.slice(place.from + 1, place.to)) {
    const line = raw.trim();
    if (line === "") continue;
    const match = LINE.exec(line);
    if (!match) throw new SectionError(line);
    list.push({
      name: match[1],
      after: match[2].split(", after ").filter(Boolean),
    });
  }
  return list.length ? list : null;
}

const lineOf = (r: Listed) =>
  `- ${r.name}${r.after.map((name) => `, after ${name}`).join("")}`;

/** The headings refinement writes, which the section goes before. */
const BEFORE = /^## (?:Proposed docs|Decisions|Spec|Acceptance criteria)$/;

/** The body with the list in its section, or with no section for null. */
export function withList(body: string, list: Listed[] | null): string {
  const section = list ? [HEADING, "", ...list.map(lineOf)] : null;
  return withSection(body, section);
}

/** The section as it stands, heading and all, or null. */
export function sectionOf(body: string): string[] | null {
  const lines = body.split(/\r?\n/);
  const place = placeOf(lines);
  if (!place) return null;
  const own = lines.slice(place.from, place.to);
  while (own.at(-1)?.trim() === "") own.pop();
  return own;
}

/** The body with that section in place of its own. */
export function withSection(body: string, section: string[] | null): string {
  const lines = body.split(/\r?\n/);
  const place = placeOf(lines);
  if (!place && !section) return body;
  const fenced = fencedLines(body);
  const at = place
    ? place.from
    : lines.findIndex((line, i) => !fenced[i] && BEFORE.test(line.trimEnd()));
  const before = lines.slice(0, at < 0 ? lines.length : at);
  const after = at < 0 ? [] : lines.slice(place ? place.to : at);
  const trimmed = (part: string[]) =>
    part
      .join("\n")
      .replace(/^\n+|\s+$/g, "")
      .trimEnd();
  const text = [
    trimmed(before),
    ...(section ? [section.join("\n")] : []),
    trimmed(after),
  ]
    .filter(Boolean)
    .join("\n\n");
  return body.endsWith("\n") || section ? `${text}\n` : text;
}

/** All of a repository's name but its last part. */
export const ownerOf = (name: string) => name.slice(0, name.lastIndexOf("/"));
/** Its last part. */
export const lastPart = (name: string) => name.slice(name.lastIndexOf("/") + 1);

export const sameRepository = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

/** What to call a ticket in a name that takes no `/` or `#`, such as a
 * branch's: `api-12` for `acme/api#12`, and its key otherwise. */
export const wordOf = (key: string) =>
  key.replace(/^.*\/([^/#]+)#(\d+)$/, "$1-$2");

/** The same, with the owner, for a name that has to be one of a kind. */
export const fullWordOf = (key: string) => key.replace(/[/#]+/g, "-");

/** The repositories in the order they merge: each after those it waits
 * for, and otherwise as listed. */
export function mergeOrder<R extends Listed>(list: R[]): R[] {
  const left = [...list];
  const placed: R[] = [];
  const waits = (r: R) =>
    r.after.some((name) => left.some((x) => sameRepository(x.name, name)));
  while (left.length) {
    const at = left.findIndex((r) => !waits(r));
    if (at < 0) return [...placed, ...left];
    placed.push(...left.splice(at, 1));
  }
  return placed;
}

/** The repositories whose order goes in a circle, in that order, or null. */
export function circleIn(list: Listed[]): string[] | null {
  const of = new Map(list.map((r) => [r.name, r.after]));
  const walk = (name: string, path: string[]): string[] | null => {
    const at = path.indexOf(name);
    if (at >= 0) return path.slice(at);
    for (const next of of.get(name) ?? []) {
      const found = walk(next, [...path, name]);
      if (found) return found;
    }
    return null;
  };
  for (const r of list) {
    const found = walk(r.name, []);
    if (found) return found;
  }
  return null;
}

/** What is wrong with an order that goes in a circle. */
export function circleFault(list: Listed[]): string | null {
  const circle = circleIn(list);
  if (!circle) return null;
  const names = list.map((r) => r.name).filter((n) => circle.includes(n));
  return names.length === 2
    ? `${names[0]} and ${names[1]} each merge after the other`
    : `The order goes in a circle: ${names.join(", ")}`;
}

export const sameList = (a: Listed[], b: Listed[]) =>
  JSON.stringify(a) === JSON.stringify(b);

// ------------------------------------------------ Who confirmed the list

const MARK = /^<!-- repositories: (.+) -->$/;

/** The line of a note that records the list. */
export const listMarker = (list: Listed[]) =>
  `<!-- repositories: ${list.map((r) => [r.name, ...r.after].join(">")).join(" ")} -->`;

/** The list as a sentence. */
export const listText = (list: Listed[]) =>
  list
    .map((r) =>
      r.after.length ? `${r.name} (after ${r.after.join(", ")})` : r.name,
    )
    .join(", ");

/** The list a note's marker lines record, or null. */
export function markedList(markers: string[]): Listed[] | null {
  for (const line of markers) {
    const match = MARK.exec(line);
    if (!match) continue;
    return match[1].split(" ").map((word) => {
      const [name, ...after] = word.split(">");
      return { name, after };
    });
  }
  return null;
}

/** Whether a list counts, or why not: `at` is the repository whoever
 * confirms it has to be able to write to. */
export type Confirmed =
  { counts: true } | { counts: false; at: string; unchecked?: string };

const byTime = (a: Entry, b: Entry) => Date.parse(a.at) - Date.parse(b.at);

/** Whether the newest note by someone who can write to every repository it
 * names records this list. Anyone can write a note, and the section. */
export async function confirmed(
  list: Listed[],
  record: Entry[],
  canWrite: (repository: string, login: string) => Promise<boolean>,
): Promise<Confirmed> {
  const notes = [...record]
    .sort(byTime)
    .reverse()
    .flatMap((entry) => {
      const marked = markedList(entry.markers);
      return marked ? [{ author: entry.author, list: marked }] : [];
    });
  const asked = new Map<string, Promise<boolean>>();
  const may = (repository: string, login: string) => {
    const key = `${login} ${repository}`;
    if (!asked.has(key)) asked.set(key, canWrite(repository, login));
    return asked.get(key)!;
  };
  const first = list[0]!.name;
  try {
    for (const note of notes) {
      const answers = await Promise.all(
        note.list.map((r) => may(r.name, note.author)),
      );
      if (answers.includes(false)) continue;
      if (sameList(note.list, list)) return { counts: true };
      break;
    }
    if (!notes.length) return { counts: false, at: first };
    for (const r of list)
      if (!(await may(r.name, notes[0].author)))
        return { counts: false, at: r.name };
    return { counts: false, at: first };
  } catch (error) {
    const unchecked = error instanceof Error ? error.message : String(error);
    return { counts: false, at: first, unchecked };
  }
}

/** Why a list does not count, with the command that confirms it. `key` is
 * the ticket as a command takes it. */
export function unconfirmed(
  ref: string,
  key: string,
  list: Listed[],
  c: Extract<Confirmed, { counts: false }>,
): string {
  if (c.unchecked !== undefined)
    return `could not check who confirmed ${ref}'s repositories`;
  const pairs = list.flatMap((r) =>
    r.after.map((name) => ` --after ${r.name}=${name}`),
  );
  return `${ref}'s repositories were not confirmed by someone who can write to ${c.at}: run factory ticket repositories ${key} --set ${list.map((r) => r.name).join(" ")}${pairs.join("")}`;
}

// ------------------------------------------------ How far each one is

/** A pull request that builds part of the ticket in one repository. */
export type LinkedPull = {
  number: number;
  state: "open" | "merged";
  createdAt: string;
  mergedAt: string | null;
  branch: string;
  isDraft: boolean;
  body: string;
};

/** A ticket's repository with the pull requests that count for it. */
export type Progress = Listed & { pulls: LinkedPull[] };

const FINISHED = "<!-- work-status: finished -->";
const CLAIM = /^<!-- work-status: claim /;

/** The time a merge has to be after to count: that of the note that every
 * repository merged, and for a ticket reopened with no such note, that of
 * its newest claim. Null when every merge counts. */
export function countsSince(record: Entry[], reopened: boolean): string | null {
  const last = (test: (line: string) => boolean) =>
    [...record]
      .sort(byTime)
      .filter((e) => e.markers.some(test))
      .at(-1)?.at ?? null;
  return (
    last((line) => line === FINISHED) ??
    (reopened ? last((line) => CLAIM.test(line)) : null)
  );
}

export const counting = (pulls: LinkedPull[], since: string | null) =>
  pulls.filter(
    (p) =>
      p.state === "open" ||
      since === null ||
      (p.mergedAt !== null && Date.parse(p.mergedAt) > Date.parse(since)),
  );

const isMerged = (r: Progress) =>
  r.pulls.length > 0 && r.pulls.every((p) => p.state === "merged");

const openOf = (r: Progress) => r.pulls.find((p) => p.state === "open");

/** The first repository in merge order with no pull request, or null. */
export const nextToBuild = (all: Progress[]): Progress | null =>
  mergeOrder(all).find((r) => r.pulls.length === 0) ?? null;

/** The first repository `name` merges after that has not merged, with its
 * open pull request when it has one. */
export function waitsFor(
  all: Progress[],
  name: string,
): { name: string; pull: number | null } | null {
  const own = all.find((r) => sameRepository(r.name, name));
  for (const r of all)
    if (own?.after.some((x) => sameRepository(x, r.name)) && !isMerged(r))
      return { name: r.name, pull: openOf(r)?.number ?? null };
  return null;
}

export const allMerged = (all: Progress[]) => all.every(isMerged);

/** The newest merge among them, or null. */
export const newestMerge = (all: Progress[]): string | null =>
  all
    .flatMap((r) => r.pulls.flatMap((p) => p.mergedAt ?? []))
    .sort()
    .at(-1) ?? null;

/** What the ticket's state is worked out from. */
export function standing(all: Progress[]) {
  const open = all.flatMap((r) => {
    const pull = openOf(r);
    return pull
      ? [{ repository: r.name, number: pull.number, at: pull.createdAt }]
      : [];
  });
  return {
    /** Every repository has a pull request, and one is open. */
    reviewing: open.length > 0 && nextToBuild(all) === null,
    /** One has a pull request, and another has none. */
    partly: nextToBuild(all) !== null && all.some((r) => r.pulls.length > 0),
    unbuilt: nextToBuild(all) !== null,
    open,
  };
}
