// The one interface every code host's implementation fills: pull requests,
// their comments, reviews, and threads, and the checks and statuses on a
// commit. The factory's commands reach a pull request only through it, so a
// second code host is an implementation added beside `github.mts`, not a
// rewrite of the commands. Where a build runs is the runner's
// (`runner/types.mts`).
import type { PullRequest } from "../lib/work-status.mts";
import type { Key } from "../tickets/types.mts";

/** One end of a pull request: the commit, its branch, and the repository
 * the branch is in, as owner/name. */
export type PullEnd = { sha: string; branch: string; repository: string };

export type Pull = {
  number: number;
  title: string;
  /** `open` or `closed`. */
  state: string;
  merged?: boolean;
  isDraft: boolean;
  body: string;
  /** Whether it merges into its base: `dirty` for a conflict, and `unknown`
   * until the code host has worked it out, which `listOpen` never does. */
  mergeableState: string;
  author: string;
  labels: string[];
  /** Its repository is null once the fork it came from is gone. */
  head: Omit<PullEnd, "repository"> & { repository: string | null };
  base: PullEnd;
  createdAt?: string;
  /** Whether it is set to merge itself once its gates pass. */
  autoMerge?: boolean;
};

/** A conversation comment, or a comment a review left on a line. */
export type PullComment = {
  id: number;
  author: string;
  body: string;
  createdAt: string;
  /** The file and line, on a review's comment. */
  path?: string;
  line?: number | null;
  /** The comment this one replies to, when it is a reply in a thread. */
  replyTo?: number;
};

export type Review = {
  id: number;
  author: string;
  body: string;
  submittedAt: string;
};

export type Thread = {
  /** The thread's first comment, which `reply` and `resolve` take. */
  commentId: number;
  /** The code host's own ID for the thread, when it has one. */
  nodeId?: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  comments: { id: number; author: string; body: string }[];
};

/** One run of a check on a commit. `status` is `completed` once it has
 * ended, and `conclusion` says how. */
export type CheckRun = {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  link?: string;
  /** The ID the check shares with the runner's run that reported it. */
  checksId?: number;
  /** What the check wrote about its own result, when it wrote anything. */
  report?: string;
};

/** A status set on a commit by name: `pending`, `success`, `failure`, or
 * `error`. */
export type CommitStatus = {
  id: number;
  name: string;
  state: string;
  link?: string;
};

export type NewStatus = {
  name: string;
  state: "success" | "failure" | "pending";
  description: string;
  link?: string;
};

/** A pull request as `lastForBranch` finds it: `closed` is closed without
 * merging. */
export type LastPull = { number: number; state: "open" | "merged" | "closed" };

/** A pull request to open: from the `head` branch into the `base` branch. */
export type NewPull = {
  title: string;
  head: string;
  base: string;
  body: string;
  draft: boolean;
};

export type ChangedFile = {
  path: string;
  /** The path it had before, when the pull request renamed it. */
  previousPath?: string;
  status: string;
};

