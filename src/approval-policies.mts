// Approval policies: which of them a change sets off, what each check is
// handed and how it runs, what it answered, and what the "Approval
// policies" status says of all of them. Nothing here reads GitHub: the
// job and `kodor approval-policies check` hand it the change.
import { spawn } from "node:child_process";
import type { ApprovalPolicy, Command } from "./config.mts";
import { matchesAny } from "./lib/glob.mts";
import { foldersOf, patternsIn } from "./lib/paths.mts";
import type { ChangedFile } from "./merge-policy.mts";

/** The status's name on a pull request. */
export const CONTEXT = "Approval policies";

/** How `policy-override` looks where kodor makes it. */
export const LABEL_LOOK = {
  color: "b60205",
  description:
    "Accepts what an approval policy found on the current commit; a push removes it",
};

/** How long a check may take before it counts as failed. */
export const CHECK_MINUTES = 30;

/** GitHub cuts a status's description at this many characters. */
export const DESCRIPTION_LIMIT = 140;

/** One policy as it runs once: in one folder of its `in`, or for the whole
 * repository, with the changed files that set it off there. */
export type Check = {
  policy: ApprovalPolicy;
  folder: string | null;
  files: ChangedFile[];
};

/** How a check is named in what it found: `migrations in services/orders`. */
export const checkName = (c: Pick<Check, "policy" | "folder">) =>
  c.folder === null ? c.policy.name : `${c.policy.name} in ${c.folder}`;

const asCommand = (p: ApprovalPolicy): Command => ({
  run: p.run ?? "",
  in: p.in,
  files: p.files,
  report: null,
});

/** The paths a changed file is known by: a renamed one by both names. */
const pathsOf = (f: ChangedFile) =>
  [f.filename, f.previous_filename].filter((p): p is string => Boolean(p));

/** Each policy a change sets off, once for each folder of its `in` that
 * the change touches. A `*` in `in` stands for each folder the changed
 * files are in, so a folder only the change adds counts. */
export function checksOf(
  policies: readonly ApprovalPolicy[],
  files: readonly ChangedFile[],
): Check[] {
  const paths = files.flatMap(pathsOf);
  return policies.flatMap((policy) => {
    const folders =
      policy.in === null ? [null] : foldersOf(policy.in, paths, () => true);
    return folders.flatMap((folder): Check[] => {
      const patterns = patternsIn(asCommand(policy), folder);
      const matched = files.filter((f) =>
        pathsOf(f).some((p) => matchesAny(p, patterns)),
      );
      return matched.length ? [{ policy, folder, files: matched }] : [];
    });
  });
}

/** Runs git in a checkout; `ok` is whether it exited 0. */
export type Git = (args: string[]) => { ok: boolean; out: string };

const STATUS: Record<string, string> = {
  A: "added",
  M: "modified",
  D: "removed",
  R: "renamed",
  C: "copied",
  T: "changed",
};

/** The files that differ between `base` and `head`, a commit, or the
 * working folder when `head` is null, with untracked files as added. Null
 * when git can't compare them. */
export function changedFiles(
  git: Git,
  base: string,
  head: string | null,
): ChangedFile[] | null {
  // NUL-separated, so a name git would quote, such as one with an accent,
  // reads as it is and matches the patterns it should.
  const diff = git([
    "diff",
    "--name-status",
    "-M",
    "-z",
    base,
    ...(head ? [head] : []),
  ]);
  if (!diff.ok) return null;
  const fields = diff.out.split("\0");
  const files: ChangedFile[] = [];
  for (let i = 0; i + 1 < fields.length;) {
    const code = fields[i++]!;
    const status = STATUS[code[0] ?? ""] ?? "changed";
    if (code.startsWith("R") || code.startsWith("C")) {
      const from = fields[i++]!;
      files.push({ filename: fields[i++]!, previous_filename: from, status });
    } else files.push({ filename: fields[i++]!, status });
  }
  if (head === null) {
    const added = git(["ls-files", "--others", "--exclude-standard", "-z"]);
    if (!added.ok) return null;
    for (const path of added.out.split("\0").filter(Boolean))
      files.push({ filename: path, status: "added" });
  }
  return files;
}

