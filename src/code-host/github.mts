// GitHub as the code host: pull requests, reviews, checks, and commit
// statuses. With `src/tickets/` and `src/runner/`, this is the only code
// that calls GitHub: every command reaches a pull request through here.
//
// GitHub serves a pull request's conversation comments and labels from its
// issues API, so those calls are here too, not in the ticket adapter.
import { GhError, type Gh, type GhIn } from "../lib/gh.mts";
import type { IssueComment, PullRequest } from "../lib/work-status.mts";
import { NotFoundError } from "../tickets/types.mts";
import { writeAccess } from "../tickets/github-access.mts";
import {
  statusOf,
  type Fields,
  type Transport,
} from "../tickets/transport.mts";
import { randomBytes } from "node:crypto";
import {
  appName,
  installed,
  listenLocally,
  register,
  waitFor,
  type Clock,
  type Listen,
} from "./github-app.mts";
import { NeedsScopeError, NoRulesError, NotSignedInError } from "./types.mts";
import type {
  ChangedFile,
  CheckRun,
  CodeHost,
  CommitStatus,
  Installation,
  Organization,
  Pull,
  PullComment,
  Review,
  StatusSource,
  Thread,
} from "./types.mts";

// An answer is read field by field, and one short of a field reads as
// that field's empty value: a command that asks for a pull request's state
// does not fail because the answer has no labels.
type RestEnd = {
  sha?: string;
  ref?: string;
  repo?: { full_name?: string } | null;
};

type RestPull = {
  number: number;
  title: string;
  state: string;
  merged?: boolean;
  draft?: boolean;
  body?: string | null;
  /** Absent from a list of pull requests, which does not work it out. */
  mergeable_state?: string;
  user?: { login: string } | null;
  labels?: { name: string }[];
  head?: RestEnd;
  base?: RestEnd;
  created_at?: string;
  auto_merge?: unknown;
};

type RestComment = {
  id: number;
  user?: { login: string } | null;
  body?: string | null;
  created_at: string;
  path?: string;
  line?: number | null;
  in_reply_to_id?: number;
};

type RestCommit = {
  sha: string;
  author?: { login: string } | null;
  committer?: { login: string } | null;
  commit: { verification?: { verified: boolean } };
};

type RestIssueEvent = {
  event: string;
  label?: { name: string };
  actor?: { login: string } | null;
};

type RestReview = {
  id: number;
  user?: { login: string } | null;
  body?: string | null;
  submitted_at: string;
};

type RestCheckRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url?: string;
  check_suite?: { id: number };
  output?: { title: string | null; summary: string | null };
};

/** What a check wrote about its result: its title and its summary. */
const reportOf = (output: RestCheckRun["output"]): string | undefined =>
  [output?.title, output?.summary].filter(Boolean).join("\n") || undefined;

type RestStatus = {
  id: number;
  context: string;
  state: string;
  target_url?: string;
  creator?: { login: string } | null;
};

type RestFile = {
  filename: string;
  previous_filename?: string;
  status: string;
};

const endOf = (end: RestEnd | undefined) => ({
  sha: end?.sha ?? "",
  branch: end?.ref ?? "",
  repository: end?.repo?.full_name ?? null,
});

function pullOf(raw: RestPull): Pull {
  const base = endOf(raw.base);
  return {
    number: raw.number,
    title: raw.title,
    state: raw.state,
    merged: raw.merged ?? false,
    isDraft: raw.draft ?? false,
    body: raw.body ?? "",
    mergeableState: raw.mergeable_state ?? "unknown",
    author: raw.user?.login ?? "ghost",
    labels: (raw.labels ?? []).map((l) => l.name),
    head: endOf(raw.head),
    base: { ...base, repository: base.repository ?? "" },
    createdAt: raw.created_at ?? "",
    autoMerge: (raw.auto_merge ?? null) !== null,
  };
}

const commentOf = (raw: RestComment): PullComment => ({
  id: raw.id,
  author: raw.user?.login ?? "ghost",
  body: raw.body ?? "",
  createdAt: raw.created_at,
  ...(raw.path === undefined ? {} : { path: raw.path, line: raw.line }),
  ...(raw.in_reply_to_id === undefined ? {} : { replyTo: raw.in_reply_to_id }),
});

const reviewOf = (raw: RestReview): Review => ({
  id: raw.id,
  author: raw.user?.login ?? "ghost",
  body: raw.body ?? "",
  submittedAt: raw.submitted_at,
});

/** The most commits of a pull request GitHub lists. */
const MOST_COMMITS = 250;

/** The account GitHub commits as for a change made through it. */
const GITHUB_COMMITTER = "web-flow";

// A signature is the committer's. The author is only what the committer
// wrote, unless they are the same account or GitHub is the committer.
function verifiedAuthor(raw: RestCommit): string | null {
  const author = raw.author?.login;
  const committer = raw.committer?.login;
  if (!author || raw.commit.verification?.verified !== true) return null;
  return committer === author || committer === GITHUB_COMMITTER ? author : null;
}

type GraphThread = {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  comments: {
    nodes: {
      databaseId: number;
      author: { login: string } | null;
      body: string;
    }[];
  };
};

