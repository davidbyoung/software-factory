// `lunamill approval-policies`: the steps of the jobs that check a pull
// request against the approval policies, and `check`, which tries them on
// a person's machine.
//
//   lunamill approval-policies check [--pull N]   what a change would wait for
//   lunamill approval-policies prepare DIR        the change and each check's input
//   lunamill approval-policies commands DIR       each policy's command, with no token
//   lunamill approval-policies agent DIR I        check I's agent
//   lunamill approval-policies status DIR         the "Approval policies" status
//   lunamill approval-policies kept NAME          the trusted run that kept NAME
//   lunamill approval-policies approve DIR        what the label approves
//
// The jobs run from a checkout of the default branch, with its settings,
// so a pull request cannot change how it is judged.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ApprovalPolicy, Settings } from "./config.mts";
import type { CodeHost } from "./code-host/types.mts";
import type { Runner } from "./runner/types.mts";
import type { Tickets } from "./tickets/types.mts";
import type { ChangedFile } from "./merge-policy.mts";
import {
  agentOutcome,
  changedFiles,
  checkName,
  checksOf,
  CONTEXT,
  diffOf,
  outcomeOf,
  statusOf,
  type Check,
  type Finding,
  type Git,
  type Input,
  type Outcome,
  type Ran,
  type Result,
  LABEL_LOOK,
} from "./approval-policies.mts";
import * as say from "./lib/output.mts";

/** The workflow file a trusted run is of. */
export const WORKFLOW_FILE = "lunamill.yml";

/** What lunamill names the artifacts that keep a pull request's
 * findings, and what an approval approved, for one commit against one base
 * branch: a change of base finds neither. An artifact's name takes no `/`,
 * which a branch's can hold. */
const baseOf = (branch: string) => branch.replace(/[^\w.-]/g, "-");
export const keptName = (pr: number, head: string, base: string) =>
  `approval-policies-${pr}-${head}-${baseOf(base)}`;
export const approvedName = (pr: number, head: string, base: string) =>
  `approval-policies-approved-${pr}-${head}-${baseOf(base)}`;

/** A comment lunamill posts once, told apart by its first line. */
const REVIEW_NOTE = "<!-- factory: approval policies wait for the label -->";

/** One check of the plan: what it is called and what checks it. */
export type Planned = {
  i: number;
  name: string;
  run: string | null;
  agent: string | null;
};

/** What `prepare` leaves for the other steps. */
export type Plan = {
  pr: number;
  head: string;
  /** Set when `prepare` posted the status itself and nothing runs. */
  done: boolean;
  checks: Planned[];
};

export type Deps = {
  settings: Settings;
  codeHost: Pick<
    CodeHost,
    | "get"
    | "setStatus"
    | "statuses"
    | "removeLabel"
    | "ensureLabel"
    | "labeledBy"
    | "canWrite"
    | "comment"
    | "comments"
  >;
  tickets: Pick<Tickets, "linksIn" | "read">;
  runner: Pick<Runner, "keptBy" | "thisRun">;
  git: Git;
  env: Record<string, string | undefined>;
  /** The root of the checkout of the default branch. */
  root: string;
  runCommand: (command: string, input: Input) => Promise<Ran>;
  runAgent: (
    name: string,
    input: Input,
    found: Finding[] | null,
  ) => Promise<
    { findings: Finding[] } | { wrong: string } | { failed: string }
  >;
  /** A line for the workflow: `key=value` for its outputs. */
  output: (line: string) => void;
  /** Markdown for the run's summary. */
  summary: (markdown: string) => void;
  out: say.Out;
  err: say.Out;
};

const readJson = <T,>(path: string): T =>
  JSON.parse(readFileSync(path, "utf8"));