/** The unified diff of `files` between `base` and `head`, or the working
 * folder when `head` is null, an untracked file shown as all added. */
export function diffOf(
  git: Git,
  base: string,
  head: string | null,
  files: readonly ChangedFile[],
): string | null {
  const tracked = files.filter((f) => f.status !== "added" || head !== null);
  const parts: string[] = [];
  const paths = [...new Set(tracked.flatMap(pathsOf))];
  if (paths.length) {
    const d = git([
      "diff",
      "-M",
      base,
      ...(head ? [head] : []),
      "--",
      ...paths,
    ]);
    if (!d.ok) return null;
    parts.push(d.out);
  }
  if (head === null)
    for (const f of files.filter((f) => f.status === "added")) {
      // An untracked file has no diff in git's index: shown against nothing.
      const d = git(["diff", "--no-index", "--", "/dev/null", f.filename]);
      if (d.out) parts.push(d.out);
    }
  return parts.filter(Boolean).join("\n");
}

/** What a check reads on its standard input. */
export type Input = {
  version: 1;
  repository: string;
  pull: number | null;
  base: string;
  head: string;
  files: ChangedFile[];
  diff: string;
  in: string | null;
  ticket: { id: string; text: string } | null;
};

/** One finding of a check's answer. */
export type Finding = {
  file: string;
  title: string;
  line?: number;
  why?: string;
};

/** What became of one check. */
export type Outcome =
  | { kind: "findings"; findings: Finding[] }
  /** The check ran and its answer is no finding. */
  | { kind: "nothing" }
  /** An agent found nothing, or cleared everything its command found. */
  /** `found` is what its command found, which the agent cleared. */
  | { kind: "cleared"; agent: string; found?: Finding[] }
  | { kind: "failed"; why: string; command: string; stderr: string }
  | { kind: "cant-run"; agent: string };

/** A check's answer read from what it printed: the JSON or why it isn't
 * one. */
export function answerOf(
  stdout: string,
): { findings: Finding[] } | { wrong: string } {
  let v: unknown;
  try {
    v = JSON.parse(stdout);
  } catch {
    return { wrong: "its answer isn't JSON" };
  }
  if (
    typeof v !== "object" ||
    v === null ||
    !Array.isArray((v as { findings?: unknown }).findings)
  )
    return { wrong: 'its answer has no "findings" list' };
  const findings: Finding[] = [];
  for (const f of (v as { findings: unknown[] }).findings) {
    const o = (typeof f === "object" && f !== null ? f : {}) as Record<
      string,
      unknown
    >;
    if (typeof o.file !== "string" || typeof o.title !== "string")
      return { wrong: 'a finding has no "file" or "title"' };
    if (o.line !== undefined && !Number.isInteger(o.line))
      return { wrong: "a finding's \"line\" isn't a whole number" };
    if (o.why !== undefined && typeof o.why !== "string")
      return { wrong: "a finding's \"why\" isn't text" };
    findings.push({
      file: o.file,
      title: o.title,
      ...(o.line !== undefined && { line: o.line as number }),
      ...(o.why !== undefined && { why: o.why as string }),
    });
  }
  return { findings };
}

/** The names a credential is kept under, which no check's environment
 * holds: a check reads the change from its input and posts nothing. */
const SECRET = /TOKEN|SECRET|PASSWORD|_KEY$|^GH_|^GITHUB_TOKEN$/i;

/** The environment a check runs with: this one's, less every credential. */
export function checkEnv(
  env: Record<string, string | undefined> = process.env,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter(
      (e): e is [string, string] => e[1] !== undefined && !SECRET.test(e[0]),
    ),
  );
}