const THREADS_QUERY = `
query ReviewThreads($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      reviewThreads(first: 100) {
        nodes {
          id isResolved isOutdated path line
          comments(first: 50) { nodes { databaseId author { login } body } }
        }
      }
    }
  }
}`;

export function fromGraph(nodes: GraphThread[]): Thread[] {
  return nodes.map((t) => ({
    commentId: t.comments.nodes[0]?.databaseId ?? 0,
    nodeId: t.id,
    isResolved: t.isResolved,
    isOutdated: t.isOutdated,
    path: t.path,
    line: t.line,
    comments: t.comments.nodes.map((c) => ({
      id: c.databaseId,
      author: c.author?.login ?? "ghost",
      body: c.body,
    })),
  }));
}

// The open pull requests, for the views, the sync, and the poller. Only the
// sync asks for their comments ($costs), which it needs for Cost; the
// poller, which reads every minute, and the terminal view do not.
export const OPEN_PULLS_QUERY = `
query OpenPulls(
  $owner: String!
  $name: String!
  $checks: Boolean = false
  $costs: Boolean = false
) {
  repository(owner: $owner, name: $name) {
    pullRequests(states: OPEN, first: 100) {
      nodes {
        ...pull
        reviewThreads(first: 100) { nodes { isResolved } }
        commits(last: 1) @include(if: $checks) {
          nodes { commit { statusCheckRollup { state } } }
        }
      }
    }
  }
}
fragment pull on PullRequest {
  number createdAt body isDraft
  author { login }
  closingIssuesReferences(first: 25) {
    nodes { number repository { nameWithOwner } }
  }
  comments(last: 100) @include(if: $costs) {
    nodes { databaseId createdAt body author { login } }
  }
}`;

// Every pull request, open, merged, or closed and however old, that
// mentioned one of the tickets "Read everything at once" returns: the set
// the sync reads cost markers from. A ticket system other than GitHub's
// could not answer this, so it is asked here, of the pull requests.
export const LINKING_PULLS_QUERY = `
query LinkingPulls($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    open: issues(states: OPEN, first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { ...links }
    }
    closed: issues(states: CLOSED, first: 30, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { ...links }
    }
  }
}
fragment links on Issue {
  builders: timelineItems(itemTypes: [CROSS_REFERENCED_EVENT], last: 20) {
    nodes { ... on CrossReferencedEvent { source { ... on PullRequest {
      number createdAt body isDraft
      author { login }
      closingIssuesReferences(first: 25) {
        nodes { number repository { nameWithOwner } }
      }
      comments(last: 100) {
        nodes { databaseId createdAt body author { login } }
      }
    } } } }
  }
}`;

type RawComments = {
  nodes: {
    databaseId: number;
    createdAt: string;
    body: string;
    author: { login: string } | null;
  }[];
};

export type RawPull = {
  number: number;
  createdAt: string;
  body: string;
  isDraft: boolean;
  author: { login: string } | null;
  closingIssuesReferences: {
    nodes: { number: number; repository: { nameWithOwner: string } }[];
  };
  comments?: RawComments;
  /** Absent on closed and merged pull requests. */
  reviewThreads?: { nodes: { isResolved: boolean }[] };
  /** Present only when the read asked for check state, which needs the
   * checks and statuses permissions the sync's token does not have. */
  commits?: {
    nodes: { commit: { statusCheckRollup: { state: string } | null } }[];
  };
};

export type OpenPullsPage = {
  data: { repository: { pullRequests: { nodes: RawPull[] } } };
};

export type LinkingPage = {
  data: {
    repository: {
      open: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: { builders: { nodes: { source?: Partial<RawPull> }[] } }[];
      };
      closed: {
        nodes: { builders: { nodes: { source?: Partial<RawPull> }[] } }[];
      };
    };
  };
};

const toComments = (raw: RawComments | undefined): IssueComment[] =>
  (raw?.nodes ?? []).map((c) => ({
    id: String(c.databaseId),
    createdAt: c.createdAt,
    body: c.body,
    author: c.author?.login ?? "ghost",
  }));

export function toPull(raw: RawPull, repository: string): PullRequest {
  return {
    number: raw.number,
    createdAt: raw.createdAt,
    body: raw.body,
    isDraft: raw.isDraft,
    author: raw.author?.login ?? "ghost",
    closes: raw.closingIssuesReferences.nodes
      .filter((ref) => ref.repository.nameWithOwner === repository)
      .map((ref) => String(ref.number)),
    partOf: [],
    openThreads: (raw.reviewThreads?.nodes ?? []).filter((t) => !t.isResolved)
      .length,
    checks: raw.commits?.nodes[0]?.commit.statusCheckRollup?.state ?? null,
    comments: toComments(raw.comments),
  };
}

/** The pull requests in every page of LINKING_PULLS_QUERY, less those in
 * `skip`, which the caller already has. */
export function fromLinkingPages(
  pages: LinkingPage[],
  repository: string,
  skip: number[] = [],
): PullRequest[] {
  const done = new Map<number, PullRequest>();
  const issues = [
    ...pages.flatMap((p) => p.data.repository.open.nodes),
    ...(pages[0]?.data.repository.closed.nodes ?? []),
  ];
  for (const issue of issues)
    for (const { source } of issue.builders?.nodes ?? []) {
      // A cross-reference from an issue has no pull request fields.
      if (source?.number === undefined || !source.closingIssuesReferences)
        continue;
      if (skip.includes(source.number)) continue;
      done.set(source.number, toPull(source as RawPull, repository));
    }
  return [...done.values()];
}

