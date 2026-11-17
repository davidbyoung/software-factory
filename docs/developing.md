# Developing the factory

How to work on the factory itself. For using it, start with the
[quick start](quick-start.md).

## Where it lives

This repository holds the package, its docs, and its tests, and publishes
the package to npm as `@davidbyoung/software-factory`. It was developed
inside the private repository it was drawn out of until 0.1.0, and moved
here with a fresh history. Its tickets are issues here, shown on a board
it shares with that repository: each repository's sync reads only its own
cards.

**It uses the factory on itself.** `.claude/factory.yaml` here sets the
board, OpenSpec, and the CI review, and `node bin/factory.js sync` copies
this repository's own skills, agents, rules, and workflows into `.claude/`
and `.github/`, with hooks that run `bin/factory.js` at the root. So a
change to a skill shows in the same pull request twice: the source, and
the copy this repository's own sessions follow. `CLAUDE.md` says what is
this repository's own, and `npx --no-install factory` finds the package's
own command here without installing it.

A change reaches a repository that uses the factory as a release: a new
version on npm, then Dependabot's pull request there, which `factory-deps`
completes with the files the version writes ([Updating](updating.md)).

## What is built

The factory is the npm package `@davidbyoung/software-factory`. Parts not
marked working below exist only in these docs.

| Part                                                                                                          | State                               |
| ------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Refining, building, and working a pull request's review                                                       | Working                             |
| The board, its sync, and `status`                                                                             | Working                             |
| Builds from the board, with a poller you host                                                                 | Working                             |
| Builds that run in GitHub Actions, started by a command                                                       | Working                             |
| Starting builds from the board, and the review, conflict, and dependency runs, in GitHub Actions              | Working                             |
| Who merges, and the review's verdict                                                                          | Working                             |
| The labels `merge: manual` and `verdict: override`                                                            | Working                             |
| These docs                                                                                                    | Working                             |
| `.claude/factory.yaml`, and the factory's files kept apart from the host's                                    | Working                             |
| The follow-ups ticket as one checklist                                                                        | Working                             |
| The `factory` tool, `sync`, and the package folder                                                            | Working                             |
| A global `factory` command that runs each repository's own copy                                               | Working                             |
| The automated review as one of the factory's workflows, and `ci-review`                                       | Working                             |
| Nothing in the package names the repository it was drawn out of, checked in the folder and the packed tarball | Working                             |
| The `factory-` names and the `FACTORY_` secrets                                                               | Working                             |
| Ticket commands that go through one interface                                                                 | Working                             |
| The code host and the runner, each behind one interface                                                       | Working                             |
| A published package, updated through Dependabot                                                               | Planned, next                       |
| A second repository using it                                                                                  | Planned, after publishing           |
| Your own column names on a board                                                                              | Working                             |
| A UI reviewer for any website                                                                                 | Working                             |
| Built-in measurements for any website                                                                         | Working                             |
| A design skill for any website                                                                                | Working                             |
| `init`, which can be re-run, and `doctor`                                                                     | Working                             |
| `remove`                                                                                                      | Working                             |
| `config explain`                                                                                              | Planned, not yet scheduled          |
| `approvers` and `rules` in the settings                                                                       | Planned, not yet scheduled          |
| Starting builds from a scheduled workflow                                                                     | Planned, not yet scheduled          |
| `factory poller --once`, the scheduled workflow's one pass, and a poller built from an installed package      | Planned, not yet scheduled          |
| `factory migrate`, `factory board sync --dry-run`, and the `/factory-trace` skill                             | Planned, not yet scheduled          |
| Another ticket system, such as Jira                                                                           | Not planned. The design leaves room |
| Another code host or runner                                                                                   | Not planned. The design leaves room |
| Sharing plug-ins between repositories                                                                         | Not planned                         |

When a part is built, its pull request updates this table, and corrects any
page the build had to differ from. [The CLI](cli.md) marks each command
built or planned.

## The folder

```text
./
  package.json                 name, version, bin, files, and its own dependencies
  .claude-plugin/plugin.json   so the folder is also a valid Claude Code plugin
  bin/factory.js               the launcher: plain JavaScript, no logic of its own
  src/cli.mts                  reads the command and loads only that command's module
  src/                         one module per command, and the shared library
  src/tickets/                 the ticket interface, its GitHub adapter, and the transports
  src/code-host/               the code host's interface and GitHub's implementation of it
  src/runner/                  the runner's interface and GitHub Actions' implementation of it
  skills/factory-*/SKILL.md    the skills
  agents/factory-*.md          the built-in reviewers
  rules.md                     the process rules
  review.md                    the CI reviewer's instructions
  workflows/factory-*.yml      the workflows copied into .github/workflows/
  poller.Dockerfile            the poller's image
  docs/                        these pages
  tests/                       the tool's tests and their fixtures
```

