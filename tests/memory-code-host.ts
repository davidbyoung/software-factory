// A second code host, kept in memory, that the commands' tests run against.
// It fills the same interface as GitHub's (`src/code-host/`), so a command
// that works here works on any code host that keeps the interface. A test
// that needs `fake-gh` for a pull request is a sign the command went around
// the interface.
import type {
  ChangedFile,
  CheckRun,
  CodeHost,
  CommitStatus,
  Pull,
  PullComment,
  Review,
  Thread,
} from "../src/code-host/types.mts";
import { NeedsScopeError } from "../src/code-host/types.mts";
import type { PullRequest } from "../src/lib/work-status.mts";
import { NotFoundError } from "../src/tickets/types.mts";

export const REPOSITORY = "acme/widgets";

/** A pull request and what hangs off it. Anything left out is the plainest
 * value: open, ready, clean, by the owner, with nothing on it. */
export type PullSeed = Partial<Pull> & {
  number: number;
  /** The conversation comments. */
  comments?: PullComment[];
  /** Each review with the comments it left on lines. */
  reviews?: (Review & { comments?: PullComment[] })[];
  threads?: Thread[];
  files?: ChangedFile[];
  /** What `unverifiedCommits` answers. */
  unverified?: string[];
  /** The tickets the code host links it to closing, by key. */
  closes?: string[];
  /** The state of its checks, as the views read it. */
  checks?: string | null;
};

type Stored = Required<Omit<PullSeed, keyof Pull>> & Required<Pull>;

export type MemoryCodeHostOptions = {
  defaultBranch?: string;
  /** Whether the repository is private; public unless given. */
  isPrivate?: boolean;
  /** Whether an organization owns the repository; a person unless given. */
  ownerIsOrganization?: boolean;
  /** The check runs and statuses on each commit. */
  commits?: Record<
    string,
    { checkRuns?: CheckRun[]; statuses?: CommitStatus[] }
  >;
  /** The merge base of `base...head`; the base itself unless given. */
  mergeBases?: Record<string, string>;
  /** What each operation fails with, to test a command's failure path. */
  fail?: Partial<Record<keyof CodeHost, Error>>;
  /** Every operation called, in order, as its name and arguments. Shared
   * with the in-memory runner when a test reads the order across both. */
  log?: string[];
  owner?: string;
  /** The accounts that can write to the repository, in any case; only the
   * owner unless given. */
  writers?: string[];
  /** Each token the code host knows: whose it is and its scopes. */
  tokens?: Record<string, { account: string; scopes: string[] | null }>;
  /** Whether adding a signing key first needs the sign-in's permission,
   * which `grantScope` then gives. */
  signingNeedsScope?: boolean;
  /** Why requiring a check fails, as for a plan without rulesets. */
  rulesRefused?: string;
  /** When a comment is posted, for its createdAt. */
  now?: () => string;
};