const RESOLVE =
  "mutation ResolveThread($id: ID!) { resolveReviewThread(input: {threadId: $id}) { thread { isResolved } } }";
const CLOSING_QUERY = `
query ClosingIssues($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      closingIssuesReferences(first: 25) { nodes { number repository { nameWithOwner } } }
    }
  }
}`;
const OPEN_THREADS_QUERY =
  "query($owner:String!,$name:String!,$n:Int!){repository(owner:$owner,name:$name){pullRequest(number:$n){reviewThreads(first:100){nodes{isResolved}}}}}";

/** Rethrows a 404 as NotFoundError for `what`. */
async function found<T>(what: string, call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (error) {
    if (statusOf(error) === 404) throw new NotFoundError(what);
    throw error;
  }
}

/** One Actions policy: which workflow files it covers, and its rules. */
type EventPolicy = {
  conditions?: {
    workflow_path?: { include: string[]; exclude: string[] };
  } | null;
  rules?: { type: string; parameters?: { allowed_events?: string[] } }[] | null;
};

/** GitHub Actions' own app, whose ID pins a required status to the
 * workflow's token. */
const ACTIONS_APP = 15368;

const requiredStatus = (check: string, source?: StatusSource) => ({
  context: check,
  ...(source === "runner" ? { integration_id: ACTIONS_APP } : {}),
});