const writeJson = (path: string, v: unknown) => {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(v, null, 2)}\n`);
};

/** The ticket a pull request's body names: the first it closes, or else
 * the first it is part of. */
async function ticketOf(
  d: Pick<Deps, "tickets" | "settings">,
  body: string,
): Promise<Input["ticket"]> {
  const links = d.tickets.linksIn(body, d.settings.repository);
  const key = links.closes[0] ?? links.partOf[0];
  if (key === undefined) return null;
  try {
    return { id: key, text: (await d.tickets.read(key)).body };
  } catch {
    return { id: key, text: "" };
  }
}

type Event = {
  action?: string;
  changes?: { base?: unknown };
  label?: { name?: string };
  review?: { state?: string };
  pull_request?: {
    number: number;
    head?: { sha?: string };
    base?: { ref?: string };
  };
};

const eventOf = (d: Pick<Deps, "env">): Event =>
  JSON.parse(readFileSync(d.env.GITHUB_EVENT_PATH!, "utf8"));

const UNREADABLE =
  "The change couldn't be read: git can't compare it with where it branched.";

/** `prepare DIR`: takes the label off after a push or a change of base,
 * posts the status of a draft or a change that can't be read, and
 * otherwise writes each check's input and the plan. */
export async function prepare(d: Deps, dir: string): Promise<Plan> {
  const event = eventOf(d);
  const pr = event.pull_request!.number;
  const pull = await d.codeHost.get(pr);
  const head = pull.head.sha;
  const label = d.settings.codeHost.labels["policy-override"];
  const status = (state: "pending" | "success", description: string) =>
    d.codeHost.setStatus(head, {
      state,
      name: CONTEXT,
      description,
      link: d.runner.thisRun(d.env)?.page,
    });
  const unread =
    event.action === "synchronize" ||
    (event.action === "edited" && event.changes?.base !== undefined);
  if (unread && pull.labels.includes(label))
    await d.codeHost.removeLabel(pr, label);
  const plan: Plan = { pr, head, done: true, checks: [] };
  const finish = () => {
    writeJson(join(dir, "plan.json"), plan);
    d.output("commands=false");
    d.output("agents=[]");
    return plan;
  };
  if (pull.isDraft) {
    await status("pending", "Checks when the pull request is marked ready");
    return finish();
  }
  const fetched = d.git([
    "fetch",
    "--no-tags",
    "--quiet",
    "origin",
    `+refs/pull/${pr}/head:refs/factory/head`,
    `+refs/heads/${pull.base.branch}:refs/factory/base`,
  ]);
  const base = fetched.ok
    ? d.git(["merge-base", "refs/factory/base", head])
    : { ok: false, out: "" };
  const mergeBase = base.out.trim();
  const files =
    base.ok && mergeBase ? changedFiles(d.git, mergeBase, head) : null;
  const unreadable = async () => {
    await d.codeHost.ensureLabel(label, LABEL_LOOK);
    await status(
      "pending",
      statusOf([], { label, unreadable: true }).description,
    );
    return finish();
  };
  if (files === null) return unreadable();
  const checks = checksOf(d.settings.approvalPolicies, files);
  if (!checks.length) {
    await status("success", statusOf([], { label }).description);
    return finish();
  }
  const ticket = await ticketOf(d, pull.body);
  for (const [i, c] of checks.entries()) {
    const diff = diffOf(d.git, mergeBase, head, c.files);
    if (diff === null) return unreadable();
    const input: Input = {
      version: 1,
      repository: d.settings.repository,
      pull: pr,
      base: mergeBase,
      head,
      files: c.files,
      diff,
      in: c.folder,
      ticket,
    };
    writeJson(join(dir, "input", `${i}.json`), input);
    plan.checks.push({
      i,
      name: checkName(c),
      run: c.policy.run,
      agent: c.policy.agent,
    });
  }
  plan.done = false;
  writeJson(join(dir, "plan.json"), plan);
  d.output(`kept=${keptName(pr, head, pull.base.branch)}`);
  d.output(`approved=${approvedName(pr, head, pull.base.branch)}`);
  d.output(`commands=${plan.checks.some((c) => c.run !== null)}`);
  d.output(
    `agents=${JSON.stringify(plan.checks.filter((c) => c.agent !== null).map((c) => c.i))}`,
  );
  return plan;
}

/** Runs one check's command against a pull request, as the jobs do: its
 * change read from git against the merge base, from `root`, the default
 * branch's checkout, with no credential. A change git can't read is a
 * failed check. The merge policy runs it to tell whether an agent will
 * read anything. */
export async function policyRun(
  check: Check,
  o: {
    git: Git;
    pr: number;
    base: string;
    head: string;
    repository: string;
    body: string;
    tickets: Pick<Tickets, "linksIn" | "read">;
    root: string;
  },
): Promise<Outcome> {
  const command = check.policy.run ?? "";
  const failed: Outcome = {
    kind: "failed",
    why: "the change couldn't be read",
    command,
    stderr: "",
  };
  const fetched = o.git([
    "fetch",
    "--no-tags",
    "--quiet",
    "origin",
    `+refs/pull/${o.pr}/head:refs/factory/head`,
    `+refs/heads/${o.base}:refs/factory/base`,
  ]);
  const mergeBase = fetched.ok
    ? o.git(["merge-base", "refs/factory/base", o.head]).out.trim()
    : "";
  const diff = mergeBase ? diffOf(o.git, mergeBase, o.head, check.files) : null;
  if (diff === null) return failed;
  const links = o.tickets.linksIn(o.body, o.repository);
  const key = links.closes[0] ?? links.partOf[0];
  let ticket: Input["ticket"] = null;
  if (key !== undefined)
    try {
      ticket = { id: key, text: (await o.tickets.read(key)).body };
    } catch {
      ticket = { id: key, text: "" };
    }
  const { runCommand } = await import("./approval-policies.mts");
  return outcomeOf(
    command,
    await runCommand(
      command,
      {
        version: 1,
        repository: o.repository,
        pull: o.pr,
        base: mergeBase,
        head: o.head,
        files: check.files,
        diff,
        in: check.folder,
        ticket,
      },
      { cwd: o.root },
    ),
  );
}

/** `commands DIR`: runs each policy's command, with no credential in its
 * environment. With an agent too, what it found is the agent's to read. */
export async function commands(d: Deps, dir: string): Promise<void> {
  const plan = readJson<Plan>(join(dir, "plan.json"));
  for (const c of plan.checks) {
    if (c.run === null) continue;
    const input = readJson<Input>(join(dir, "input", `${c.i}.json`));
    const outcome = outcomeOf(c.run, await d.runCommand(c.run, input));
    // An agent reads only what its command found: none, and it has
    // nothing to read.
    const file =
      c.agent !== null && outcome.kind === "findings"
        ? `${c.i}.command.json`
        : `${c.i}.json`;
    writeJson(join(dir, "answer", file), outcome);
  }
}

/** `agent DIR I`: check I's agent, which reads what its command found
 * when it has one. Without a Claude credential it can't run. */
export async function agent(d: Deps, dir: string, i: number): Promise<void> {
  const plan = readJson<Plan>(join(dir, "plan.json"));
  const c = plan.checks.find((x) => x.i === i);
  if (!c || c.agent === null) throw new Error(`check ${i} has no agent`);
  const answer = join(dir, "answer", `${i}.json`);
  let found: Finding[] | null = null;
  if (c.run !== null) {
    const command = join(dir, "answer", `${i}.command.json`);
    // The command found nothing, or failed: its outcome stands.
    if (!existsSync(command)) return;
    const o = readJson<Outcome>(command);
    if (o.kind === "findings") found = o.findings;
  }
  if (!d.env.CLAUDE_CODE_OAUTH_TOKEN && !d.env.ANTHROPIC_API_KEY) {
    writeJson(answer, { kind: "cant-run", agent: c.agent } satisfies Outcome);
    return;
  }
  const input = readJson<Input>(join(dir, "input", `${i}.json`));
  writeJson(
    answer,
    agentOutcome(
      c.agent,
      await d.runAgent(c.agent, found ? onlyFound(input, found) : input, found),
      found,
    ),
  );
}

/** The input narrowed to the files a command's findings name, and their
 * diff: an agent reads only what its command found, whatever the change's
 * size. */
export function onlyFound(input: Input, found: Finding[]): Input {
  const named = new Set(found.map((f) => f.file));
  const files = input.files.filter(
    (f) =>
      named.has(f.filename) ||
      (f.previous_filename !== undefined && named.has(f.previous_filename)),
  );
  const keep = new Set(
    files.flatMap((f) => [f.filename, f.previous_filename ?? f.filename]),
  );
  const diff = input.diff
    .split(/(?=^diff --git )/m)
    .filter((part) => {
      const m = /^diff --git a\/(.+?) b\/(.+)$/m.exec(part);
      return m !== null && (keep.has(m[1]!) || keep.has(m[2]!));
    })
    .join("");
  return { ...input, files, diff };
}

/** What became of each check of the plan. A check with no answer is an
 * agent that didn't run, or a command that gave none. */
export function resultsOf(dir: string, plan: Plan): Result[] {
  return plan.checks.map((c) => {
    const file = join(dir, "answer", `${c.i}.json`);
    const outcome: Outcome = existsSync(file)
      ? readJson<Outcome>(file)
      : c.agent !== null
        ? { kind: "cant-run", agent: c.agent }
        : {
            kind: "failed",
            why: "it gave no answer",
            command: c.run ?? "",
            stderr: "",
          };
    return { name: c.name, outcome };
  });
}

/** The run's summary: each check's findings, or what became of it. */
export function summaryOf(results: readonly Result[]): string {
  const lines = ["## Approval policies", ""];
  for (const { name, outcome: o } of results) {
    if (o.kind === "findings") {
      lines.push(`### ${name}: ${o.findings.length} waiting for approval`, "");
      for (const f of o.findings)
        lines.push(
          `- \`${f.file}${f.line === undefined ? "" : `:${f.line}`}\` ${f.title}${f.why ? `. ${f.why}` : ""}`,
        );
      lines.push("");
    } else if (o.kind === "failed")
      lines.push(`- **${name}:** the check failed: ${o.why}`);
    else if (o.kind === "cant-run")
      lines.push(`- **${name}:** ${o.agent} can't run here`);
    else if (o.kind === "cleared") {
      if (!o.found?.length)
        lines.push(`- **${name}:** cleared by ${o.agent}, not a person`);
      else {
        lines.push(`### ${name}: cleared by ${o.agent}, not a person`, "");
        for (const f of o.found)
          lines.push(
            `- \`${f.file}${f.line === undefined ? "" : `:${f.line}`}\` ${f.title}`,
          );
        lines.push("");
      }
    } else lines.push(`- **${name}:** nothing to approve`);
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