export function memoryCodeHost(
  seed: PullSeed[] = [],
  options: MemoryCodeHostOptions = {},
) {
  const owner = options.owner ?? "acme";
  const now = options.now ?? (() => "2026-11-09T12:59:00Z");
  const fail = options.fail ?? {};
  const log = options.log ?? [];
  let nextId = 5000;
  const settings = {
    autoMerge: false,
    rules: [] as { name: string; check: string }[],
    signingKeys: [] as { title: string; key: string }[],
    signingNeedsScope: options.signingNeedsScope ?? false,
  };
  const pulls = new Map<number, Stored>();
  for (const p of seed)
    pulls.set(p.number, {
      title: `Pull request ${p.number}`,
      state: "open",
      merged: false,
      isDraft: false,
      body: "",
      mergeableState: "clean",
      author: owner,
      createdAt: "2026-11-09T12:00:00Z",
      autoMerge: false,
      files: [],
      unverified: [],
      closes: [],
      checks: null,
      ...p,
      // Copied, so one test's writes never reach a seed another test shares.
      labels: [...(p.labels ?? [])],
      head: {
        sha: `head${p.number}`,
        branch: `branch-${p.number}`,
        repository: REPOSITORY,
        ...p.head,
      },
      base: {
        sha: "base",
        branch: options.defaultBranch ?? "main",
        repository: REPOSITORY,
        ...p.base,
      },
      comments: (p.comments ?? []).map((c) => ({ ...c })),
      reviews: (p.reviews ?? []).map((r) => ({ ...r })),
      threads: (p.threads ?? []).map((t) => ({
        ...t,
        comments: t.comments.map((c) => ({ ...c })),
      })),
    });
  const commits = new Map(
    Object.entries(options.commits ?? {}).map(([sha, c]) => [
      sha,
      { checkRuns: c.checkRuns ?? [], statuses: c.statuses ?? [] },
    ]),
  );

  /** Records the call, and fails it when the test asked for that. */
  const called = (op: keyof CodeHost, ...args: unknown[]) => {
    log.push([op, ...args].join(" "));
    const error = fail[op];
    if (error) throw error;
  };
  const get = (n: number) => {
    const p = pulls.get(n);
    if (!p) throw new NotFoundError(`pull request #${n}`);
    return p;
  };
  const toPull = (p: Stored): Required<Pull> => ({
    number: p.number,
    title: p.title,
    state: p.state,
    merged: p.merged,
    isDraft: p.isDraft,
    body: p.body,
    mergeableState: p.mergeableState,
    author: p.author,
    labels: [...p.labels],
    head: { ...p.head },
    base: { ...p.base },
    createdAt: p.createdAt,
    autoMerge: p.autoMerge,
  });
  const findComment = (id: number): PullComment => {
    for (const p of pulls.values()) {
      const found = p.comments.find((c) => c.id === id);
      if (found) return found;
    }
    throw new NotFoundError(`comment ${id}`);
  };
  const commit = (sha: string) => {
    if (!commits.has(sha)) commits.set(sha, { checkRuns: [], statuses: [] });
    return commits.get(sha)!;
  };
  const threadHolding = (n: number, commentId: number) => {
    const thread = get(n).threads.find((t) =>
      t.comments.some((c) => c.id === commentId),
    );
    if (!thread)
      throw new Error(`No review thread on #${n} holds comment ${commentId}.`);
    return thread;
  };
  const toView = (p: Stored, withComments: boolean): PullRequest => ({
    number: p.number,
    createdAt: p.createdAt,
    body: p.body,
    closes: [...p.closes],
    partOf: [],
    isDraft: p.isDraft,
    checks: p.checks,
    openThreads: p.threads.filter((t) => !t.isResolved).length,
    author: p.author,
    comments: withComments
      ? p.comments.map(({ id, author, createdAt, body }) => ({
          id: String(id),
          author,
          createdAt,
          body,
        }))
      : [],
  });

  const codeHost: CodeHost = {
    async get(n) {
      called("get", n);
      return toPull(get(n));
    },
    // A list does not work out whether each one merges, on GitHub or here:
    // a command reads that with `get`.
    async listOpen() {
      called("listOpen");
      return [...pulls.values()]
        .filter((p) => p.state === "open")
        .map((p) => ({ ...toPull(p), mergeableState: "unknown" }));
    },
    async forBranch(branch) {
      called("forBranch", branch);
      const found = [...pulls.values()].find(
        (p) => p.state === "open" && p.head.branch === branch,
      );
      return found?.number ?? null;
    },
    async lastForBranch(branch) {
      called("lastForBranch", branch);
      const newest = [...pulls.values()]
        .filter((p) => p.head.branch === branch)
        .sort((a, b) => b.number - a.number)[0];
      if (!newest) return null;
      return {
        number: newest.number,
        state:
          newest.state === "open"
            ? "open"
            : newest.merged
              ? "merged"
              : "closed",
      };
    },
    async forCommit(sha) {
      called("forCommit", sha);
      return [...pulls.values()]
        .filter((p) => p.head.sha === sha)
        .map(({ number, state }) => ({ number, state }));
    },
    async files(n) {
      called("files", n);
      return get(n).files.map((f) => ({ ...f }));
    },
    async mergeBase(base, head) {
      called("mergeBase", base, head);
      return options.mergeBases?.[`${base}...${head}`] ?? base;
    },
    async defaultBranch() {
      called("defaultBranch");
      return options.defaultBranch ?? "main";
    },
    async isPrivate() {
      called("isPrivate");
      return options.isPrivate ?? false;
    },
    async ownerIsOrganization() {
      called("ownerIsOrganization");
      return options.ownerIsOrganization ?? false;
    },
    async canWrite(login) {
      called("canWrite", login);
      const writers = options.writers ?? [owner];
      return writers.some((w) => w.toLowerCase() === login.toLowerCase());
    },
    async checkRuns(sha) {
      called("checkRuns", sha);
      return commit(sha).checkRuns.map((c) => ({ ...c }));
    },
    async statuses(sha) {
      called("statuses", sha);
      return commit(sha).statuses.map((s) => ({ ...s }));
    },
    async setStatus(sha, status) {
      called("setStatus", sha, status.name);
      const { statuses } = commit(sha);
      const set = {
        id: nextId++,
        name: status.name,
        state: status.state,
        link: status.link,
      };
      const at = statuses.findIndex((s) => s.name === status.name);
      if (at === -1) statuses.push(set);
      else statuses[at] = set;
    },
    async comments(n) {
      called("comments", n);
      return get(n).comments.map((c) => ({ ...c }));
    },
    async commentView(id) {
      called("commentView", id);
      return { ...findComment(id) };
    },
    async comment(n, body) {
      called("comment", n);
      const id = nextId++;
      get(n).comments.push({ id, author: owner, body, createdAt: now() });
      return id;
    },
    async editComment(id, body) {
      called("editComment", id);
      findComment(id).body = body;
    },
    async addLabel(n, label) {
      called("addLabel", n, label);
      const p = get(n);
      if (!p.labels.includes(label)) p.labels.push(label);
    },
    async removeLabel(n, label) {
      called("removeLabel", n, label);
      const p = get(n);
      if (!p.labels.includes(label))
        throw new NotFoundError(`the ${label} label on #${n}`);
      p.labels = p.labels.filter((l) => l !== label);
    },
    async reviews(n) {
      called("reviews", n);
      return get(n).reviews.map(({ id, author, body, submittedAt }) => ({
        id,
        author,
        body,
        submittedAt,
      }));
    },
    async reviewCommentsOf(n, reviewId) {
      called("reviewCommentsOf", n, reviewId);
      const review = get(n).reviews.find((r) => r.id === reviewId);
      return (review?.comments ?? []).map((c) => ({ ...c }));
    },
    async reviewComments(n) {
      called("reviewComments", n);
      return get(n).reviews.flatMap((r) =>
        (r.comments ?? []).map((c) => ({ ...c })),
      );
    },
    async threads(n) {
      called("threads", n);
      return get(n).threads.map((t) => ({
        ...t,
        comments: t.comments.map((c) => ({ ...c })),
      }));
    },
    async openThreadCount(n) {
      called("openThreadCount", n);
      return get(n).threads.filter((t) => !t.isResolved).length;
    },
    async reply(n, commentId, body) {
      called("reply", n, commentId);
      const id = nextId++;
      threadHolding(n, commentId).comments.push({ id, author: owner, body });
      return id;
    },
    async resolve(n, commentId) {
      called("resolve", n, commentId);
      threadHolding(n, commentId).isResolved = true;
    },
    async create(pull) {
      called("create", pull.head, pull.base);
      const number = Math.max(0, ...pulls.keys()) + 1;
      pulls.set(number, {
        number,
        title: pull.title,
        state: "open",
        merged: false,
        isDraft: pull.draft,
        body: pull.body,
        mergeableState: "clean",
        author: owner,
        createdAt: now(),
        autoMerge: false,
        labels: [],
        head: {
          sha: `head${number}`,
          branch: pull.head,
          repository: REPOSITORY,
        },
        base: { sha: "base", branch: pull.base, repository: REPOSITORY },
        comments: [],
        reviews: [],
        threads: [],
        files: [],
        unverified: [],
        closes: [],
        checks: null,
      });
      return number;
    },
    async setBody(n, body) {
      called("setBody", n);
      get(n).body = body;
    },
    async ready(n) {
      called("ready", n);
      get(n).isDraft = false;
    },
    async unverifiedCommits(n) {
      called("unverifiedCommits", n);
      return [...get(n).unverified];
    },
    async closes(n) {
      called("closes", n);
      return [...get(n).closes];
    },
    async open(asked = {}) {
      called("open");
      return [...pulls.values()]
        .filter((p) => p.state === "open")
        .map((p) => ({
          ...toView(p, asked.costs ?? false),
          checks: asked.checks ? p.checks : null,
        }));
    },
    async linking(skip = []) {
      called("linking");
      return [...pulls.values()]
        .filter((p) => p.closes.length > 0 && !skip.includes(p.number))
        .map((p) => toView(p, true));
    },
    address: (n) => `https://code.example/pull/${n}`,

    async signedInAs() {
      called("signedInAs");
      return owner;
    },
    async tokenOwner(token) {
      called("tokenOwner");
      const known = options.tokens?.[token];
      if (!known) throw new Error("The code host refused the token.");
      return { ...known, scopes: known.scopes && [...known.scopes] };
    },
    scopesFor: (needs) => [...needs],
    newTokenPage: (scopes, note) =>
      `https://code.example/tokens/new?scopes=${scopes.join(",")}&note=${note}`,
    reviewAppPage: () => "https://code.example/apps/review",
    async allowAutoMerge() {
      called("allowAutoMerge");
      settings.autoMerge = true;
    },
    async requireCheck(rule, check) {
      called("requireCheck", rule, check);
      if (options.rulesRefused) throw new Error(options.rulesRefused);
      if (!settings.rules.some((r) => r.name === rule))
        settings.rules.push({ name: rule, check });
    },
    async addSigningKey(title, key) {
      called("addSigningKey", title);
      if (settings.signingNeedsScope)
        throw new NeedsScopeError("signing", ["grant", "signing"]);
      settings.signingKeys.push({ title, key });
    },
  };

  return {
    codeHost,
    /** Every operation called, in order. */
    log,
    /** The pull request as it stands, for assertions. */
    pull: (n: number) => get(n),
    /** Changes a pull request, as time passing on the code host would. */
    change(n: number, to: Partial<Stored>) {
      Object.assign(get(n), to);
    },
    /** The check runs and statuses on a commit, as they stand. */
    commit,
    /** The repository's settings as they stand: auto-merge, rules, and the
     * account's signing keys. */
    settings,
    /** Gives the sign-in the permission a signing key needs. */
    grantScope() {
      settings.signingNeedsScope = false;
    },
  };
}