// https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue
const CLOSING =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?):?\s+(?:https?:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/(\d+)|([\w.-]+\/[\w.-]+)?#(\d+)|gh-(\d+))/gi;

/** What `CodeHost.closesIn` gives for a text in `repository`: the forms
 * GitHub documents. What it would close with a pull request is GitHub's to
 * say, by `closes`. */
export function githubClosesIn(text: string, repository: string): string[] {
  const found = [...text.matchAll(CLOSING)].map((m) => {
    const of = m[1] ?? m[3];
    const number = m[2] ?? m[4] ?? m[5];
    return !of || of.toLowerCase() === repository.toLowerCase()
      ? `#${number}`
      : `${of}#${number}`;
  });
  return [...new Set(found)];
}

export function githubCodeHost(o: {
  transport: Transport;
  repository: string;
  /** The GitHub CLI, for `gh pr ready`. */
  cli?: Gh;
  /** For asking GitHub about a token other than the transport's. */
  fetch?: typeof fetch;
  /** The token the GitHub CLI is signed in with, or null for nobody. */
  token?: () => string | null;
}): CodeHost {
  const t = o.transport;
  const API = `repos/${o.repository}`;
  const [owner, name] = o.repository.split("/");
  const list = <T,>(path: string) =>
    t.rest<T[]>("GET", path, { paginate: true });

  async function threads(n: number): Promise<Thread[]> {
    const result = await t.graphql<{
      data: {
        repository: {
          pullRequest: { reviewThreads: { nodes: GraphThread[] } };
        };
      };
    }>(THREADS_QUERY, { owner, name, number: n });
    return fromGraph(result.data.repository.pullRequest.reviewThreads.nodes);
  }

  /** A repository's Actions policies, as its list names them: what each
   * holds is on its own page. */
  const policies = async () =>
    (
      await t.rest<{
        policies: { id: number; name: string; enforcement: string }[];
      }>("GET", `${API}/actions/policies?per_page=100`)
    ).policies;

  const branchRules = async (branch: string) => {
    const path = branch.split("/").map(encodeURIComponent).join("%2F");
    return list<{
      type: string;
      parameters?: { required_status_checks?: { context: string }[] };
    }>(`${API}/rules/branches/${path}?per_page=100`).catch((error) => {
      // GitHub refuses the read where the plan has no rules to list.
      if (statusOf(error) === 403 && /upgrade to/i.test(String(error)))
        throw new NoRulesError(
          `${PLANS.free} has no branch rules for a private repository`,
        );
      throw error;
    });
  };

  return {
    get: async (n) =>
      pullOf(
        await found(
          `pull request #${n}`,
          t.rest<RestPull>("GET", `${API}/pulls/${n}`),
        ),
      ),
    async create(pull) {
      const made = await t.rest<{ number: number }>("POST", `${API}/pulls`, {
        fields: pull,
      });
      return made.number;
    },
    async close(pull) {
      await t.rest("PATCH", `${API}/pulls/${pull}`, {
        fields: { state: "closed" },
      });
    },
    // The newest release that is neither a draft nor a prerelease.
    async newestRelease(repository) {
      try {
        const release = await t.rest<{ tag_name: string }>(
          "GET",
          `repos/${repository}/releases/latest`,
        );
        return release.tag_name;
      } catch (error) {
        if (statusOf(error) === 404) return null;
        throw error;
      }
    },
    releasePage: (repository, tag) =>
      `https://github.com/${repository}/releases/tag/${tag}`,
    listOpen: async () =>
      (await list<RestPull>(`${API}/pulls?state=open&per_page=100`)).map(
        pullOf,
      ),
    async forBranch(branch) {
      const open = await t.rest<{ number: number }[]>(
        "GET",
        `${API}/pulls?head=${owner}:${encodeURIComponent(branch)}&state=open`,
      );
      return open[0]?.number ?? null;
    },
    async lastForBranch(branch) {
      const [newest] = await t.rest<
        { number: number; state: string; merged_at: string | null }[]
      >(
        "GET",
        `${API}/pulls?head=${owner}:${encodeURIComponent(branch)}&state=all&sort=created&direction=desc&per_page=1`,
      );
      if (!newest) return null;
      return {
        number: newest.number,
        state:
          newest.state === "open"
            ? "open"
            : newest.merged_at
              ? "merged"
              : "closed",
      };
    },
    forCommit: async (sha) =>
      (
        await t.rest<{ number: number; state: string }[]>(
          "GET",
          `${API}/commits/${sha}/pulls`,
        )
      ).map(({ number, state }) => ({ number, state })),
    files: async (n) =>
      (await list<RestFile>(`${API}/pulls/${n}/files?per_page=100`)).map(
        (f): ChangedFile => ({
          path: f.filename,
          ...(f.previous_filename === undefined
            ? {}
            : { previousPath: f.previous_filename }),
          status: f.status,
        }),
      ),
    async mergeBase(base, head) {
      const compare = await t.rest<{ merge_base_commit: { sha: string } }>(
        "GET",
        `${API}/compare/${base}...${head}`,
      );
      return compare.merge_base_commit.sha;
    },
    async defaultBranch() {
      const repo = await t.rest<{ default_branch: string }>("GET", API);
      return repo.default_branch;
    },
    async isPrivate() {
      const repo = await t.rest<{ private: boolean }>("GET", API);
      return repo.private;
    },
    async ownerIsOrganization() {
      const repo = await t.rest<{ owner: { type: string } }>("GET", API);
      return repo.owner.type === "Organization";
    },
    canWrite: (login) => writeAccess(t, o.repository, login),
    async checkRuns(sha) {
      const answer = await t.rest<{ check_runs: RestCheckRun[] }>(
        "GET",
        `${API}/commits/${sha}/check-runs?per_page=100`,
      );
      return answer.check_runs.map((c): CheckRun => ({
        id: c.id,
        name: c.name,
        status: c.status,
        conclusion: c.conclusion,
        link: c.html_url,
        checksId: c.check_suite?.id,
        report: reportOf(c.output),
      }));
    },
    // Every status set on the commit, newest first: the combined status
    // holds the newest of each name, but not who set it.
    async statuses(sha) {
      const newest = new Map<string, CommitStatus>();
      for (const s of await list<RestStatus>(
        `${API}/commits/${sha}/statuses?per_page=100`,
      ))
        if (!newest.has(s.context))
          newest.set(s.context, {
            id: s.id,
            name: s.context,
            state: s.state,
            link: s.target_url,
            author: s.creator?.login ?? "ghost",
          });
      return [...newest.values()];
    },
    async setStatus(sha, status) {
      await t.rest("POST", `${API}/statuses/${sha}`, {
        fields: {
          state: status.state,
          context: status.name,
          description: status.description,
          ...(status.link === undefined ? {} : { target_url: status.link }),
        },
      });
    },
    comments: async (n) =>
      (await list<RestComment>(`${API}/issues/${n}/comments?per_page=100`)).map(
        commentOf,
      ),
    async comment(n, body) {
      const made = await found(
        `pull request #${n}`,
        t.rest<{ id: number }>("POST", `${API}/issues/${n}/comments`, {
          fields: { body },
        }),
      );
      return made.id;
    },
    commentView: async (id) =>
      commentOf(
        await found(
          `comment ${id}`,
          t.rest<RestComment>("GET", `${API}/issues/comments/${id}`),
        ),
      ),
    async editComment(id, body) {
      await found(
        `comment ${id}`,
        t.rest("PATCH", `${API}/issues/comments/${id}`, { fields: { body } }),
      );
    },
    async ensureLabel(name, { color, description }) {
      try {
        // GitHub ignores capitals here, as it does between two labels.
        await t.rest("GET", `${API}/labels/${encodeURIComponent(name)}`);
      } catch (error) {
        if (statusOf(error) !== 404) throw error;
        await t.rest("POST", `${API}/labels`, {
          fields: { name, color, description },
        });
      }
    },
    async addLabel(n, label) {
      await found(
        `pull request #${n}`,
        t.rest("POST", `${API}/issues/${n}/labels`, {
          fields: { labels: [label] },
        }),
      );
    },
    async removeLabel(n, label) {
      await found(
        `the ${label} label on #${n}`,
        t.rest(
          "DELETE",
          `${API}/issues/${n}/labels/${encodeURIComponent(label)}`,
        ),
      );
    },
    // The REST events, not GraphQL's, whose name for an app's bot is one a
    // person could have.
    async labeledBy(n, label) {
      const last = (
        await list<RestIssueEvent>(`${API}/issues/${n}/events?per_page=100`)
      )
        .filter((e) => /^(un)?labeled$/.test(e.event))
        .filter((e) => e.label?.name === label)
        .at(-1);
      return last?.event === "labeled" ? (last.actor?.login ?? null) : null;
    },
    reviews: async (n) =>
      (await list<RestReview>(`${API}/pulls/${n}/reviews?per_page=100`)).map(
        reviewOf,
      ),
    reviewCommentsOf: async (n, reviewId) =>
      (
        await list<RestComment>(
          `${API}/pulls/${n}/reviews/${reviewId}/comments?per_page=100`,
        )
      ).map(commentOf),
    reviewComments: async (n) =>
      (await list<RestComment>(`${API}/pulls/${n}/comments?per_page=100`)).map(
        commentOf,
      ),
    async setBody(n, body) {
      await t.rest("PATCH", `${API}/pulls/${n}`, { fields: { body } });
    },
    threads,
    async openThreadCount(n) {
      const result = await t.graphql<{
        data: {
          repository: {
            pullRequest: {
              reviewThreads: { nodes: { isResolved: boolean }[] };
            };
          };
        };
      }>(OPEN_THREADS_QUERY, { owner, name, n });
      return result.data.repository.pullRequest.reviewThreads.nodes.filter(
        (x) => !x.isResolved,
      ).length;
    },
    async commentOn(n, at) {
      const placed = async (fields: Fields): Promise<boolean> => {
        try {
          await t.rest("POST", `${API}/pulls/${n}/comments`, {
            fields: { commit_id: at.sha, path: at.path, ...fields },
          });
          return true;
        } catch (error) {
          if (statusOf(error) === 422) return false;
          throw error;
        }
      };
      return (
        (await placed({ line: at.line, side: "RIGHT", body: at.body })) ||
        (await placed({
          subject_type: "file",
          body: `${at.body}\n\n(Line ${at.line}.)`,
        }))
      );
    },
    async reply(n, commentId, body) {
      const made = await t.rest<{ id: number }>(
        "POST",
        `${API}/pulls/${n}/comments/${commentId}/replies`,
        { fields: { body } },
      );
      return made.id;
    },
    async resolve(n, commentId) {
      const thread = (await threads(n)).find((x) =>
        x.comments.some((c) => c.id === commentId),
      );
      if (!thread?.nodeId)
        throw new Error(
          `No review thread on #${n} holds comment ${commentId}.`,
        );
      await t.graphql(RESOLVE, { id: thread.nodeId });
    },
    async ready(n) {
      if (!o.cli) throw new Error("Marking ready needs the GitHub CLI.");
      await o.cli(["pr", "ready", String(n), "--repo", o.repository]);
    },
    // GitHub is asked because a runner's git cannot verify an SSH signature
    // itself.
    async unverifiedCommits(n) {
      const commits = await t.rest<
        {
          sha: string;
          commit: { verification?: { verified: boolean; reason: string } };
        }[]
      >("GET", `${API}/pulls/${n}/commits?per_page=100`);
      return commits
        .filter((c) => c.commit.verification?.verified !== true)
        .map(
          (c) =>
            `${c.sha.slice(0, 7)} ${c.commit.verification?.reason ?? "unknown"}`,
        );
    },
    async commits(n) {
      const commits = await list<RestCommit>(
        `${API}/pulls/${n}/commits?per_page=100`,
      );
      if (commits.length >= MOST_COMMITS)
        throw new Error(
          `GitHub lists at most ${MOST_COMMITS} commits of #${n}, so there may be more.`,
        );
      return commits.map((c) => ({
        sha: c.sha,
        verifiedAuthor: verifiedAuthor(c),
      }));
    },
    async closes(n) {
      const result = await t.graphql<{
        data: {
          repository: {
            pullRequest: {
              closingIssuesReferences: {
                nodes: {
                  number: number;
                  repository?: { nameWithOwner: string };
                }[];
              };
            };
          };
        };
      }>(CLOSING_QUERY, { owner, name, number: n });
      return result.data.repository.pullRequest.closingIssuesReferences.nodes
        .filter(
          (x) =>
            !x.repository ||
            x.repository.nameWithOwner.toLowerCase() ===
              o.repository.toLowerCase(),
        )
        .map((x) => String(x.number));
    },
    async open(options = {}) {
      const page = await t.graphql<OpenPullsPage>(OPEN_PULLS_QUERY, {
        owner,
        name,
        checks: options.checks ?? false,
        costs: options.costs ?? false,
      });
      return page.data.repository.pullRequests.nodes.map((p) =>
        toPull(p, o.repository),
      );
    },
    async linking(skip = []) {
      const pages: LinkingPage[] = [];
      let after: string | null = null;
      do {
        const page: LinkingPage = await t.graphql<LinkingPage>(
          LINKING_PULLS_QUERY,
          { owner, name, after },
        );
        pages.push(page);
        const info = page.data.repository.open.pageInfo;
        after = info.hasNextPage ? info.endCursor : null;
      } while (after);
      return fromLinkingPages(pages, o.repository, skip);
    },
    closesIn: (text) => githubClosesIn(text, o.repository),
    address: (n) => `https://github.com/${o.repository}/pull/${n}`,
    remote: (repository) => ({
      url: `https://github.com/${repository}.git`,
      host: "github.com",
    }),
    gitToken: () => o.token?.() ?? null,

    async signedInAs() {
      try {
        return (await t.rest<{ login: string }>("GET", "user")).login;
      } catch (e) {
        if (statusOf(e) === 401 || (e instanceof GhError && e.exitCode === 4))
          throw new NotSignedInError();
        throw e;
      }
    },
    async tokenOwner(token) {
      const response = await (o.fetch ?? fetch)("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "software-factory",
        },
      });
      const body = (await response.json().catch(() => ({}))) as {
        login?: string;
        message?: string;
      };
      if (!response.ok || !body.login)
        throw new Error(
          `GitHub refused the token: ${body.message ?? response.statusText}`,
        );
      const scopes = response.headers.get("x-oauth-scopes");
      return {
        account: body.login,
        scopes:
          scopes === null
            ? null
            : scopes
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
      };
    },
    scopesFor: (needs) =>
      needs.map(
        (n) => ({ push: "repo", workflows: "workflow", board: "project" })[n],
      ),
    newTokenPage: (scopes, note) =>
      `https://github.com/settings/tokens/new?scopes=${scopes.join(",")}&description=${encodeURIComponent(note)}`,
    reviewAppPage: () => "https://github.com/apps/claude/installations/new",
    async allowAutoMerge() {
      await t.rest("PATCH", API, { fields: { allow_auto_merge: true } });
    },
    async requireCheck(rule, check, source) {
      const existing = await t.rest<{ name: string }[]>(
        "GET",
        `${API}/rulesets?per_page=100`,
      );
      if (existing.some((r) => r.name === rule)) return;
      await t.rest("POST", `${API}/rulesets`, {
        body: {
          name: rule,
          target: "branch",
          enforcement: "active",
          conditions: {
            ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] },
          },
          rules: [
            {
              type: "required_status_checks",
              parameters: {
                required_status_checks: [requiredStatus(check, source)],
                strict_required_status_checks_policy: false,
              },
            },
          ],
        },
      });
    },
    async jobsMayWrite() {
      const set = await t.rest<{ default_workflow_permissions: string }>(
        "GET",
        `${API}/actions/permissions/workflow`,
      );
      return set.default_workflow_permissions !== "read";
    },
    async eventAllowed(file, event) {
      if ((await t.rest<{ private: boolean }>("GET", API)).private)
        return "open";
      for (const { id, enforcement } of await policies()) {
        if (enforcement !== "active") continue;
        const policy = await t.rest<EventPolicy>(
          "GET",
          `${API}/actions/policies/${id}`,
        );
        const path = policy.conditions?.workflow_path;
        const covers =
          !path ||
          ((path.include.length === 0 ||
            path.include.includes("~ALL") ||
            path.include.includes(file)) &&
            !path.exclude.includes(file));
        const lists = (policy.rules ?? []).some(
          (rule) =>
            rule.type === "restrict_action_events" &&
            rule.parameters?.allowed_events?.includes(event),
        );
        if (covers && lists) return "allowed";
      }
      return "blocked";
    },
    // The rule lets through only the events it lists, so a policy for
    // every workflow would stop the repository's others: it names the file.
    async allowEvents(rule, file, events) {
      const existing = (await policies()).find((p) => p.name === rule);
      await t.rest(
        existing ? "PUT" : "POST",
        `${API}/actions/policies${existing ? `/${existing.id}` : ""}`,
        {
          body: {
            name: rule,
            enforcement: "active",
            conditions: { workflow_path: { include: [file], exclude: [] } },
            rules: [
              {
                type: "restrict_action_events",
                parameters: { allowed_events: events },
              },
            ],
          },
        },
      );
    },
    async requiresStatus(branch, status) {
      return (await branchRules(branch)).some(
        (r) =>
          r.type === "required_status_checks" &&
          r.parameters?.required_status_checks?.some(
            (c) => c.context === status,
          ),
      );
    },
    async secretsWithheldBy() {
      try {
        const repo = await t.rest<{
          private: boolean;
          default_branch: string;
        }>("GET", API);
        if (!repo.private) return null;
        const { plan } = await t.rest<{ plan?: { name: string } }>(
          "GET",
          `orgs/${owner}`,
        );
        if (plan) return plan.name === "free" ? PLANS.free! : null;
        // A member who is no owner may be shown no plan.
        return await branchRules(repo.default_branch).then(
          () => null,
          (e) => (e instanceof NoRulesError ? PLANS.free! : null),
        );
      } catch {
        return null;
      }
    },
    async properties() {
      const values = await t.rest<
        { property_name: string; value: string | string[] | null }[]
      >("GET", `${API}/properties/values`);
      return Object.fromEntries(values.map((v) => [v.property_name, v.value]));
    },
    async ownerDefines(property) {
      try {
        await t.rest(
          "GET",
          `orgs/${owner}/properties/schema/${encodeURIComponent(property)}`,
        );
        return true;
      } catch (error) {
        if (statusOf(error) === 404) return false;
        throw error;
      }
    },
    async setProperty(property, value) {
      await t.rest("PATCH", `${API}/properties/values`, {
        body: { properties: [{ property_name: property, value }] },
      });
    },
    async addSigningKey(title, key) {
      try {
        await t.rest("POST", "user/ssh_signing_keys", {
          fields: { title, key },
        });
      } catch (error) {
        const scope = "admin:ssh_signing_key";
        if (String(error).includes(scope) || statusOf(error) === 404)
          throw new NeedsScopeError(scope, [
            "gh",
            "auth",
            "refresh",
            "-h",
            "github.com",
            "-s",
            scope,
          ]);
        throw error;
      }
    },
  };
}