/** Each finding that waits, as a check's name and the finding, in an order
 * two runs agree on. */
export const waitingOf = (results: readonly Result[]): string[] =>
  results
    .flatMap((r) =>
      r.outcome.kind === "findings"
        ? r.outcome.findings.map((f) =>
            JSON.stringify([r.name, f.file, f.line ?? null, f.title]),
          )
        : r.outcome.kind === "failed" || r.outcome.kind === "cant-run"
          ? [JSON.stringify([r.name, r.outcome.kind])]
          : [],
    )
    .sort();

/** `status DIR`: posts the status from every check's result, writes the
 * run's summary, and keeps the results for the label's run. An approval
 * kept for this commit stands while nothing waits that it didn't cover. */
export async function status(d: Deps, dir: string): Promise<void> {
  const plan = readJson<Plan>(join(dir, "plan.json"));
  if (plan.done) return;
  const label = d.settings.codeHost.labels["policy-override"];
  const results = resultsOf(dir, plan);
  writeJson(join(dir, "kept", "results.json"), { ...plan, results });
  d.summary(summaryOf(results));
  let s = statusOf(results, { label });
  const approvedFile = join(dir, "approved", "approved.json");
  if (s.state === "pending" && existsSync(approvedFile)) {
    const approved = readJson<{ by: string; waiting: string[] }>(approvedFile);
    const covered = new Set(approved.waiting);
    if (waitingOf(results).every((w) => covered.has(w)))
      s = {
        state: "success",
        description: `Approved by @${approved.by} at ${plan.head.slice(0, 7)}`,
      };
  }
  if (s.state === "pending") await d.codeHost.ensureLabel(label, LABEL_LOOK);
  await d.codeHost.setStatus(plan.head, {
    state: s.state,
    name: CONTEXT,
    description: s.description,
    link: d.runner.thisRun(d.env)?.page,
  });
}

