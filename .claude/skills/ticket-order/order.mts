#!/usr/bin/env node
// The order to work this repository's open tickets in, for the ticket-order
// skill: the ones that can start now, most unblocked first, then the ones
// waiting, then any cycle or blocker that is not an open ticket here.
//
//   node .claude/skills/ticket-order/order.mts [--json]
//
// It reads tickets only through `factory ticket`, so it works with any
// ticket system that has an adapter. A failed read exits 1 with the error
// and prints no order.
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";

export type Run = (
  args: string[],
) => Promise<{ code: number; stdout: string; stderr: string }>;

/** Each ticket is named as its ticket system writes it, such as `#12`. */
export type Order = {
  startNow: { ticket: string; title: string; unblocks: string[] }[];
  waiting: { ticket: string; title: string; waitsOn: string[] }[];
  problems: (
    | { kind: "cycle"; tickets: string[] }
    | { kind: "outside"; ticket: string; blocker: string }
  )[];
};

async function ticket(run: Run, args: string[]): Promise<string> {
  const { code, stdout, stderr } = await run(args);
  if (code !== 0)
    throw new Error(
      `factory ticket ${args.join(" ")} failed: ${stderr.trim() || `exit ${code}`}`,
    );
  return stdout;
}

/** The order tickets are listed in: by name, letters first, then the number
 * as a number. */
const byName = (a: string, b: string) =>
  a.localeCompare(b, "en", { numeric: true });

export async function readOrder(run: Run = factoryTicket): Promise<Order> {
  const open = (
    JSON.parse(await ticket(run, ["list", "--json"])) as {
      key: string;
      ref: string;
      title: string;
    }[]
  ).map((t) => ({ ...t, name: t.ref }));
  const names = new Set(open.map((t) => t.name));
  const waitsOn = new Map<string, string[]>();
  await Promise.all(
    open.map(async (t) => {
      const lines = (await ticket(run, ["blockers", t.key]))
        .split("\n")
        .filter((l) => l.trim() !== "");
      const blockers = lines.map((line) => {
        const match = /^(\S+) (open|closed)$/.exec(line.trim());
        if (!match)
          throw new Error(`unexpected blockers line for ${t.name}: ${line}`);
        return { name: match[1], open: match[2] === "open" };
      });
      waitsOn.set(
        t.name,
        blockers
          .filter((b) => b.open)
          .map((b) => b.name)
          .sort(byName),
      );
    }),
  );

  // What each ticket blocks directly, among the open tickets here.
  const blocks = new Map<string, string[]>(open.map((t) => [t.name, []]));
  for (const [n, list] of waitsOn)
    for (const m of list) if (names.has(m)) blocks.get(m)!.push(n);
  for (const list of blocks.values()) list.sort(byName);

  const reach = (from: string): Set<string> => {
    const seen = new Set<string>();
    const queue = [...blocks.get(from)!];
    while (queue.length > 0) {
      const n = queue.shift()!;
      if (seen.has(n)) continue;
      seen.add(n);
      queue.push(...blocks.get(n)!);
    }
    return seen;
  };
  const reaches = new Map(open.map((t) => [t.name, reach(t.name)]));

  const startNow = open
    .filter((t) => waitsOn.get(t.name)!.length === 0)
    .map((t) => ({
      ticket: t.name,
      title: t.title,
      unblocks: [...reaches.get(t.name)!]
        .filter((n) => n !== t.name)
        .sort(byName),
    }))
    .sort(
      (a, b) =>
        b.unblocks.length - a.unblocks.length || byName(a.ticket, b.ticket),
    );
  const waiting = open
    .filter((t) => waitsOn.get(t.name)!.length > 0)
    .map((t) => ({
      ticket: t.name,
      title: t.title,
      waitsOn: waitsOn.get(t.name)!,
    }))
    .sort((a, b) => byName(a.ticket, b.ticket));

  // A cycle is listed once per group of tickets that all reach each other,
  // as the shortest path from the group's first ticket back to itself.
  const problems: Order["problems"] = [];
  const inCycle = new Set<string>();
  for (const n of [...names].sort(byName)) {
    if (inCycle.has(n) || !reaches.get(n)!.has(n)) continue;
    for (const m of reaches.get(n)!) if (reaches.get(m)!.has(n)) inCycle.add(m);
    problems.push({ kind: "cycle", tickets: shortestCycle(n, blocks) });
  }
  for (const t of waiting)
    for (const m of t.waitsOn)
      if (!names.has(m))
        problems.push({ kind: "outside", ticket: t.ticket, blocker: m });

  return { startNow, waiting, problems };
}

function shortestCycle(start: string, blocks: Map<string, string[]>): string[] {
  const previous = new Map<string, string>();
  const queue = [start];
  while (queue.length > 0) {
    const n = queue.shift()!;
    for (const m of blocks.get(n)!) {
      if (m === start) {
        const path: string[] = [];
        for (let at = n; at !== start; at = previous.get(at)!) path.unshift(at);
        return [start, ...path, start];
      }
      if (!previous.has(m)) {
        previous.set(m, n);
        queue.push(m);
      }
    }
  }
  return [start, start];
}

export function formatOrder(order: Order): string[] {
  const { startNow, waiting, problems } = order;
  if (startNow.length + waiting.length === 0) return ["No open tickets."];
  const list = (ns: string[]) => ns.join(", ");
  const sections: string[][] = [];
  if (startNow.length > 0)
    sections.push([
      "Start now",
      ...startNow.map(
        (t) =>
          `  ${t.ticket}  ${t.title}  unblocks ${t.unblocks.length}` +
          (t.unblocks.length > 0 ? ` (${list(t.unblocks)})` : ""),
      ),
    ]);
  if (waiting.length > 0)
    sections.push([
      "Waiting",
      ...waiting.map(
        (t) => `  ${t.ticket}  ${t.title}  waits on ${list(t.waitsOn)}`,
      ),
    ]);
  if (problems.length > 0)
    sections.push([
      "Problems",
      ...problems.map((p) =>
        p.kind === "cycle"
          ? `  cycle: ${p.tickets.join(" -> ")}`
          : `  ${p.ticket} waits on ${p.blocker}, which is not an open ticket here`,
      ),
    ]);
  return sections.flatMap((s, i) => (i === 0 ? s : ["", ...s]));
}

export async function main(
  argv: string[],
  run: Run,
  out: (line: string) => void,
  err: (line: string) => void,
): Promise<number> {
  let order: Order;
  try {
    order = await readOrder(run);
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    return 1;
  }
  if (argv.includes("--json")) out(JSON.stringify(order, null, 2));
  else formatOrder(order).forEach((line) => out(line));
  return 0;
}

/** Runs `factory ticket ARGS` in the current directory. */
const factoryTicket: Run = (args) =>
  new Promise((resolve) => {
    execFile(
      "npx",
      ["--no-install", "factory", "ticket", ...args],
      { maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) =>
        resolve({
          code: error ? (typeof error.code === "number" ? error.code : 1) : 0,
          stdout,
          stderr,
        }),
    );
  });

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = await main(
    process.argv.slice(2),
    factoryTicket,
    (line) => console.log(line),
    (line) => console.error(line),
  );
}