const SITE = "https://github.com";

const GITHUB_DOMAINS = ["github.com", "githubusercontent.com"];

/** Whether a host is GitHub's, or a wildcard that covers one that is. */
export function namesGitHub(host: string): boolean {
  const name = host.toLowerCase().replace(/^\*\./, "");
  return GITHUB_DOMAINS.some(
    (domain) =>
      `.${name}`.endsWith(`.${domain}`) ||
      (host.startsWith("*.") && domain.endsWith(`.${name}`)),
  );
}

/** Whether an address is on github.com. */
export function githubServes(address: string): boolean {
  try {
    return new URL(address).host === "github.com";
  } catch {
    return false;
  }
}

/** The owner `https://github.com/NAME` names, with or without a last
 * slash, or null for any other address. */
export function githubOwner(address: string): string | null {
  const match = /^https:\/\/github\.com\/([A-Za-z0-9-]+)\/?$/.exec(
    address.trim(),
  );
  return match ? match[1]! : null;
}

/** What GitHub calls each plan. */
const PLANS: Record<string, string> = {
  free: "GitHub Free",
  team: "GitHub Team",
  business: "GitHub Enterprise",
  enterprise: "GitHub Enterprise",
};

/** What the GitHub CLI's sign-in needs to set an organization up: its
 * secrets and rules, its Projects, and a workflow's file. */