/** `approve DIR`: on the label being added, approves what was waiting on
 * the commit the label's event names, when someone who can write added it
 * and that commit is still the head. On an approving review while a policy
 * waits, says once that the label accepts it. */
export async function approve(d: Deps, dir: string): Promise<void> {
  const event = eventOf(d);
  const pr = event.pull_request!.number;
  const label = d.settings.codeHost.labels["policy-override"];
  if (event.review !== undefined) {
    if (event.review.state !== "approved") return;
    const pull = await d.codeHost.get(pr);
    const pending = (await d.codeHost.statuses(pull.head.sha)).some(
      (s) => s.name === CONTEXT && s.state === "pending",
    );
    if (!pending) return;
    const said = (await d.codeHost.comments(pr)).some((c) =>
      c.body.startsWith(REVIEW_NOTE),
    );
    if (!said)
      await d.codeHost.comment(
        pr,
        `${REVIEW_NOTE}\nYour review counts as usual, and **${CONTEXT}** still waits: to accept what it found, add the \`${label}\` label.`,
      );
    return;
  }
  if (event.action !== "labeled" || event.label?.name !== label) return;
  const pull = await d.codeHost.get(pr);
  const seen = event.pull_request!.head?.sha ?? "";
  const by = await d.codeHost.labeledBy(pr, label);
  const refuse = async (why: string) => {
    await d.codeHost.removeLabel(pr, label);
    await d.codeHost.comment(pr, `Removed \`${label}\`: ${why}`);
  };
  if (by === null || !(await d.codeHost.canWrite(by)))
    return refuse(
      `only someone who can write to this repository may accept what an approval policy found.`,
    );
  if (seen !== pull.head.sha)
    return refuse(
      `a newer commit, ${pull.head.sha.slice(0, 7)}, is unread. Add it again once its checks have run.`,
    );
  const base = event.pull_request!.base?.ref ?? "";
  if (base !== pull.base.branch)
    return refuse(
      `the base is now ${pull.base.branch}, and the change against it is unread. Add it again once its checks have run.`,
    );
  const keptFile = join(dir, "kept", "results.json");
  if (!existsSync(keptFile))
    return refuse(
      `the checks of ${seen.slice(0, 7)} haven't finished. Add it again once they have.`,
    );
  const kept = readJson<Plan & { results: Result[] }>(keptFile);
  writeJson(join(dir, "approved", "approved.json"), {
    by,
    head: seen,
    waiting: waitingOf(kept.results),
  });
  d.output(`approved=${approvedName(pr, seen, base)}`);
  await d.codeHost.setStatus(seen, {
    state: "success",
    name: CONTEXT,
    description: `Approved by @${by} at ${seen.slice(0, 7)}`,
    link: d.runner.thisRun(d.env)?.page,
  });
  const listed = kept.results.flatMap(({ name, outcome: o }) =>
    o.kind === "findings"
      ? o.findings.map(
          (f) =>
            `- **${name}:** \`${f.file}${f.line === undefined ? "" : `:${f.line}`}\` ${f.title}`,
        )
      : o.kind === "failed" || o.kind === "cant-run"
        ? [
            `- **${name}:** everything it applies to, since its check couldn't answer`,
          ]
        : [],
  );
  await d.codeHost.comment(
    pr,
    [
      `**Approved by @${by}** at ${seen.slice(0, 7)}, as the approval policies stood on the default branch:`,
      "",
      ...(listed.length ? listed : ["- Nothing was waiting."]),
    ].join("\n"),
  );
}

