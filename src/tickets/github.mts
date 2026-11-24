// The GitHub adapter: tickets are a repository's issues, and the board is a
// GitHub Project owned by the repository's owner, a person or an
// organization. It reaches GitHub through
// the transport it is given (`transport.mts`), and picks REST or GraphQL per
// call.
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Gh } from "../lib/gh.mts";
import {
  KeyError,
  type Key,
  type LinkKind,
  type Links,
  NotFoundError,
  type Board,
  type BoardField,
  type BoardItem,
  type NewField,
  type Ticket,
  type TicketComment,
  type Tickets,
  type Write,
} from "./types.mts";
import { writeAccess } from "./github-access.mts";
import { statusOf, type Transport } from "./transport.mts";
import { sameName } from "../lib/work-status.mts";
import { MERGED_MARKER, recordOf, renderEntry } from "./record-comments.mts";

export type GithubOptions = {
  transport: Transport;
  /** owner/name */
  repository: string;
  /** The Project's number, or null with no board. */
  board: number | null;
  /** Who owns the Project; the repository's owner unless given. */
  boardOwner?: string;
  /** The GitHub CLI, for attachments, which have no API. Without it, the
   * adapter has no attachments group. */
  cli?: Gh;
  /** The board's own names for the fields the sync reads, null for one it
   * never writes. The factory's own names where not given. */
  fieldNames?: {
    session: string | null;
    runsIn: string | null;
    cost: string | null;
  };
};

type RestIssue = {
  number: number;
  node_id: string;
  id: number;
  title: string;
  state: string;
  closed_at: string | null;
  body: string | null;
  labels: ({ name: string } | string)[];
  pull_request?: unknown;
};

type RestComment = {
  id: number;
  created_at: string;
  body: string | null;
  user: { login: string } | null;
};

const toComment = (raw: RestComment): TicketComment => ({
  id: String(raw.id),
  createdAt: raw.created_at,
  body: raw.body ?? "",
  author: raw.user?.login ?? "ghost",
});

const labelName = (l: { name: string } | string) =>
  typeof l === "string" ? l : l.name;

/** Rethrows a 404 as NotFoundError for `what`. */
async function found<T>(what: string, call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (error) {
    if (statusOf(error) === 404) throw new NotFoundError(what);
    throw error;
  }
}

