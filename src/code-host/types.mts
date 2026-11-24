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
  /** The account that set it, where the code host says. */
  author?: string;
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

export type PullCommit = {
  sha: string;
  /** The account the code host itself verifies as the commit's author, or
   * null: anyone can write any name in a commit. */
  verifiedAuthor: string | null;
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
  /** The account that last added the label, which an app's bot can be, or
   * null when the label is off or the code host does not say. */
  labeledBy(pull: number, label: string): Promise<string | null>;

  reviews(pull: number): Promise<Review[]>;
  /** The comments one review carries. */
  reviewCommentsOf(pull: number, review: number): Promise<PullComment[]>;
  /** Every comment every review left on a line. */
  reviewComments(pull: number): Promise<PullComment[]>;
  threads(pull: number): Promise<Thread[]>;
  openThreadCount(pull: number): Promise<number>;
  /** Opens a thread on a line of the commit, as the pull request leaves it,
   * or on the file where the line takes none, and says whether either
   * would take one. */
  commentOn(
    pull: number,
    at: { sha: string; path: string; line: number; body: string },
  ): Promise<boolean>;
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
  /** Every commit on the pull request. Rejects when there may be more than
   * the code host lists. */
  commits(pull: number): Promise<PullCommit[]>;
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
  /** The token the code host's command-line tool is signed in with, for
   * git to read a repository with, or null when it is signed in as nobody. */
  gitToken(): string | null;

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
   * rule named `rule`. A rule of that name already there is left alone.
   * With a `source`, a status of that name from anywhere else does not
   * count. */
  requireCheck(
    rule: string,
    check: string,
    source?: StatusSource,
  ): Promise<void>;
  /** Whether the rules the code host applies to a branch, the
   * organization's among them, require a status of that name. Rejects
   * with NoRulesError where the owner's plan has no rules for the
   * repository. */
  requiresStatus(branch: string, status: string): Promise<boolean>;
  /** The plan of the repository's owner that keeps the secrets the owner
   * shares from this repository, whatever the runner lists for it, by the
   * plan's name: one that shares them only with repositories anyone can
   * read, for a repository that is private. Null when they reach it, or
   * the code host cannot say. */
  secretsWithheldBy(): Promise<string | null>;
  /** The repository's value for each property it has one for. A property
   * its owner defines that has no value here is left out, so a name that
   * is missing says nothing of whether the owner defines it. */
  properties(): Promise<Record<string, string | string[] | null>>;
  /** Whether the repository's owner defines a property of that name for
   * its repositories. Rejects when the owner will not say, as to a member
   * who may not read its properties. */
  ownerDefines(property: string): Promise<boolean>;
  /** Sets the repository's value for a property its owner defines. */
  setProperty(name: string, value: string): Promise<void>;
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

/** Where a required status comes from: `runner`, the account the runner's
 * own token posts as. */
export type StatusSource = "runner";

/** An organization's plan, as far as setup depends on it. */
export type OrganizationPlan = {
  /** The plan's name as the code host writes it, such as `GitHub Free`. */
  name: string;
  /** Whether one rule can cover the organization's repositories. */
  rules: boolean;
  /** Whether the organization's secrets reach its private repositories. */
  privateSecrets: boolean;
};

/** An app the code host has just registered. `key` is its private key,
 * which the code host hands over once. */
export type NewApp = {
  id: number;
  slug: string;
  clientId: string;
  key: string;
};

/** An app installed on an account. */
export type Installation = {
  id: number;
  /** The app's name. */
  app: string;
  /** Whether it is installed on every repository, not a chosen few. */
  all: boolean;
  /** The page that chooses its repositories. */
  page: string;
};

/** An account that owns repositories, and what setting it up once asks of
 * the code host. Every call acts as the signed-in account. */
export type Organization = {
  /** What the name is: an organization, a person's account, or null for
   * no account. */
  kind(): Promise<"organization" | "person" | null>;
  /** The signed-in account's place in it, or null for none. */
  role(): Promise<"owner" | "member" | null>;
  plan(): Promise<OrganizationPlan>;
  /** The permissions setup needs that the sign-in lacks, as the code host
   * names them, with the command that asks for them and the name of the
   * tool that is signed in. Null when it lacks none, or cannot say. */
  signInLacks(): Promise<{
    scopes: string[];
    tool: string;
    fix: string[];
  } | null>;

  /** A repository of the organization's, by its name alone, or null. */
  repository(name: string): Promise<{ isPrivate: boolean } | null>;
  createRepository(
    name: string,
    o: { isPrivate: boolean; description: string },
  ): Promise<void>;
  /** A file's text on the repository's default branch, or null. */
  file(repository: string, path: string): Promise<string | null>;
  /** Writes each file, by its path, one commit each. A file already there
   * is refused, never replaced. */
  putFiles(repository: string, files: Record<string, string>): Promise<void>;

  /** The names of the secrets the organization shares. */
  secretNames(): Promise<string[]>;
  /** Stores a secret every repository of the organization can read. The
   * value never appears in a command's arguments or its output. */
  setSecret(name: string, value: string): Promise<void>;
  /** A variable the organization shares, or null. */
  variable(name: string): Promise<string | null>;
  /** Stores a variable every repository of the organization can read. */
  setVariable(name: string, value: string): Promise<void>;

  /** Defines a property each repository has one of `values` for, which
   * whoever may set a repository's properties may set. */
  defineProperty(name: string, values: string[]): Promise<void>;
  /** The names of the organization's rules. */
  ruleNames(): Promise<string[]>;
  /** Requires `check` before a merge to the default branch of each
   * repository whose `property` is `value`, as a rule named `rule`. */
  requireCheckWhere(
    rule: string,
    check: string,
    where: { property: string; value: string; source?: StatusSource },
  ): Promise<void>;

  /** The organization's app's name, and whether the code host's limit
   * on a name cut the organization short in it. */
  appName(): { name: string; shortened: boolean };
  /** The app of that name, whoever registered it, or null. */
  appNamed(name: string): Promise<{ owner: string } | null>;
  /** Registers an app of the organization's own from a form the person
   * sends in a browser. `open` is given the page to open, `pasted` reads
   * an address typed in place of the browser's return, again when the
   * one before was refused, and `keep` is handed the app the moment the
   * code host gives it. The browser is then sent on to `installPage`,
   * through `open` when it did not come back itself. */
  registerApp(o: {
    name: string;
    open(page: string): void;
    pasted(signal: AbortSignal, again: boolean): Promise<string>;
    keep(app: NewApp): Promise<void>;
  }): Promise<Omit<NewApp, "key"> & { installPage: string }>;
  /** The organization's app with that client ID, found with no
   * installation to go by: its name and the page that installs it. Null
   * when the code host cannot find it. */
  registeredApp(
    clientId: string,
  ): Promise<{ name: string; installPage: string } | null>;
  /** The installation of the app with that client ID, or null. */
  installation(clientId: string): Promise<Installation | null>;
  /** The same, looked for until it shows: null when it never does. */
  awaitInstallation(clientId: string): Promise<Installation | null>;
  /** How many repositories an installation covers, and whether one of
   * that name is among them, asked as the app with its key. */
  installedOn(
    installation: number,
    app: { clientId: string; key: string },
    repository: string,
  ): Promise<{ count: number; covered: boolean }>;
  /** The page that lists the organization's apps. */
  appsPage(): string;
  /** The page of a file on the default branch of one of the
   * organization's repositories. */
  filePage(repository: string, path: string): string;
};

/** A code host before any repository is named: whose addresses are its
 * own, and the organizations on it. */
export type OrganizationHost = {
  label: string;
  /** Whether the address is on this code host. */
  serves(address: string): boolean;
  /** The owner an address names, such as `acme` for
   * `https://github.com/acme`, or null when it names none. */
  ownerOf(address: string): string | null;
  /** An owner's address. */
  addressOf(owner: string): string;
  organization(name: string): Organization;
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

/** The owner's plan has no branch rules for the repository, so none can
 * be read or made. Its message says so in a few words, such as `GitHub
 * Free has no branch rules for a private repository`. */
export class NoRulesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NoRulesError";
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