/** `kept NAME`, or `kept --event findings`: the trusted run that kept the
 * artifact, for the workflow to download it from, or nothing. With
 * `--event`, the name is the findings' for the commit the event names. */
export async function kept(
  d: Pick<Deps, "runner" | "output" | "env">,
  argv: string[],
) {
  let name = argv[0]!;
  if (name === "--event") {
    const event = eventOf(d);
    name = keptName(
      event.pull_request!.number,
      event.pull_request!.head?.sha ?? "",
      event.pull_request!.base?.ref ?? "",
    );
    d.output(`name=${name}`);
  }
  const run = await d.runner.keptBy(name, WORKFLOW_FILE);
  d.output(`run=${run ?? ""}`);
}

export type CheckDeps = {
  settings: Settings;
  git: Git;
  defaultBranch: () => Promise<string>;
  /** The pull request N, for `--pull`. */
  pull: (n: number) => Promise<{ body: string; head: string; base: string }>;
  tickets: Pick<Tickets, "linksIn" | "read" | "key">;
  runCommand: Deps["runCommand"];
  runAgent: Deps["runAgent"];
  out: say.Out;
  err: say.Out;
};

/** The ticket the branch is named for, by the settings' branch name, or
 * null. */
function branchTicket(d: CheckDeps): string | null {
  const pattern = d.settings.codeHost.branchName;
  const branch = d.git(["branch", "--show-current"]).out.trim();
  if (!pattern || !branch || !pattern.includes("{ticket}")) return null;
  const re = new RegExp(
    `^${pattern
      .split(/(\{ticket\}|\{user\})/)
      .map((p) =>
        p === "{ticket}"
          ? "(?<ticket>[\\w-]+)"
          : p === "{user}"
            ? "[^/]+"
            : p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      )
      .join("")}$`,
  );
  return re.exec(branch)?.groups?.ticket ?? null;
}