// What the GitHub adapter's "Read everything at once" asks: every open issue
// and the 30 closed ones most recently updated, each with its last 100
// comments.
export const ISSUES_QUERY = `
query Tickets($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    open: issues(states: OPEN, first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { ...issue }
    }
    closed: issues(states: CLOSED, first: 30, orderBy: {field: UPDATED_AT, direction: DESC}) {
      nodes { ...issue }
    }
  }
}
fragment issue on Issue {
  number title state closedAt body
  labels(first: 30) { nodes { name } }
  comments(last: 100) {
    nodes { databaseId createdAt body author { login } }
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

export type RawIssue = {
  number: number;
  title: string;
  state: "OPEN" | "CLOSED";
  closedAt: string | null;
  body?: string | null;
  labels: { nodes: { name: string }[] };
  comments: RawComments;
};

export type IssuesPage = {
  data: {
    repository: {
      open: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: RawIssue[];
      };
      closed: { nodes: RawIssue[] };
    };
  };
};

export const toComments = (raw: RawComments | undefined): TicketComment[] =>
  (raw?.nodes ?? []).map((c) => ({
    id: String(c.databaseId),
    createdAt: c.createdAt,
    body: c.body,
    author: c.author?.login ?? "ghost",
  }));

/** The field a GitHub Project keeps its columns in. */
const STATUS = "Status";

const withRecord = (comments: TicketComment[]) => ({
  comments,
  record: recordOf(comments),
});

export function fromRawIssue(raw: RawIssue): Ticket {
  return {
    key: String(raw.number),
    title: raw.title,
    finishedAt: raw.state === "OPEN" ? null : raw.closedAt,
    labels: raw.labels.nodes.map((l) => l.name),
    body: raw.body ?? "",
    ...withRecord(toComments(raw.comments)),
  };
}

/** The tickets in every page of ISSUES_QUERY: the open ones, then the
 * closed. */
export function fromIssuesPages(pages: IssuesPage[]): Ticket[] {
  const repo = pages.map((p) => p.data.repository);
  return [
    ...repo.flatMap((r) => r.open.nodes),
    ...(repo[0]?.closed.nodes ?? []),
  ].map(fromRawIssue);
}

export const BOARD_QUERY = `
query Board($owner: String!, $number: Int!, $after: String, $session: String!, $runsIn: String!, $cost: String!) {
  owner: repositoryOwner(login: $owner) {
    ... on ProjectV2Owner {
      projectV2(number: $number) {
        id
        title
        fields(first: 50) {
          nodes {
            ... on ProjectV2FieldCommon { id name dataType }
            ... on ProjectV2SingleSelectField { options { id name } }
          }
        }
        items(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            content {
              ... on Issue { number repository { nameWithOwner } }
            }
            status: fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue { name updatedAt }
            }
            session: fieldValueByName(name: $session) {
              ... on ProjectV2ItemFieldTextValue { text }
            }
            runsIn: fieldValueByName(name: $runsIn) {
              ... on ProjectV2ItemFieldSingleSelectValue { name }
            }
            cost: fieldValueByName(name: $cost) {
              ... on ProjectV2ItemFieldNumberValue { number }
            }
          }
        }
      }
    }
  }
}`;

type RawItem = {
  id: string;
  content: { number?: number; repository?: { nameWithOwner: string } } | null;
  status: { name?: string; updatedAt?: string } | null;
  session: { text?: string } | null;
  runsIn: { name?: string } | null;
  cost?: { number?: number } | null;
};

export type BoardPage = {
  data: {
    owner: {
      projectV2: {
        id: string;
        title?: string;
        fields: { nodes: BoardField[] };
        items: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: RawItem[];
        };
      } | null;
    } | null;
  };
};

export function toBoard(pages: BoardPage[], repository: string): Board {
  const project = pages[0].data.owner?.projectV2;
  if (!project) throw new Error("The Project could not be read.");
  const items = new Map<Key, BoardItem>();
  // GitHub returns a Project's items in the order the board shows them
  // unsorted, which is the order a person drags them into.
  let rank = 0;
  for (const page of pages) {
    for (const raw of page.data.owner!.projectV2!.items.nodes) {
      const number = raw.content?.number;
      if (
        number === undefined ||
        raw.content?.repository?.nameWithOwner !== repository
      )
        continue;
      items.set(String(number), {
        itemId: raw.id,
        key: String(number),
        status: raw.status?.name ?? null,
        updatedAt: raw.status?.updatedAt ?? null,
        session: raw.session?.text ?? "",
        runsIn: raw.runsIn?.name ?? "",
        cost: raw.cost?.number ?? null,
        rank: rank++,
      });
    }
  }
  return {
    projectId: project.id,
    title: project.title,
    columnField: STATUS,
    fields: project.fields.nodes.filter((f) => f.name),
    items,
  };
}

/** Each card's repository and column, and nothing else of the board. */
const READY_QUERY = `
query ReadyRepositories($owner: String!, $number: Int!, $after: String) {
  owner: repositoryOwner(login: $owner) {
    ... on ProjectV2Owner {
      projectV2(number: $number) {
        items(first: 100, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            content {
              ... on Issue { state repository { nameWithOwner } }
            }
            status: fieldValueByName(name: "Status") {
              ... on ProjectV2ItemFieldSingleSelectValue { name }
            }
          }
        }
      }
    }
  }
}`;

type ReadyPage = {
  data: {
    owner: {
      projectV2: {
        items: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          nodes: {
            content: {
              state?: string;
              repository?: { nameWithOwner: string };
            } | null;
            status: { name?: string } | null;
          }[];
        };
      } | null;
    } | null;
  };
};

const ADD_CARD =
  "mutation AddCard($project: ID!, $content: ID!) { addProjectV2ItemById(input: {projectId: $project, contentId: $content}) { item { id } } }";
const CLEAR_FIELD =
  "mutation ClearField($project: ID!, $item: ID!, $field: ID!) { clearProjectV2ItemFieldValue(input: {projectId: $project, itemId: $item, fieldId: $field}) { clientMutationId } }";
const SET_TEXT =
  "mutation SetText($project: ID!, $item: ID!, $field: ID!, $text: String!) { updateProjectV2ItemFieldValue(input: {projectId: $project, itemId: $item, fieldId: $field, value: {text: $text}}) { clientMutationId } }";
const SET_OPTION =
  "mutation SetOption($project: ID!, $item: ID!, $field: ID!, $option: String!) { updateProjectV2ItemFieldValue(input: {projectId: $project, itemId: $item, fieldId: $field, value: {singleSelectOptionId: $option}}) { clientMutationId } }";

const BOARDS_QUERY = `
query Boards($owner: String!) {
  owner: repositoryOwner(login: $owner) {
    ... on ProjectV2Owner {
      projectsV2(first: 100) { nodes { number title closed } }
    }
  }
}`;
const IDS_QUERY =
  "query Ids($owner: String!, $name: String!) { repository(owner: $owner, name: $name) { id owner { id } } }";
const CREATE_BOARD =
  "mutation CreateBoard($owner: ID!, $repo: ID!, $title: String!) { createProjectV2(input: {ownerId: $owner, repositoryId: $repo, title: $title}) { projectV2 { number } } }";
const STATUS_FIELD = `
query StatusField($owner: String!, $number: Int!) {
  owner: repositoryOwner(login: $owner) {
    ... on ProjectV2Owner {
      projectV2(number: $number) {
        field(name: "Status") {
          ... on ProjectV2SingleSelectField {
            id
            options { id name color description }
          }
        }
      }
    }
  }
}`;

const BOARD_FIELDS = `
query BoardFields($owner: String!, $number: Int!) {
  owner: repositoryOwner(login: $owner) {
    ... on ProjectV2Owner {
      projectV2(number: $number) {
        id
        fields(first: 50) { nodes { ... on ProjectV2FieldCommon { name } } }
      }
    }
  }
}`;

/** The mutation that adds one field to a board, as a literal for the same
 * reason as `setColumnsMutation`. */
export function addFieldMutation(project: string, field: NewField) {
  const type = { text: "TEXT", number: "NUMBER", select: "SINGLE_SELECT" }[
    field.type
  ];
  const options =
    field.type === "select"
      ? `, singleSelectOptions: [${field.options
          .map(
            (o) => `{name: ${JSON.stringify(o)}, color: GRAY, description: ""}`,
          )
          .join(", ")}]`
      : "";
  return `mutation { createProjectV2Field(input: {projectId: ${JSON.stringify(project)}, dataType: ${type}, name: ${JSON.stringify(field.name)}${options}}) { clientMutationId } }`;
}

type StatusOption = {
  id?: string;
  name: string;
  color: string;
  description: string;
};

/** The mutation that sets a Status field's columns: GraphQL takes a list of
 * objects only as a literal, so the strings are written as JSON, which is
 * valid GraphQL. */
export function setColumnsMutation(field: string, options: StatusOption[]) {
  const list = options
    .map(
      (o) =>
        `{${o.id ? `id: ${JSON.stringify(o.id)}, ` : ""}name: ${JSON.stringify(o.name)}, color: ${o.color}, description: ${JSON.stringify(o.description)}}`,
    )
    .join(", ");
  return `mutation { updateProjectV2Field(input: {fieldId: ${JSON.stringify(field)}, singleSelectOptions: [${list}]}) { clientMutationId } }`;
}

/** The id in the URL `gh issue comment` prints. */
export function commentIdFromUrl(url: string): string {
  const match = /#issuecomment-(\d+)/.exec(url);
  if (!match) throw new Error(`gh printed no comment address: ${url.trim()}`);
  return match[1];
}

/** A key typed for GitHub: an issue's number. */
export function githubKey(typed: string): Key {
  if (/^[1-9]\d*$/.test(typed)) return typed;
  if (/^[\w.-]+\/[\w.-]+#\d+$/.test(typed))
    throw new KeyError(
      `${typed} is in another repository: the factory reads only its state as a blocker`,
    );
  throw new KeyError(
    `${typed} is not a ticket here: a GitHub ticket is its number, such as 12`,
  );
}

/** How GitHub writes a ticket: `#12`, or `owner/repo#4` for one in another
 * repository, whose key is already written that way. */