export type CodeHost = {
  /** The pull request, or NotFoundError when there is none. */
  get(pull: number): Promise<Pull>;
  /** Opens a pull request and returns its number. It fails in the code
   * host's own words when the head has nothing the base lacks, or already
   * has an open pull request. */
  create(pull: NewPull): Promise<number>;
  /** Closes a pull request without merging it. */
  close(pull: number): Promise<void>;
  /** The tag of the newest release of a repository on this code host, as
   * `owner/name`, or null when it has none. */
  newestRelease(repository: string): Promise<string | null>;
  /** The page of a release's notes, by its repository and tag. */
  releasePage(repository: string, tag: string): string;
  listOpen(): Promise<Pull[]>;
  /** The open pull request from this branch, or null. */
  forBranch(branch: string): Promise<number | null>;
  /** The newest pull request from this branch, open or not, or null when
   * none came from it. */
  lastForBranch(branch: string): Promise<LastPull | null>;
  /** The pull requests that hold the commit, open or not. */
  forCommit(sha: string): Promise<{ number: number; state: string }[]>;
  files(pull: number): Promise<ChangedFile[]>;
  /** The commit two commits both descend from. */
  mergeBase(base: string, head: string): Promise<string>;
  defaultBranch(): Promise<string>;
  /** Whether only people given access can see the repository. */
  isPrivate(): Promise<boolean>;
  /** Whether an organization owns the repository, rather than a person. */
  ownerIsOrganization(): Promise<boolean>;
  /** Whether the account can write to the repository: an approver, whose
   * words a session takes as instructions. Rejects when the code host
   * cannot say. */
  canWrite(login: string): Promise<boolean>;

  /** The check runs on a commit, without its statuses. */
  checkRuns(sha: string): Promise<CheckRun[]>;
  /** The statuses on a commit, without its check runs. */
  statuses(sha: string): Promise<CommitStatus[]>;
  setStatus(sha: string, status: NewStatus): Promise<void>;

  /** The conversation comments. */
  comments(pull: number): Promise<PullComment[]>;
  /** One conversation comment, or NotFoundError when it is gone. */
  commentView(id: number): Promise<PullComment>;
  /** Returns the comment's ID. The body is posted as given. */
  comment(pull: number, body: string): Promise<number>;
  /** NotFoundError when the comment is gone. */
  editComment(id: number, body: string): Promise<void>;
  addLabel(pull: number, label: string): Promise<void>;
  /** NotFoundError when the pull request does not carry the label. */
  removeLabel(pull: number, label: string): Promise<void>;

  reviews(pull: number): Promise<Review[]>;
  /** The comments one review carries. */
  reviewCommentsOf(pull: number, review: number): Promise<PullComment[]>;
  /** Every comment every review left on a line. */
  reviewComments(pull: number): Promise<PullComment[]>;
  threads(pull: number): Promise<Thread[]>;
  openThreadCount(pull: number): Promise<number>;
  /** Replies on the thread `commentId` starts, and returns the reply's ID. */
  reply(pull: number, commentId: number, body: string): Promise<number>;
  /** Resolves the thread that holds the comment. */
  resolve(pull: number, commentId: number): Promise<void>;

  setBody(pull: number, body: string): Promise<void>;
  /** Marks a draft ready for review. */
  ready(pull: number): Promise<void>;
  /** One line for each commit on the pull request the code host does not
   * show as signed: its short ID and the reason, such as `unsigned`. */
  unverifiedCommits(pull: number): Promise<string[]>;
  /** The tickets the pull request closes when it merges, by the code
   * host's own links: only tickets the code host keeps itself. */
  closes(pull: number): Promise<Key[]>;

  /** The open pull requests, as the views and the sync read them: with
   * their check state when `checks` is asked, and their comments, for the
   * cost markers, when `costs` is. */
  open(options?: { checks?: boolean; costs?: boolean }): Promise<PullRequest[]>;
  /** The pull requests, open or not, that link to an open ticket or one
   * closed lately, other than those in `skip`. */
  linking(skip?: number[]): Promise<PullRequest[]>;

  /** The address of a pull request's page. */
  address(pull: number): string;
  /** Where git reads a repository on this code host, named as owner/name,
   * from: the address it clones, and the host's name. */
  remote(repository: string): { url: string; host: string };

  /** Who the code host's command-line tool is signed in as. Rejects with
   * NotSignedInError when it is signed in as nobody, or refused. */
  signedInAs(): Promise<string>;
  /** The account a token belongs to, and its scopes: null when the code
   * host does not say, as for a token with fine-grained permissions.
   * Rejects a token the code host refuses. */
  tokenOwner(
    token: string,
  ): Promise<{ account: string; scopes: string[] | null }>;
  /** The code host's names for the scopes a token needs to do these. */
  scopesFor(needs: TokenNeed[]): string[];
  /** The page that makes a token with these scopes, noted as `note`. */
  newTokenPage(scopes: string[], note: string): string;
  /** The page that installs the app the automated review posts through,
   * or null where the review needs none. */
  reviewAppPage(): string | null;
  /** Lets a pull request be set to merge itself once its gates pass. */
  allowAutoMerge(): Promise<void>;
  /** Requires `check` to pass before a merge to the default branch, as a
   * rule named `rule`. A rule of that name already there is left alone. */
  requireCheck(rule: string, check: string): Promise<void>;
  /** Whether the code host starts a workflow file on an event, which it may
   * hold back in a repository anyone can read: `open` where it holds
   * nothing back, and otherwise `allowed` or `blocked`. */
  eventAllowed(
    file: string,
    event: string,
  ): Promise<"open" | "allowed" | "blocked">;
  /** Lets one workflow file start on these events, and only these, as a
   * policy named `rule`. One of that name already there is rewritten. */
  allowEvents(rule: string, file: string, events: string[]): Promise<void>;
  /** Adds a public key to the signed-in account, to sign commits with.
   * Rejects with NeedsScopeError when the sign-in lacks the permission. */
  addSigningKey(title: string, publicKey: string): Promise<void>;
};

/** What a token for the factory's jobs may need to do: push a branch,
 * change a workflow's file, and write the board. */
export type TokenNeed = "push" | "workflows" | "board";

/** The code host's CLI is signed in as nobody, or its sign-in is
 * refused. */
export class NotSignedInError extends Error {
  constructor() {
    super("The code host's command-line tool is not signed in.");
    this.name = "NotSignedInError";
  }
}

/** A call the signed-in account's sign-in lacks the permission for. `fix`
 * is the command that asks for it. */
export class NeedsScopeError extends Error {
  readonly scope: string;
  readonly fix: string[];
  constructor(scope: string, fix: string[]) {
    super(`The sign-in needs the ${scope} permission.`);
    this.name = "NeedsScopeError";
    this.scope = scope;
    this.fix = fix;
  }
}