/** `check [--pull N]`: what the change would wait for, run on this machine
 * from the working folder's policies, posting nothing. */
export async function check(d: CheckDeps, argv: string[]): Promise<number> {
  const at = argv.indexOf("--pull");
  const pull = at === -1 ? null : Number(argv[at + 1]);
  if (pull !== null && !(Number.isInteger(pull) && pull > 0)) {
    d.err(say.text("Usage: lunamill approval-policies check [--pull N]"));
    return 2;
  }
  const policies: ApprovalPolicy[] = d.settings.approvalPolicies;
  let base: string;
  let head: string | null;
  let since: string;
  let ticket: Input["ticket"] = null;
  if (pull === null) {
    const branch = await d.defaultBranch();
    since = `changed since origin/${branch}`;
    base = d.git(["merge-base", "HEAD", `origin/${branch}`]).out.trim();
    head = null;
    const key = branchTicket(d);
    if (key !== null)
      try {
        ticket = {
          id: key,
          text: (await d.tickets.read(d.tickets.key(key))).body,
        };
      } catch {
        ticket = null;
      }
  } else {
    const p = await d.pull(pull);
    since = `#${pull} changed`;
    d.git([
      "fetch",
      "--no-tags",
      "--quiet",
      "origin",
      `refs/pull/${pull}/head`,
      `+refs/heads/${p.base}:refs/remotes/origin/${p.base}`,
    ]);
    head = p.head;
    base = d.git(["merge-base", `origin/${p.base}`, p.head]).out.trim();
    ticket = await ticketOf(
      { tickets: d.tickets, settings: d.settings },
      p.body,
    );
  }
  const files = base ? changedFiles(d.git, base, head) : null;
  if (files === null) {
    d.err(say.mark("fail", UNREADABLE));
    return 1;
  }
  const checks = checksOf(policies, files);
  if (!checks.length) {
    d.out(say.mark("off", "No approval policy applies to this change"));
    return 0;
  }
  const n = new Set(checks.map((c) => c.policy.name)).size;
  d.out(
    say.text(
      `approval-policies: ${n} appl${n === 1 ? "ies" : "y"}, for the ${files.length} file${files.length === 1 ? "" : "s"} ${since}`,
    ),
  );
  let failed = false;
  for (const c of checks) {
    const name = checkName(c);
    const diff = diffOf(d.git, base, head, c.files);
    if (diff === null) {
      d.err(say.mark("fail", UNREADABLE));
      return 1;
    }
    const input: Input = {
      version: 1,
      repository: d.settings.repository,
      pull,
      base,
      head: head ?? d.git(["rev-parse", "HEAD"]).out.trim(),
      files: c.files,
      diff,
      in: c.folder,
      ticket,
    };
    let outcome: Outcome = { kind: "nothing" };
    if (c.policy.run !== null)
      outcome = outcomeOf(
        c.policy.run,
        await d.runCommand(c.policy.run, input),
      );
    if (
      c.policy.agent !== null &&
      (c.policy.run === null || outcome.kind === "findings")
    ) {
      const found = outcome.kind === "findings" ? outcome.findings : null;
      outcome = agentOutcome(
        c.policy.agent,
        await d.runAgent(
          c.policy.agent,
          found ? onlyFound(input, found) : input,
          found,
        ),
        found,
      );
    }
    if (outcome.kind === "failed") {
      failed = true;
      d.err(
        say.mark(
          "fail",
          `${name}: ${outcome.command} failed (${outcome.why}). Fix it, then run: lunamill approval-policies check`,
        ),
      );
      for (const line of outcome.stderr.split("\n").filter(Boolean))
        d.err(say.verbatim(`  ${line}`));
    } else if (outcome.kind === "findings") {
      d.out(
        say.mark(
          "look",
          `${name}: ${outcome.findings.length} waiting for approval`,
        ),
      );
      for (const f of outcome.findings)
        d.out(
          say.verbatim(
            `  ${f.file}${f.line === undefined ? "" : `:${f.line}`}  ${f.title}`,
          ),
        );
    } else if (outcome.kind === "cleared")
      d.out(
        say.mark("ok", `${name}: cleared by ${outcome.agent}, not a person`),
      );
    else d.out(say.mark("ok", `${name}: nothing to approve`));
  }
  return failed ? 1 : 0;
}

