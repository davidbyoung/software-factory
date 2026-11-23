// GitHub as the code host: pull requests, reviews, checks, and commit
// statuses. With `src/tickets/` and `src/runner/`, this is the only code
// that calls GitHub: every command reaches a pull request through here.
//
// GitHub serves a pull request's conversation comments and labels from its
// issues API, so those calls are here too, not in the ticket adapter.
import { GhError, type Gh } from "../lib/gh.mts";
import type { IssueComment, PullRequest } from "../lib/work-status.mts";
import { NotFoundError } from "../tickets/types.mts";
import { writeAccess } from "../tickets/github-access.mts";
import { statusOf, type Transport } from "../tickets/transport.mts";
import { NeedsScopeError, NotSignedInError } from "./types.mts";
import type {
  ChangedFile,
  CheckRun,
  CodeHost,
  CommitStatus,
  Pull,
  PullComment,
  Review,
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
    async statuses(sha) {
      const answer = await t.rest<{ statuses: RestStatus[] }>(
        "GET",
        `${API}/commits/${sha}/status`,
      );
      return answer.statuses.map((s): CommitStatus => ({
        id: s.id,
        name: s.context,
        state: s.state,
        link: s.target_url,
      }));
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
    async requireCheck(rule, check) {
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
                required_status_checks: [{ context: check }],
                strict_required_status_checks_policy: false,
              },
            },
          ],
        },
      });
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