It is laid out as a Claude Code plugin even though it is not delivered as
one. That costs nothing, and it keeps the plugin's own tooling usable on the
folder. The settings are validated in code, and `settings.schema.json` is the
editor's copy of their keys. A new key goes in `SETTINGS_KEYS` in
`src/config.mts`, in the schema, and in `docs/configuration.md`, and a test
fails when the first two differ.

## Running from source

The tool is TypeScript, run directly by Node 22.18 or later with no build
step. In this repository, `npm ci` and then `node bin/factory.js`, or a
global `factory`, runs the source.

Node refuses to run TypeScript from inside `node_modules`, so an installed
package runs compiled JavaScript. `prepack` compiles `src/` to `dist/` with
`tsc`, and `src/` and `tests/` are not packed. The launcher, `bin/factory.js`,
serves both, and carries out what `chooseEntry` in `bin/launch.js` picks, in
this order:

1. The source in the repository it was run from: the first folder at or
   above the current directory that has `.git`, when it has
   `packages/factory/package.json` with this package's name. So a git
   worktree runs its own copy, not the one `npx` finds up the tree.
2. The copy that repository installed, when that is not this one, so a
   global install runs the repository's own version.
3. Nothing, with a line saying how to install it, when this copy is outside
   that repository and the repository has none.
4. `src/cli.mts` beside the launcher, when it exists, and otherwise
   `dist/cli.mjs`. Outside any repository, as in the poller's image, this
   is always the choice.

Hooks run the launcher by its path with `node`, not through `npx`, since a
guard runs before every command a session runs: `npx` took 289 ms a call,
`node` on the launcher 56 ms.

To prove the package works outside its host, CI packs the folder, installs
the tarball into an empty repository, and runs `sync`, `sync --check`,
`config check`, and `plugins` there:

```bash
npm run pack-check
```

To try settings against a board without changing the repository's, point
`FACTORY_SETTINGS` at another settings file. Every command reads that file in
place of `.claude/factory.yaml`, for as long as the variable is set:

```bash
FACTORY_SETTINGS=/tmp/try.yaml factory board check
```

## Changing a skill, an agent, or a rule

Edit the source here. A repository that uses the factory gets the change
in the next release, as a copy under its `.claude/` and `.github/` that
`factory sync` writes; CI there runs `factory sync --check`, which fails
when a copy differs from its source, so an edit made to a copy by mistake
cannot merge.

A skill, agent, or workflow that the factory's own steps call is its core,
and every repository gets it. Anything else is written only when a setting
or a file in the repository turns it on: add it to `NEEDS` in
`src/sync.mts`, so a repository that does not use it never carries it.

A factory file must name nothing that belongs to the host repository: not
its paths, its commands, its subject, or its own skills. A test fails when
one does. That is what keeps the folder movable.

## Adding a ticket system

Only GitHub is built. The factory is built so that a second system is an
addition, not a rewrite. Four rules keep it that way.