/** What running one command gave back. */
export type Ran = {
  status: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

/** Runs a check's command from `cwd`, the root of a checkout of the default
 * branch, with the input on its standard input and no credential in its
 * environment, for at most `timeoutMs`. */
export function runCommand(
  command: string,
  input: Input,
  o: { cwd: string; timeoutMs?: number },
): Promise<Ran> {
  return new Promise((resolve) => {
    const child = spawn("sh", ["-c", command], {
      cwd: o.cwd,
      env: checkEnv(),
      stdio: ["pipe", "pipe", "pipe"],
      // Its own process group, so a timeout stops what it started too.
      detached: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout.on("data", (b: Buffer) => (stdout += String(b)));
    child.stderr.on("data", (b: Buffer) => (stderr += String(b)));
    const timer = setTimeout(
      () => {
        timedOut = true;
        try {
          process.kill(-child.pid!, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      },
      o.timeoutMs ?? CHECK_MINUTES * 60_000,
    );
    child.on("error", (e) => {
      clearTimeout(timer);
      resolve({ status: null, stdout, stderr: e.message, timedOut });
    });
    child.on("close", (status) => {
      clearTimeout(timer);
      resolve({ status, stdout, stderr, timedOut });
    });
    child.stdin.on("error", () => {});
    child.stdin.end(JSON.stringify(input));
  });
}

/** What a command's run comes to: findings, nothing, or a failure. */
export function outcomeOf(command: string, ran: Ran): Outcome {
  const failed = (why: string): Outcome => ({
    kind: "failed",
    why,
    command,
    stderr: ran.stderr.trim(),
  });
  if (ran.timedOut)
    return failed(`it gave no answer in ${CHECK_MINUTES} minutes`);
  if (ran.status !== 0) return failed(`exit ${ran.status ?? 1}`);
  const answer = answerOf(ran.stdout);
  if ("wrong" in answer) return failed(answer.wrong);
  return answer.findings.length
    ? { kind: "findings", findings: answer.findings }
    : { kind: "nothing" };
}

/** What an agent's answer comes to, after its command found `found`: what
 * it reports waits, and its finding nothing is "cleared", never
 * "nothing". */
export function agentOutcome(
  agent: string,
  answer: { findings: Finding[] } | { wrong: string } | { failed: string },
  found: Finding[] | null = null,
): Outcome {
  if ("failed" in answer)
    return { kind: "failed", why: answer.failed, command: agent, stderr: "" };
  if ("wrong" in answer)
    return { kind: "failed", why: answer.wrong, command: agent, stderr: "" };
  return answer.findings.length
    ? { kind: "findings", findings: answer.findings }
    : { kind: "cleared", agent, ...(found?.length && { found }) };
}

/** One check and what became of it. */
export type Result = { name: string; outcome: Outcome };

/** The status's state and words, from every check's result. `label` is
 * `policy-override`'s name, and `unreadable` says git couldn't compare the
 * change, which makes every policy wait. */
export function statusOf(
  results: readonly Result[],
  o: { label: string; unreadable?: boolean },
): { state: "pending" | "success"; description: string } {
  if (o.unreadable)
    return {
      state: "pending",
      description:
        "The change couldn't be read, so every policy waits for approval",
    };
  const accept = (them: boolean) =>
    `To accept ${them ? "them" : "it"}, add the ${o.label} label`;
  const failed = results.find((r) => r.outcome.kind === "failed");
  if (failed)
    return {
      state: "pending",
      description: `${failed.name}: the check failed, so everything it applies to waits for approval`,
    };
  const cant = results.find((r) => r.outcome.kind === "cant-run");
  if (cant && cant.outcome.kind === "cant-run")
    return {
      state: "pending",
      description: `${cant.name}: ${cant.outcome.agent} can't run here, so everything it applies to waits for approval`,
    };
  const waiting = results.filter((r) => r.outcome.kind === "findings");
  if (waiting.length === 1) {
    const w = waiting[0]!;
    const n = w.outcome.kind === "findings" ? w.outcome.findings.length : 0;
    return {
      state: "pending",
      description: `${w.name}: ${n} waiting for approval. ${accept(n > 1)}`,
    };
  }
  if (waiting.length > 1) {
    const named = `${waiting.length} policies waiting for approval: ${waiting.map((w) => w.name).join(", ")}. ${accept(true)}`;
    return {
      state: "pending",
      description:
        named.length <= DESCRIPTION_LIMIT
          ? named
          : `${waiting.length} policies waiting for approval. ${accept(true)}`,
    };
  }
  const cleared = results.find((r) => r.outcome.kind === "cleared");
  if (cleared && cleared.outcome.kind === "cleared")
    return {
      state: "success",
      description: `${cleared.name}: cleared by ${cleared.outcome.agent}, not a person`,
    };
  return { state: "success", description: "Nothing to approve" };
}