const SETUP_SCOPES = ["admin:org", "project", "workflow"];

/** The address GitHub gives an app of that name. */
const appSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** The page that installs an app on the account with that ID. */
const installPage = (slug: string, account: number) =>
  `${SITE}/apps/${slug}/installations/new/permissions?suggested_target_id=${account}`;

const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
};

export function githubOrganization(o: {
  transport: Transport;
  name: string;
  /** The GitHub CLI, given a value on standard input. Without it, nothing
   * can be stored. */
  cli?: GhIn;
  /** For asking GitHub as the app, and about the sign-in's token. */
  fetch?: typeof fetch;
  /** The token the GitHub CLI is signed in with, or null for nobody. */
  token?: () => string | null;
  listen?: Listen;
  clock?: Clock;
  /** What the app's form carries out and back. */
  state?: () => string;
}): Organization {
  const t = o.transport;
  const ORG = `orgs/${o.name}`;
  const ask = o.fetch ?? fetch;
  const clock = o.clock ?? systemClock;
  const absent = async <T,>(call: Promise<T>): Promise<T | null> => {
    try {
      return await call;
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  };
  /** Every item of a list GitHub wraps in an object, page by page. */
  const paged = async <T,>(path: string, key: string): Promise<T[]> => {
    const all: T[] = [];
    for (let page = 1; ; page++) {
      const listed = await t.rest<Record<string, T[]>>(
        "GET",
        `${path}?per_page=100&page=${page}`,
      );
      const items = listed[key] ?? [];
      all.push(...items);
      if (items.length < 100) return all;
    }
  };
  const store = async (
    kind: "secret" | "variable",
    name: string,
    value: string,
  ) => {
    if (!o.cli) throw new Error(`Storing a ${kind} needs the GitHub CLI.`);
    await o.cli(
      [kind, "set", name, "--org", o.name, "--visibility", "all"],
      value,
    );
  };
  const ruleNames = async () =>
    (
      await t.rest<{ name: string }[]>("GET", `${ORG}/rulesets?per_page=100`, {
        paginate: true,
      })
    ).map((r) => r.name);
  const contents = (repository: string, path: string) =>
    `repos/${o.name}/${repository}/contents/${path.split("/").map(encodeURIComponent).join("/")}`;

  async function installation(clientId: string): Promise<Installation | null> {
    const found = (
      await paged<{
        id: number;
        client_id?: string;
        app_slug: string;
        repository_selection: string;
        html_url: string;
      }>(`${ORG}/installations`, "installations")
    ).find((i) => i.client_id === clientId);
    if (!found) return null;
    const app = await t
      .rest<{ name: string }>("GET", `apps/${found.app_slug}`)
      .catch(() => null);
    return {
      id: found.id,
      app: app?.name ?? found.app_slug,
      all: found.repository_selection === "all",
      page: found.html_url,
    };
  }

  return {
    async kind() {
      const account = await absent(
        t.rest<{ type: string }>("GET", `users/${o.name}`),
      );
      if (!account) return null;
      return account.type === "Organization" ? "organization" : "person";
    },
    // GitHub answers 404 to an account that is no member, and 403 where
    // the organization keeps its members from this sign-in.
    async role() {
      let membership: { role: string; state: string };
      try {
        membership = await t.rest("GET", `user/memberships/orgs/${o.name}`);
      } catch (error) {
        if ([403, 404].includes(statusOf(error) ?? 0)) return null;
        throw error;
      }
      if (membership.state !== "active") return null;
      return membership.role === "admin" ? "owner" : "member";
    },
    async plan() {
      const { plan } = await t.rest<{ plan?: { name: string } }>("GET", ORG);
      const free = plan?.name === "free";
      return {
        name: (plan && PLANS[plan.name]) ?? "GitHub",
        rules: !free,
        privateSecrets: !free,
      };
    },
    async signInLacks() {
      const token = o.token?.();
      if (!token) return null;
      const response = await ask("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "User-Agent": "software-factory",
        },
      });
      const header = response.headers.get("x-oauth-scopes");
      if (header === null) return null;
      const has = header.split(",").map((x) => x.trim());
      const scopes = SETUP_SCOPES.filter((x) => !has.includes(x));
      if (!scopes.length) return null;
      return {
        scopes,
        tool: "the GitHub CLI",
        fix: [
          "gh",
          "auth",
          "refresh",
          "-h",
          "github.com",
          "-s",
          scopes.join(","),
        ],
      };
    },

    async repository(name) {
      const repo = await absent(
        t.rest<{ private: boolean }>("GET", `repos/${o.name}/${name}`),
      );
      return repo ? { isPrivate: repo.private } : null;
    },
    async createRepository(name, { isPrivate, description }) {
      await t.rest("POST", `${ORG}/repos`, {
        body: { name, private: isPrivate, description },
      });
    },
    async file(repository, path) {
      const found = await absent(
        t.rest<{ content: string }>("GET", contents(repository, path)),
      );
      return found
        ? Buffer.from(found.content, "base64").toString("utf8")
        : null;
    },
    // No `sha` is sent, so GitHub refuses a path that already has a file.
    async putFiles(repository, files) {
      for (const [path, text] of Object.entries(files))
        await t.rest("PUT", contents(repository, path), {
          body: {
            message: `Add ${path.split("/").at(-1)}`,
            content: Buffer.from(text).toString("base64"),
          },
        });
    },

    secretNames: async () =>
      (await paged<{ name: string }>(`${ORG}/actions/secrets`, "secrets")).map(
        (x) => x.name,
      ),
    setSecret: (name, value) => store("secret", name, value),
    async variable(name) {
      const found = await absent(
        t.rest<{ value: string }>("GET", `${ORG}/actions/variables/${name}`),
      );
      return found?.value ?? null;
    },
    setVariable: (name, value) => store("variable", name, value),

    async defineProperty(name, values) {
      await t.rest("PUT", `${ORG}/properties/schema/${name}`, {
        body: {
          value_type: "single_select",
          required: false,
          allowed_values: values,
          values_editable_by: "org_and_repo_actors",
        },
      });
    },
    ruleNames,
    async requireCheckWhere(rule, check, where) {
      if ((await ruleNames()).includes(rule)) return;
      await t.rest("POST", `${ORG}/rulesets`, {
        body: {
          name: rule,
          target: "branch",
          enforcement: "active",
          conditions: {
            ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] },
            repository_property: {
              include: [
                { name: where.property, property_values: [where.value] },
              ],
              exclude: [],
            },
          },
          rules: [
            {
              type: "required_status_checks",
              parameters: {
                required_status_checks: [requiredStatus(check, where.source)],
                strict_required_status_checks_policy: false,
                do_not_enforce_on_create: true,
              },
            },
          ],
        },
      });
    },

    appName: () => appName(o.name),
    // An app registered under another name is not found: nothing lists
    // an organization's apps to the signed-in account.
    async registeredApp(clientId) {
      const slug = appSlug(appName(o.name).name);
      const app = await t
        .rest<{
          name: string;
          client_id?: string;
          owner?: { login: string; id: number } | null;
        }>("GET", `apps/${slug}`)
        .catch(() => null);
      if (app?.owner?.login.toLowerCase() !== o.name.toLowerCase()) return null;
      if (app.client_id !== undefined && app.client_id !== clientId)
        return null;
      return {
        name: app.name,
        installPage: installPage(slug, app.owner.id),
      };
    },
    async appNamed(name) {
      const app = await absent(
        t.rest<{ owner?: { login: string } | null }>(
          "GET",
          `apps/${appSlug(name)}`,
        ),
      );
      return app ? { owner: app.owner?.login ?? "" } : null;
    },
    async registerApp(app) {
      const { id } = await t.rest<{ id: number }>("GET", ORG);
      const made = await register({
        organization: o.name,
        name: app.name,
        state: (o.state ?? (() => randomBytes(16).toString("hex")))(),
        listen: o.listen ?? listenLocally,
        fetch: ask,
        open: app.open,
        pasted: app.pasted,
        keep: app.keep,
        installPage: ({ slug }) => installPage(slug, id),
      });
      return { ...made, installPage: installPage(made.slug, id) };
    },
    installation,
    awaitInstallation: (clientId) =>
      waitFor(() => installation(clientId), clock),
    installedOn: (id, app, repository) =>
      installed({
        fetch: ask,
        now: clock.now,
        installation: id,
        app,
        repository,
      }),
    appsPage: () => `${SITE}/organizations/${o.name}/settings/apps`,
    filePage: (repository, path) =>
      `${SITE}/${o.name}/${repository}/blob/HEAD/${path}`,
  };
}