export type { ChangedFile };

const USAGE =
  "Usage: lunamill approval-policies check [--pull N] | prepare DIR | commands DIR | agent DIR I | status DIR | kept NAME | approve DIR";

// Only run as a CLI. Importing this module for tests must not call GitHub.
/** `lunamill approval-policies SUB`. */
export async function run(argv: string[]): Promise<number> {
  const [sub, ...rest] = argv;
  const { appendFileSync } = await import("node:fs");
  const { loadSettings, defaultDeps, repoRoot } = await import("./config.mts");
  const { openCodeHost } = await import("./code-host/index.mts");
  const { openRunner } = await import("./runner/index.mts");
  const { openTickets } = await import("./tickets/index.mts");
  const { gitIn, branchDeps, needDefaultBranch } =
    await import("./lib/default-branch.mts");
  const { runCommand } = await import("./approval-policies.mts");
  const { runAgent } = await import("./approval-agent.mts");
  const root = repoRoot();
  const printers = say.printersFor(`approval-policies ${sub ?? ""}`);
  try {
    const settings = await loadSettings(defaultDeps(root));
    const { tickets } = await openTickets(settings, {
      repository: settings.repository,
      board: null,
    });
    const git = gitIn(root);
    const commandIn = (command: string, input: Input) =>
      runCommand(command, input, { cwd: root });
    const agentIn: Deps["runAgent"] = (name, input, found) =>
      runAgent(name, input, found, { cwd: root });
    if (sub === "check") {
      const host = openCodeHost(settings.repository, settings.codeHost.type);
      return await check(
        {
          settings,
          git,
          defaultBranch: () => needDefaultBranch(branchDeps(root)),
          pull: async (n) => {
            const p = await host.get(n);
            return { body: p.body, head: p.head.sha, base: p.base.branch };
          },
          tickets,
          runCommand: commandIn,
          runAgent: agentIn,
          ...printers,
        },
        rest,
      );
    }
    const dir = rest[0];
    if (!sub || !dir) throw new Error(USAGE);
    const d: Deps = {
      settings,
      codeHost: openCodeHost(settings.repository, settings.codeHost.type),
      tickets,
      runner: openRunner(settings.repository),
      git,
      env: process.env,
      root,
      runCommand: commandIn,
      runAgent: agentIn,
      output: (line) =>
        process.env.GITHUB_OUTPUT
          ? appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`)
          : say.plain(line),
      summary: (markdown) =>
        process.env.GITHUB_STEP_SUMMARY
          ? appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown)
          : say.plain(markdown),
      ...printers,
    };
    if (sub === "prepare") await prepare(d, dir);
    else if (sub === "commands") await commands(d, dir);
    else if (sub === "agent") await agent(d, dir, Number(rest[1]));
    else if (sub === "status") await status(d, dir);
    else if (sub === "kept") await kept(d, rest);
    else if (sub === "approve") await approve(d, dir);
    else throw new Error(USAGE);
    return 0;
  } catch (error) {
    say.plainError(error instanceof Error ? error.message : String(error));
    return 1;
  }
}