**1. Nothing talks to the ticket system except through the tool.** A skill
never runs `gh issue` or calls GitHub's issues or projects API. It runs
`factory ticket view 12`, `factory ticket comment 12`, and the other
commands under [Tickets](cli.md#tickets). A test fails when a factory
skill, agent, rule, review instruction, or workflow contains a direct call.

**2. Three folders are the only code that calls GitHub.**
`src/tickets/` holds tickets and the board, `src/code-host/` pull
requests, reviews, and checks, whose conversation comments and labels
GitHub serves from its issues API, and `src/runner/` builds and their
runs. Every command reaches a ticket, a pull request, or a build through
one of them, and a test fails when a file elsewhere under `src/` calls
GitHub or holds a `github.com` address.

**3. The tool reads `tickets.type` and hands the work to that type's
adapter.** An adapter is one module in `src/tickets/` that implements the
`Tickets` type in `src/tickets/types.mts`. `github` is the only one; any
other value fails `factory config check` and every ticket command with
`tickets.type "X" is not supported. "github" is the only ticket system built.`
A type that names a package, so a team can write an adapter for a system
the factory does not ship, is planned, not built.

| Operation               | In `Tickets`              | What it returns or does                                                                                                                                  |
| ----------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read a ticket           | `read`                    | Its number, title, state (`open` or `closed`), when it closed, labels, body, and comments, each with its ID, author, time, and body                      |
| List open tickets       | `listOpen`                | Number, title, and labels, for every open ticket however many there are                                                                                  |
| Read everything at once | `readAll`                 | Every open ticket and the 30 closed ones most recently updated, as `read` returns each; with the board group, each carries its card. Optional: see below |
| Write a ticket's body   | `writeBody`               |                                                                                                                                                          |
| Comment                 | `comment`                 | Returns the comment's ID. Hidden markers pass through unchanged                                                                                          |
| Edit a comment          | `editComment`             | By its ID                                                                                                                                                |
| Delete a comment        | `deleteComment`           | By its ID                                                                                                                                                |
| Not found               | `NotFoundError`           | Reading a ticket that does not exist, or editing or deleting a comment that is gone, throws this, so a caller can tell it from any other failure         |
| Open a ticket           | `open`                    | With a title, a body, and labels. Returns its number                                                                                                     |
| Add or remove a label   | `addLabel`, `removeLabel` |                                                                                                                                                          |
| Link text               | `linkText`                | What makes a merged pull request close the ticket, such as "Closes #12"                                                                                  |
| The address of a ticket | `address`                 | Its page, which the views link a ticket's number to                                                                                                      |

"Read everything at once" has a default, `readAll` in
`src/tickets/types.mts`, built from `listOpen` and `read`, so a new adapter
need not write it; the default returns the open tickets, since a list of
open tickets cannot name the closed ones. The GitHub adapter overrides it
with one GraphQL query.

**4. An adapter says which optional groups it has.** Each group is there
whole or not at all, and `factory ticket supports GROUP` prints `yes` or
`no`. A skill asks before it relies on one; a command that needs a group
its adapter lacks exits non-zero, names the group, and posts nothing.

| Group           | In `Tickets`   | Operations                                                                                               |
| --------------- | -------------- | -------------------------------------------------------------------------------------------------------- |
| `board`         | `board`        | Read every card and the board's fields; add a ticket to the board; set its fields                        |
| `blockers`      | `blockers`     | List what a ticket waits on; record that it waits on another; remove that                                |
| `label-history` | `labelHistory` | Whether a label was ever removed from a ticket, which is how the factory knows the owner took `spec` off |
| `attachments`   | `attachments`  | Comment with images attached, or write a body with them                                                  |

The GitHub adapter has every group, except that `attachments` needs the
GitHub CLI, so an adapter built without it has none. With
no board, state lives in the ticket's comments. With no blockers, the build
order is prose in the ticket and nothing enforces it.

**The transport is a parameter.** The GitHub adapter, `src/code-host/`, and
`src/runner/` take one function for a REST call, one for a GraphQL query,
and one for an answer in plain text, such as a job's log
(`src/tickets/transport.mts`). `ghTransport` runs the GitHub CLI, for
sessions and CI. `fetchTransport` calls the API with a token, for the
poller, which runs with no `gh` and no install; `poller.Dockerfile` copies
the adapter, the transport, and what else the poller imports, and a test
fails when it misses one.

What stays above the interface: working out a ticket's state from its
marker comments, costs, and the formatting of every view, in
`src/lib/work-status.mts` and the commands. They are the factory's own
logic, the same for any system.

A second adapter exists from the start: an in-memory one,
`tests/memory-tickets.ts`, that every command's tests run against. It
keeps the interface honest, since anything the tests need has to go
through it. The GitHub adapter has its own tests against recorded
responses.

What an adapter does not cover: pull requests, reviews, and checks, which
are the code host's, and where an unattended build runs, which is the
runner's. Each has an interface of its own, described next, so a team can
keep its tickets in one system, its code on another, and run its builds on
a third.

## Adding a code host

The code host is where pull requests are. Only GitHub is built. The
settings name it with `code-host.type`, and `src/code-host/index.mts` hands
a command the implementation of that name: one module in `src/code-host/`
that implements the `CodeHost` type in `src/code-host/types.mts`. Any other
value fails `factory config check`, and every command that reads the
settings and reaches a pull request, with
`code-host.type "X" is not supported. "github" is the only code host built.`
A type that names a package is planned, not built.

A command that a workflow also runs, such as `factory pr`, does not read
the settings there, so an unreadable settings file cannot fail the
workflow's step; it asks for the default. The poller has no settings at
all and names its implementations itself.

| Operation                                | In `CodeHost`                                       | What it returns or does                                                                                                                                                                                                                  |
| ---------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read a pull request; list the open ones  | `get`, `listOpen`                                   | Its number, title, state, whether it is merged or a draft, body, mergeable state, author, labels, head and base (commit, branch, repository), and auto-merge                                                                             |
| Open a pull request                      | `create`                                            | From one branch into another, with a title and a body, as a draft or not. Returns its number, and fails in the code host's own words when the branch has nothing new or already has one open                                             |
| Find a pull request                      | `forBranch`, `forCommit`                            | The open pull request from a branch, or none; the pull requests that hold a commit                                                                                                                                                       |
| What a pull request changes              | `files`, `mergeBase`                                | Each file's path, its path before a rename, and its status; the commit two commits both descend from                                                                                                                                     |
| The default branch                       | `defaultBranch`                                     |                                                                                                                                                                                                                                          |
| The checks on a commit                   | `checkRuns`, `statuses`, `setStatus`                | Check runs and commit statuses, kept apart because `factory deps` reads check runs alone and `factory pr watch` reads both; sets a status by name. A check run carries what the check wrote about its own result, when it wrote anything |
| Conversation comments                    | `comments`, `commentView`, `comment`, `editComment` | Each with its ID, author, time, and body. `comment` returns the new comment's ID, and hidden markers pass through unchanged                                                                                                              |
| Not found                                | `NotFoundError`                                     | Reading a pull request or a comment that does not exist throws this, the same error the ticket interface throws                                                                                                                          |
| Add or remove a label                    | `addLabel`, `removeLabel`                           |                                                                                                                                                                                                                                          |
| Reviews                                  | `reviews`, `reviewCommentsOf`, `reviewComments`     | Each review's ID, author, body, and time; the comments one review left on lines; every such comment on the pull request. A reply in a thread carries the comment it replies to                                                           |
| Review threads                           | `threads`, `openThreadCount`, `reply`, `resolve`    | Each thread's first comment, file and line, comments, and whether it is resolved or outdated. `reply` and `resolve` take a comment's ID                                                                                                  |
| Write a body; mark ready                 | `setBody`, `ready`                                  |                                                                                                                                                                                                                                          |
| Commits not shown as signed              | `unverifiedCommits`                                 | One line for each, its short ID and the reason, which `factory pr ready` prints when it refuses                                                                                                                                          |
| The tickets a pull request closes        | `closes`                                            | Their numbers                                                                                                                                                                                                                            |
| The pull requests as the views read them | `open`, `linking`                                   | The open ones with their closing links, open threads, and check state; and those, open or not, that link to a ticket, which the board sync reads for cost notes                                                                          |
| The address of a pull request            | `address`                                           | Its page, which the views link a pull request's number to                                                                                                                                                                                |

There are no optional groups. Every operation is one a command uses
today, so a group is carved out on the day a second code host lacks one.

**No skill, agent, or rule reaches the code host or the runner itself.**
Each runs a `factory pr` command, and a test fails when one names GitHub's
CLI, as a command or in a sentence. The review's instructions, `review.md`,
are the one exception: the review's checkout is the pull request's head, so
the factory's commands there are the code under review, and its reads go
through GitHub's CLI on purpose.

A commit's checks and statuses belong to the code host, not the runner: a
pull request shows them whatever ran them. A check run carries `checksId`,
the ID it shares with the runner's run that reported it, which is how
`factory pr wait-checks` names the checks of a run that failed.

What a command prints or hands on under GitHub's own field names keeps
those names: `factory pr comments --json` prints each comment's `id`,
`user.login`, `body`, and `created_at`, and `merge-policy` hands each of
your commands `filename`, `previous_filename`, and `status`. The command
turns the interface's answer back into those names, so they hold on any
code host. Those are all it prints: a field GitHub returns that the
interface does not carry, such as a comment's `html_url`, is not among
them.

A second implementation exists from the start, `tests/memory-code-host.ts`,
that the tests of `pr`, `deps`, `build`, and `review cost` run against.
GitHub's has its own tests against faked replies, which is where a test
of which call GitHub is sent belongs.

## Adding a runner

The runner is where an unattended build runs. Only GitHub Actions is
built. The settings name it with `builds.runner`, and
`src/runner/index.mts` hands a command the implementation of that name:
one module in `src/runner/` that implements the `Runner` type in
`src/runner/types.mts`. Any other value fails `factory config check`, and
every command that reads the settings and reaches the runner, with
`builds.runner "X" is not supported. "github-actions" is the only runner built.`

| Operation                      | In `Runner`   | What it returns or does                                                                                                                    |
| ------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Start a build of a ticket      | `startBuild`  | On a branch. A refused start throws the runner's own error, whose status and reason the poller's comment on the ticket carries             |
| Find the run a start made      | `findBuild`   | The page of the ticket's build started at or after a time, or nothing while none shows: a runner may answer a start with no run            |
| The page that lists builds     | `buildsPage`  | What `factory build` prints when the run is not found                                                                                      |
| The page of a run              | `runPage`     | From the run's ID, which a ticket's claim comment records                                                                                  |
| The run this session is in     | `thisRun`     | Its ID, its page, and who started it, read from the session's environment; nothing outside a run                                           |
| The runs for a commit          | `runs`        | Each run's ID, which set of jobs it is a run of, what started it, its status and conclusion, and its `checksId`                            |
| The review's runs for a commit | `reviewRuns`  | Their status and conclusion, newest first                                                                                                  |
| Have the review run again      | `reviewAgain` | The newest run of a commit's review, run again; false when none has run on it                                                              |
| The jobs that failed in a run  | `failedJobs`  | Each failed job's name and everything it printed. Which runs count is the caller's: `factory pr failed` takes those `wait-checks` waits on |

**A runner also needs its own job files, which no interface covers.** The
workflows under `workflows/`, the action they share, and their secrets
are GitHub Actions' own. `factory sync` copies them whatever
`builds.runner` says, and another runner would need its own set, written
for it.

Three things stay in GitHub Actions' words whatever the runner: the
factory's messages and comments say "GitHub Actions", the marker comments
on tickets say `actions`, and the board's "Runs in" field says "Actions".
The commands only a workflow runs (`review verdict`, `merge-policy`, and
`review cost`) read GitHub Actions' event file and its `GITHUB_*`
variables, and reach pull requests through the code host.

The in-memory runner is `tests/memory-runner.ts`, and GitHub Actions' has
its own tests against faked replies.

## Checking a change

| Check                  | What it proves                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The tool's unit tests  | Each command does what it says. A new test is seen failing before it is trusted                                                                                |
| `factory sync --check` | The copies match the source                                                                                                                                    |
| Pack and install       | CI packs the folder, installs it into an empty scratch repository, and runs `sync`, `config check`, and one read-only command there. It works outside its host |
| `/factory-trace`       | A change to a rule did not make some kind of change heavier, lighter, or ambiguous                                                                             |
| Fork safety            | No workflow it runs or ships could run a fork's code with a secret or write access (`tests/fork-safety.test.ts`). This repository is public                    |
| One throwaway ticket   | After each stage, one small ticket goes through refine, build, and review for real. Nothing else tests the prose                                               |

The skills are instructions, and instructions cannot be unit tested. The
last row is the only real proof that a change to one still works.

## Releasing

1. Raise `version` in `package.json` in a pull request, run `factory sync`
   so `.claude/factory.lock` records it, and merge it.
2. Tag the merge commit with the same version and push the tag:

   ```bash
   git tag v0.2.0 && git push origin v0.2.0
   ```

3. The release workflow runs the whole CI on the tagged commit, the same
   jobs a pull request gets. Only once they pass does it check that the tag
   matches `package.json` and that `main` has the commit, then publish the
   version to npm.

The first version, 0.1.0, was published by hand, since npm sets up a
trusted publisher only for a package that exists:

```bash
npm ci
npm publish --access public
```

Then, on npmjs.com, the package's settings name this repository's
`release.yml` as its trusted publisher, so later versions publish with no
token. Nothing published can be taken back after 72 hours, and
`pack-check` fails when a packed file names the repository the factory was
drawn out of.

## Writing for the factory

- **American English, with the Oxford comma.**
- **The factory's own words:** ticket, follow-up, the six states, the three
  roles. Not issue, card, or sweep.
- **A key name must make sense unexplained.** Each reference settings file
  is read cold by a fresh agent that is told only what the factory is. A key
  it explains wrongly, or cannot tell from another, is renamed or given a
  better comment.
- **A setting has a default, or it has a reason not to.**
- **A page says what is built.** Anything not built carries the _Planned_
  mark where it is used, linked to "What is built", and a test fails on a
  planned command named without it. When a ticket builds something, its
  pull request removes the mark, and corrects the page where the build had
  to differ.
- **Examples carry the reason for a rule, without the host's private
  history.**