export const githubRef = (key: Key): string =>
  key.includes("/") ? key : `#${key}`;

export const githubLinkText = (key: Key, kind: LinkKind): string =>
  `${kind === "closes" ? "Closes" : "Part of"} ${githubRef(key)}`;

/** The `Closes #N` and `Part of #N` lines in a pull request's body. */
export function githubLinksIn(body: string): Links {
  const links: Links = { closes: [], partOf: [] };
  for (const m of body.matchAll(/\b(closes|part of) #(\d+)(?!\d)/gi)) {
    const list = m[1].toLowerCase() === "closes" ? links.closes : links.partOf;
    if (!list.includes(m[2])) list.push(m[2]);
  }
  return links;
}

const ISSUE_FIELDS = `query IssueFields($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    issueFields(first: 100) {
      nodes {
        __typename
        ... on IssueFieldText { id name description }
        ... on IssueFieldSingleSelect { id name description }
        ... on IssueFieldNumber { id name description }
        ... on IssueFieldDate { id name description }
      }
    }
  }
}`;

const FIELD_VALUES = `query IssueFieldValues($owner: String!, $name: String!, $number: Int!) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      issueFieldValues(first: 50) {
        nodes { ... on IssueFieldTextValue { value field { ... on IssueFieldText { name } } } }
      }
    }
  }
}`;

const SET_ISSUE_FIELD = `mutation SetIssueField($issue: ID!, $field: ID!, $text: String!) {
  setIssueFieldValue(input: { issueId: $issue, issueFields: [{ fieldId: $field, textValue: $text }] }) { clientMutationId }
}`;

const CLEAR_ISSUE_FIELD = `mutation ClearIssueField($issue: ID!, $field: ID!) {
  setIssueFieldValue(input: { issueId: $issue, issueFields: [{ fieldId: $field, delete: true }] }) { clientMutationId }
}`;

export function githubTickets(o: GithubOptions): Tickets {
  const API = `repos/${o.repository}`;
  const [repoOwner, repoName] = o.repository.split("/");
  const t = o.transport;
  let lastBoard: Board | null = null;

  const issue = (n: Key) =>
    found(`#${n}`, t.rest<RestIssue>("GET", `${API}/issues/${n}`));

  // GitHub numbers issues and pull requests from one sequence, and its
  // issues API writes to either, so a write first checks that the number
  // is an issue.
  const issues = new Set<Key>();
  const anIssue = async (n: Key) => {
    if (issues.has(n)) return;
    const raw = await issue(n);
    if (raw.pull_request) throw new NotFoundError(`#${n}`);
    issues.add(n);
  };

  /** Board `number`'s Status field, or null when it has none. */
  const statusField = async (number: number) => {
    const answer = await t.graphql<{
      data: {
        owner: {
          projectV2: {
            field: { id: string; options: StatusOption[] } | null;
          } | null;
        } | null;
      };
    }>(STATUS_FIELD, { owner: o.boardOwner ?? repoOwner, number });
    return answer.data.owner?.projectV2?.field ?? null;
  };

  /** The repository's issue fields, each with its type. */
  const issueFields = async () => {
    const answer = await t.graphql<{
      data: {
        repository: {
          issueFields: {
            nodes: ({
              __typename: string;
              id: string;
              name: string;
              description?: string | null;
            } | null)[];
          };
        };
      };
    }>(ISSUE_FIELDS, { owner: repoOwner, name: repoName });
    return answer.data.repository.issueFields.nodes.filter(
      (f): f is NonNullable<typeof f> => f !== null,
    );
  };

  const readBoard = async (): Promise<Board> => {
    if (o.board === null)
      return {
        projectId: "",
        columnField: STATUS,
        fields: [],
        items: new Map(),
      };
    const pages: BoardPage[] = [];
    let after: string | null = null;
    do {
      const page: BoardPage = await t.graphql<BoardPage>(BOARD_QUERY, {
        owner: o.boardOwner ?? repoOwner,
        number: o.board,
        after,
        // A field the settings say is never written is not read: no field
        // has an empty name.
        session: o.fieldNames ? (o.fieldNames.session ?? "") : "Session",
        runsIn: o.fieldNames ? (o.fieldNames.runsIn ?? "") : "Runs in",
        cost: o.fieldNames ? (o.fieldNames.cost ?? "") : "Cost",
      });
      pages.push(page);
      const info = page.data.owner?.projectV2?.items.pageInfo;
      after = info?.hasNextPage ? info.endCursor : null;
    } while (after);
    lastBoard = toBoard(pages, o.repository);
    return lastBoard;
  };

  const tickets: Tickets = {
    key: githubKey,
    ref: githubRef,
    async read(n) {
      const raw = await issue(n);
      if (raw.pull_request) throw new NotFoundError(`#${n}`);
      issues.add(n);
      const comments = await t.rest<RestComment[]>(
        "GET",
        `${API}/issues/${n}/comments?per_page=100`,
        { paginate: true },
      );
      return {
        key: String(raw.number),
        title: raw.title,
        finishedAt: raw.state === "closed" ? raw.closed_at : null,
        labels: raw.labels.map(labelName),
        body: raw.body ?? "",
        ...withRecord(comments.map(toComment)),
      };
    },
    readAll: (options) => readAllTickets(options),
    async listUnfinished() {
      const all = await t.rest<RestIssue[]>(
        "GET",
        `${API}/issues?state=open&per_page=100`,
        { paginate: true },
      );
      const open = all.filter((i) => !i.pull_request);
      for (const i of open) issues.add(String(i.number));
      return open.map((i) => ({
        key: String(i.number),
        title: i.title,
        labels: i.labels.map(labelName),
      }));
    },
    async writeBody(n, body) {
      await anIssue(n);
      await found(
        `#${n}`,
        t.rest("PATCH", `${API}/issues/${n}`, { fields: { body } }),
      );
    },
    async writeTitle(n, title) {
      await anIssue(n);
      await found(
        `#${n}`,
        t.rest("PATCH", `${API}/issues/${n}`, { fields: { title } }),
      );
    },
    async comment(n, body) {
      await anIssue(n);
      const made = await found(
        `#${n}`,
        t.rest<{ id: number }>("POST", `${API}/issues/${n}/comments`, {
          fields: { body },
        }),
      );
      return String(made.id);
    },
    async editComment(id, body) {
      await found(
        `comment ${id}`,
        t.rest("PATCH", `${API}/issues/comments/${id}`, { fields: { body } }),
      );
    },
    async deleteComment(id) {
      await found(
        `comment ${id}`,
        t.rest("DELETE", `${API}/issues/comments/${id}`),
      );
    },
    async open({ title, body, labels }) {
      const fields: Record<string, string | string[]> = { title, body };
      if (labels.length) fields.labels = labels;
      const made = await t.rest<{ number: number }>("POST", `${API}/issues`, {
        fields,
      });
      return String(made.number);
    },
    // Adding a label to an issue creates it when the repository lacks it.
    async ensureLabel() {},
    async finish(n) {
      const raw = await issue(n);
      if (raw.pull_request) throw new NotFoundError(`#${n}`);
      if (raw.state === "closed") return;
      await t.rest("PATCH", `${API}/issues/${n}`, {
        fields: { state: "closed", state_reason: "completed" },
      });
    },
    statuses: false,
    record: {
      add(n, entry) {
        // GitHub shows the merge that closed an issue on the issue itself.
        if (entry.markers.includes(MERGED_MARKER)) return Promise.resolve("");
        return tickets.comment(n, renderEntry(entry));
      },
      update: (id, entry) => tickets.editComment(id, renderEntry(entry)),
      remove: (id) => tickets.deleteComment(id),
      read: async (n) => (await tickets.read(n)).record,
    },
    async addLabel(n, label) {
      await anIssue(n);
      await found(
        `#${n}`,
        t.rest("POST", `${API}/issues/${n}/labels`, {
          fields: { labels: [label] },
        }),
      );
    },
    async removeLabel(n, label) {
      await anIssue(n);
      try {
        await t.rest(
          "DELETE",
          `${API}/issues/${n}/labels/${encodeURIComponent(label)}`,
        );
      } catch (error) {
        // GitHub answers 404 for a label the issue does not have; removing
        // it is then already done, but a missing issue is not.
        if (statusOf(error) !== 404) throw error;
        await issue(n);
      }
    },
    mayDecide: (author) => writeAccess(t, o.repository, author),
    linkText: githubLinkText,
    linksIn: githubLinksIn,
    address: (n) => `https://github.com/${o.repository}/issues/${n}`,

    board: {
      read: readBoard,
      async add(n) {
        const board = lastBoard ?? (await readBoard());
        if (o.board === null) throw new Error("The settings name no board.");
        const raw = await issue(n);
        if (raw.pull_request) throw new NotFoundError(`#${n}`);
        const added = await t.graphql<{
          data: { addProjectV2ItemById: { item: { id: string } } };
        }>(ADD_CARD, { project: board.projectId, content: raw.node_id });
        return added.data.addProjectV2ItemById.item.id;
      },
      async move(itemId, column) {
        await tickets.board!.set(itemId, [
          { field: STATUS, optionName: column },
        ]);
      },
      async set(itemId, writes: Write[]) {
        if (o.board === null) throw new Error("The settings name no board.");
        const board = lastBoard ?? (await readBoard());
        const field = (name: string) => {
          const f = board.fields.find((x) => sameName(x.name, name));
          if (!f) throw new Error(`The board has no ${name} field.`);
          return f;
        };
        for (const write of writes) {
          const f = field(write.field);
          const base = { project: board.projectId, item: itemId, field: f.id };
          if ("clear" in write) {
            await t.graphql(CLEAR_FIELD, base);
          } else if ("number" in write) {
            // gh -F types integers only: 18.75 as a variable reaches GitHub
            // as a string, which Float! refuses. A JS number is a safe
            // literal.
            if (!Number.isFinite(write.number))
              throw new Error(`Cost ${write.number} is not a number.`);
            await t.graphql(
              `mutation SetNumber($project: ID!, $item: ID!, $field: ID!) { updateProjectV2ItemFieldValue(input: {projectId: $project, itemId: $item, fieldId: $field, value: {number: ${write.number}}}) { clientMutationId } }`,
              base,
            );
          } else if ("text" in write) {
            await t.graphql(SET_TEXT, { ...base, text: write.text });
          } else {
            const option = f.options?.find((x) =>
              sameName(x.name, write.optionName),
            );
            if (!option)
              throw new Error(
                `The board's ${write.field} field has no ${write.optionName}.`,
              );
            await t.graphql(SET_OPTION, { ...base, option: option.id });
          }
        }
      },
      async readyRepositories(number, column) {
        const found = new Set<string>();
        let after: string | null = null;
        do {
          const page: ReadyPage = await t.graphql<ReadyPage>(READY_QUERY, {
            owner: o.boardOwner ?? repoOwner,
            number,
            after,
          });
          const items = page.data.owner?.projectV2?.items;
          if (!items) throw new Error("The Project could not be read.");
          for (const { content, status } of items.nodes)
            if (
              content?.state === "OPEN" &&
              content.repository &&
              status?.name !== undefined &&
              sameName(status.name, column)
            )
              found.add(content.repository.nameWithOwner);
          after = items.pageInfo.hasNextPage ? items.pageInfo.endCursor : null;
        } while (after);
        return [...found];
      },
      async list() {
        const answer = await t.graphql<{
          data: {
            owner: {
              projectsV2?: {
                nodes: { number: number; title: string; closed: boolean }[];
              };
            } | null;
          };
        }>(BOARDS_QUERY, { owner: o.boardOwner ?? repoOwner });
        return (answer.data.owner?.projectsV2?.nodes ?? [])
          .filter((b) => !b.closed)
          .map(({ number, title }) => ({ number, title }));
      },
      async create(title) {
        const ids = await t.graphql<{
          data: { repository: { id: string; owner: { id: string } } };
        }>(IDS_QUERY, { owner: repoOwner, name: repoName });
        const made = await t.graphql<{
          data: { createProjectV2: { projectV2: { number: number } } };
        }>(CREATE_BOARD, {
          owner: ids.data.repository.owner.id,
          repo: ids.data.repository.id,
          title,
        });
        return made.data.createProjectV2.projectV2.number;
      },
      async columns(number) {
        const field = await statusField(number);
        return (field?.options ?? []).map((x) => x.name);
      },
      async addColumns(number, columns) {
        const field = await statusField(number);
        if (!field) throw new Error(`Board ${number} has no Status field.`);
        const has = (name: string) =>
          field.options.find((x) => sameName(x.name, name));
        const added = columns.filter((c) => !has(c));
        if (added.length === 0) return [];
        const ordered = columns.map(
          (c) => has(c) ?? { name: c, color: "GRAY", description: "" },
        );
        const rest = field.options.filter(
          (x) => !columns.some((c) => sameName(c, x.name)),
        );
        await t.graphql(setColumnsMutation(field.id, [...ordered, ...rest]));
        return added;
      },
      async addFields(number, fields) {
        const answer = await t.graphql<{
          data: {
            owner: {
              projectV2: {
                id: string;
                fields: { nodes: { name?: string }[] };
              } | null;
            } | null;
          };
        }>(BOARD_FIELDS, { owner: o.boardOwner ?? repoOwner, number });
        const project = answer.data.owner?.projectV2;
        if (!project) throw new Error(`Board ${number} could not be read.`);
        const missing = fields.filter(
          (f) =>
            !project.fields.nodes.some(
              (n) => n.name && sameName(n.name, f.name),
            ),
        );
        for (const f of missing)
          await t.graphql(addFieldMutation(project.id, f));
        return missing.map((f) => f.name);
      },
    },

    fields: {
      plainText: true,
      async list() {
        return (await issueFields()).map((f) => ({
          name: f.name,
          description: f.description ?? null,
          text: f.__typename === "IssueFieldText",
        }));
      },
      async holds() {
        return { max: null };
      },
      async read(n) {
        const answer = await t.graphql<{
          data: {
            repository: {
              issue: {
                issueFieldValues: {
                  nodes: ({
                    value?: string;
                    field?: { name?: string };
                  } | null)[];
                };
              } | null;
            };
          };
        }>(FIELD_VALUES, { owner: repoOwner, name: repoName, number: n });
        const found = answer.data.repository.issue;
        if (!found) throw new NotFoundError(`#${n}`);
        const values: Record<string, string> = {};
        for (const v of found.issueFieldValues.nodes)
          if (v?.field?.name) values[v.field.name] = v.value ?? "";
        return values;
      },
      async write(n, values) {
        const fields = await issueFields();
        await anIssue(n);
        const { node_id } = await issue(n);
        for (const [name, value] of Object.entries(values)) {
          const field = fields.find((f) => f.name === name);
          if (!field) throw new Error(`No issue field called ${name}.`);
          await t.graphql(
            value === null ? CLEAR_ISSUE_FIELD : SET_ISSUE_FIELD,
            value === null
              ? { issue: node_id, field: field.id }
              : { issue: node_id, field: field.id, text: value },
          );
        }
      },
    },

    blockers: {
      async list(n) {
        const list = await found(
          `#${n}`,
          t.rest<{ number: number; state: string; repository_url?: string }[]>(
            "GET",
            `${API}/issues/${n}/dependencies/blocked_by`,
            { paginate: true },
          ),
        );
        return list.map((b) => {
          const repo = b.repository_url?.replace(/^.*\/repos\//, "");
          const elsewhere =
            repo && repo.toLowerCase() !== o.repository.toLowerCase();
          return {
            key: elsewhere ? `${repo}#${b.number}` : String(b.number),
            state: b.state === "open" ? "open" : "closed",
          };
        });
      },
      async add(n, by) {
        await anIssue(n);
        const blocker = await issue(by);
        await found(
          `#${n}`,
          t.rest("POST", `${API}/issues/${n}/dependencies/blocked_by`, {
            fields: { issue_id: blocker.id },
          }),
        );
      },
      async remove(n, by) {
        const blocker = await issue(by);
        await found(
          `#${n} waiting on #${by}`,
          t.rest(
            "DELETE",
            `${API}/issues/${n}/dependencies/blocked_by/${blocker.id}`,
          ),
        );
      },
    },

    labelHistory: {
      async wasRemoved(n, label) {
        const events = await found(
          `#${n}`,
          t.rest<{ event: string; label?: { name: string } }[]>(
            "GET",
            `${API}/issues/${n}/events?per_page=100`,
            { paginate: true },
          ),
        );
        return events.some(
          (e) => e.event === "unlabeled" && e.label?.name === label,
        );
      },
    },
  };

  async function readAllTickets(
    options: { board?: boolean; label?: string } = {},
  ): Promise<Ticket[]> {
    const pages: IssuesPage[] = [];
    let after: string | null = null;
    do {
      const page: IssuesPage = await t.graphql<IssuesPage>(ISSUES_QUERY, {
        owner: repoOwner,
        name: repoName,
        after,
      });
      pages.push(page);
      const info = page.data.repository.open.pageInfo;
      after = info.hasNextPage ? info.endCursor : null;
    } while (after);
    const all = fromIssuesPages(pages);
    for (const x of all) issues.add(x.key);
    const label = options.label;
    const read =
      label === undefined
        ? all
        : all.filter((x) => x.labels.some((l) => sameName(l, label)));
    if (!options.board) return read;
    const board = await readBoard();
    return read.map((x) => ({
      ...x,
      card: board.items.get(x.key) ?? null,
    }));
  }

  if (o.cli) {
    const cli = o.cli;
    // The body goes in a file beside the first image, where the skills
    // keep a body and its images, so its `./name.png` references resolve
    // as written.
    const withFile = async <T,>(
      body: string,
      files: string[],
      post: (file: string) => Promise<T>,
    ) => {
      const dir = files[0] ? dirname(files[0]) : tmpdir();
      const file = join(dir, `.factory-body-${process.pid}-${Date.now()}.md`);
      writeFileSync(file, body);
      try {
        return await post(file);
      } finally {
        rmSync(file, { force: true });
      }
    };
    const attach = (files: string[]) => files.flatMap((f) => ["--attach", f]);
    tickets.attachments = {
      comment: (n, body, files) =>
        withFile(body, files, async (file) =>
          commentIdFromUrl(
            await cli([
              "issue",
              "comment",
              String(n),
              "--repo",
              o.repository,
              "--body-file",
              file,
              ...attach(files),
            ]),
          ),
        ),
      writeBody: (n, body, files) =>
        withFile(body, files, async (file) => {
          await cli([
            "issue",
            "edit",
            String(n),
            "--repo",
            o.repository,
            "--body-file",
            file,
            ...attach(files),
          ]);
        }),
    };
  }
  return tickets;
}
