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
board, OpenSpec, the gate, and the pull request review, and `node bin/factory.js sync` copies
this repository's own skills, agents, and rules into `.claude/` and
`.github/`, with hooks that run `bin/factory.js` at the root. So a
change to a skill shows in the same pull request twice: the source, and
the copy this repository's own sessions follow. The sync also writes the
two workflow files every repository gets, `factory.yml` and
`factory-review.yml`, which here call `./.github/workflows/run.yml` and
`./.github/workflows/review.yml`, the same commit's copies, where any
other repository's call them at a released version. `poller.yml` is
called by no file here: an organization's `factory-config` repository
calls it. `CLAUDE.md` says
what is this repository's own, and the `factory` command, run here, runs
this repository's source.

A change reaches a repository that uses the factory as a release: a new
version on npm and its tag here, then a pull request there, which that
repository's update job opens with the files the version writes
([Updating](updating.md)).

## What is built

The factory is the npm package `@davidbyoung/software-factory`. Parts not
marked working below exist only in these docs.

| Part                                                                                                                                                                           | State                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Refining, building, and working a pull request's review                                                                                                                        | Working                                             |
| The board, its sync, and `status`                                                                                                                                              | Working                                             |
| Builds from the board, with a poller you host                                                                                                                                  | Working                                             |
| Builds that run in GitHub Actions, started by a command                                                                                                                        | Working                                             |
| Starting builds from the board, and the review, conflict, and dependency runs, in GitHub Actions                                                                               | Working                                             |
| Who merges, and the review's verdict                                                                                                                                           | Working                                             |
| The labels `merge-manual` and `verdict-override`                                                                                                                               | Working                                             |
| These docs                                                                                                                                                                     | Working                                             |
| `.claude/factory.yaml`, and the factory's files kept apart from the host's                                                                                                     | Working                                             |
| The follow-ups ticket as one checklist                                                                                                                                         | Working                                             |
| The `factory` tool, `sync`, and the package folder                                                                                                                             | Working                                             |
| One install on a machine: the `factory` command runs the version each repository's lock names, downloading it once                                                             | Working                                             |
| Nothing of the factory's installed in a repository: no `package.json` entry, and hooks that run the machine's `factory`                                                        | Working                                             |
| Two workflow files in a repository, which call the factory's own workflows at the version its lock names                                                                       | Working                                             |
| A job that passes or is skipped when its part is off, and a session job that looks for work before a token                                                                     | Working                                             |
| The Actions policy a public repository needs for `pull_request_target`, added by `init` and checked by `doctor`                                                                | Working                                             |
| The automated review as one of the factory's runs, and [`pr-review`](configuration.md#pr-review)                                                                               | Working                                             |
| Nothing in the package names the repository it was drawn out of, checked in the folder and the packed tarball                                                                  | Working                                             |
| The `factory-` names and the `FACTORY_` secrets                                                                                                                                | Working                                             |
| Ticket commands that go through one interface                                                                                                                                  | Working                                             |
| The code host and the runner, each behind one interface                                                                                                                        | Working                                             |
| A published package                                                                                                                                                            | Working                                             |
| `factory update`, and the update job that opens a pull request for each release and each preset's change                                                                       | Working                                             |
| Presets from a repository, each pinned to a commit in the lock                                                                                                                 | Working                                             |
| `factory board --dry-run`                                                                                                                                                      | Working                                             |
| Your own column names on a board                                                                                                                                               | Working                                             |
| `init` suggesting a board's columns through the coding agent                                                                                                                   | Working                                             |
| Refinement's factory fields in your ticket fields, suggested by `init`                                                                                                         | Working                                             |
| A UI reviewer for any website                                                                                                                                                  | Working                                             |
| Built-in measurements for any website                                                                                                                                          | Working                                             |
| A design skill for any website                                                                                                                                                 | Working                                             |
| `init`, which can be re-run, and `doctor`                                                                                                                                      | Working                                             |
| A second repository set up and removed from the quick start alone                                                                                                              | Working                                             |
| `factory remove`                                                                                                                                                               | Working                                             |
| Starting builds from a scheduled job, `factory poller --once`, and a poller built from an installed package                                                                    | Working                                             |
| [`rules`](configuration.md#rules) in the settings, `factory config explain`, and the `factory-trace` skill                                                                     | Working                                             |
| Settings version 2: commands, a spec check, and plugins grouped by phase                                                                                                       | Working                                             |
| `factory gate`, `test-one`, `end-to-end`, and `specs check`, which run the settings' commands                                                                                  | Working                                             |
| The default branch read from Git and the code host, never assumed, and `factory default-branch`                                                                                | Working                                             |
| A refiner, a prover, test reviewers, and conflict resolvers of your own, and `factory-e2e-reviewer`                                                                            | Working                                             |
| `factory ticket refined` refusing a ticket a build could not read                                                                                                              | Working                                             |
| No skill, agent, rule, or review instruction names a stack, checked by a test                                                                                                  | Working                                             |
| A ticket system's token kept in the repository's secrets and on your machine                                                                                                   | Working                                             |
| An organization set up once, with `factory init --org`: its own GitHub App, its secrets, the repository that holds its preset, and the rule that requires the review's verdict | Working                                             |
| A run that acts as the organization's App, with a token made by each job that needs one, and none by a session                                                                 | Working                                             |
| A cloud run as three jobs, Prepare, Session, and Publish, with no sign-in beside the AI: a build, a review, an answer, a conflict, and a dependency                            | Built. Not yet run end to end                       |
| [`builds.hosts`](configuration.md#builds), the hosts a session in the cloud may reach                                                                                          | Working                                             |
| The review's verdict taken from its own run, and no comment                                                                                                                    | Working                                             |
| An organization's one poller, in the repository that holds its preset                                                                                                          | Working                                             |
| `init` choosing the repository from the checkout's remotes, reading presets before it asks, running the gate, and opening the setup pull request                               | Working                                             |
| The verdict made a required check by the first run after a repository's setup merges, with `factory enroll`                                                                    | Working                                             |
| A person's GitHub and Claude tokens kept on their machine, for their next repository                                                                                           | Working                                             |
| Verified commits from a build that acts as an organization's App                                                                                                               | Planned: #77                                        |
| Another ticket system, such as Jira                                                                                                                                            | Planned: #63                                        |
| A ticket system or code host named by a package, for an adapter you write yourself                                                                                             | Not planned. The design leaves room                 |
| Another code host or runner                                                                                                                                                    | Not planned. The design leaves room                 |
| Another spec tool, such as Spec Kit                                                                                                                                            | Not planned. An adapter under `src/specs/` adds one |
| Each tool's setup, checks, and removal declared by the tool                                                                                                                    | Working                                             |
| Sharing plugins between repositories                                                                                                                                           | Not planned                                         |

When a part is built, its pull request updates this table, and corrects any
page the build had to differ from. [The CLI](cli.md) marks each command
built or planned.

## The folder

```text
./
  package.json                 name, version, bin, files, and its own dependencies
  .claude-plugin/plugin.json   so the folder is also a valid Claude Code plugin
  bin/factory.js               the launcher: plain JavaScript, no logic of its own
  bin/launch.js                which version the launcher runs, and its download
  src/cli.mts                  reads the command and loads only that command's module
  src/commands-list.mts        every command, who reads what it prints, and its module
  src/lib/output.mts           what every command prints through, and the table of looks
  src/lib/prompts.mts          the questions a command asks at the terminal
  src/                         one module per command, and the shared library
  src/tickets/                 the ticket interface, its GitHub adapter, and the transports
  src/code-host/               the code host's interface and GitHub's implementation of it
  src/runner/                  the runner's interface and GitHub Actions' implementation of it
  src/agent/                   the coding agent's interface, Claude Code's implementation, and how it is confined in the cloud
  src/handoff/                 what a session in the cloud reads, asks for, and hands over, and the check of its commits
  src/session.mts              factory session: whether a run has work, and the repositories its token is for
  src/session-jobs.mts         the three jobs of a cloud run with the real tools, and the start of the next run
  src/session-prepare.mts      Prepare: what is handed over
  src/session-run.mts          Session: the folders, the environment, and what is kept
  src/session-publish.mts      Publish: what is checked and done, the wait for CI, and the rounds
  src/session-token.mts        signs a job in as an organization's App
  src/review-record.mts        what Publish does with a review's answer
  skills/factory-*/SKILL.md    the skills
  agents/factory-*.md          the built-in reviewers
  rules.md                     the process rules
  review.md                    the pull request reviewer's instructions
  src/workflow-files.mts       writes the two workflow files a repository gets, and an organization's factory-poller.yml
  .github/workflows/           run.yml, review.yml, session.yml, and poller.yml: the jobs those files call
  poller.Dockerfile            the poller's image
  docs/                        these pages
  tests/                       the tool's tests and their fixtures
```

It is laid out as a Claude Code plugin even though it is not delivered as
one. That costs nothing, and it keeps the plugin's own tooling usable on the
folder. The settings are validated in code, and `settings.schema.json` is the
editor's copy of their keys. A new key goes in `SETTINGS_KEYS` in
`src/config.mts`, in the schema, in `src/explain.mts`, which prints it, and
in `docs/configuration.md`, and a test fails when the first two differ.

- **A command a session runs** goes under
  [`commands`](configuration.md#commands), with a `factory`
  command in `src/commands.mts` that runs it, so a skill names the
  `factory` command and never the repository's own.
- **A plugin role** goes in `ROLES` and `ROLE_SHAPE` in `src/config.mts`,
  which say its phase, whether it takes a skill or an agent, one or a
  list, and `files` or `labels`. Its keys in `SETTINGS_KEYS` follow from
  that table. `docs/plugins.md` gains its table of what it is handed and
  what it returns.
- **A key that is renamed or moved** raises the settings' `version`.
  There is no command that converts a file: the older version is refused
  with a line that names a section of `docs/updating.md`, as version 1 is
  with "Moving to settings version 2", and that section shows each key
  before and after.

## Running from source

The tool is TypeScript, run directly by Node 22.18 or later with no build
step. In this repository, `npm ci` and then `node bin/factory.js`, or the
`factory` command installed on the machine, runs the source.

Node refuses to run TypeScript from inside `node_modules`, so an installed
package runs compiled JavaScript. `prepack` compiles `src/` to `dist/` with
`tsc`, and `src/` and `tests/` are not packed. The launcher, `bin/factory.js`,
serves both, and carries out what `chooseEntry` in `bin/launch.js` picks, in
this order:

1. The source in the repository it was run from: the first folder at or
   above the current directory that has `.git`, when that is this
   package's own repository: its `package.json` has this package's name.
   So a git worktree runs its own copy.
2. The version that repository names, in the `version:` line of its
   `.claude/factory.lock`, or `FACTORY_VERSION` when that is set, which is
   how `factory update` hands the sync to the newest release. That is the
   launcher's own copy when it is that version, and otherwise the copy in
   the cache, `~/.cache/software-factory/versions/VERSION/`, which the
   launcher downloads the first time with `npm install --prefix`. A
   version that is not a release, or cannot be downloaded, stops the
   command with a line that says so.
3. Itself, where no version is named: in a repository not set up yet,
   outside any repository, as in the poller's image, and for
   `factory update`, the command that changes the version a repository
   names. "Itself" is `src/cli.mts` beside the launcher, when it exists,
   and otherwise `dist/cli.mjs`.

The launcher reads the lock's version with a pattern, since it loads no
package to parse YAML with. [Which version runs](cli.md#which-version-runs)
is what a user is told.

Hooks here run the launcher by its path with `node`. In a repository that
uses the factory they run `factory` from the machine's `PATH`, and where
it is missing, the two guards block the call and print how to install it
(`factoryHooks` in `src/sync.mts`).

To prove the package works outside its host, CI packs the folder, installs
the tarball once as a machine does, and runs `factory sync`,
`factory sync --check`, `factory config check`, and `factory plugins`
in an empty repository, which must be left with no `package.json` and no
`node_modules`:

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

A skill or agent that the factory's own steps call is its core, and every
repository gets it. Anything else is written only when a setting or a
file in the repository turns it on: add it to `NEEDS` in `src/sync.mts`,
so a repository that does not use it never carries it.

**The workflows are source, not copies.** `.github/workflows/run.yml`,
`review.yml`, `session.yml`, and `poller.yml` are edited where they are,
and nothing copies them. A repository that uses the factory gets two files,
`.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`,
which `src/workflow-files.mts` writes from its settings: the default
branch, the parts that are on, the poller's schedule, each session's
minutes, and the names of its secrets. Each has one job, which calls
`run.yml` or `review.yml` in this repository at `@v` and the version the
lock names, and `run.yml` calls `session.yml` for each job that runs a
session. `factory init --org` writes a third file, into the repository
that holds an organization's preset: `.github/workflows/factory-poller.yml`,
from `pollerWorkflow` in the same module, which calls `poller.yml` at the
version it names. `tests/workflow-files.test.ts` shows each setting's
effect on the files, and `tests/workflows.test.ts` reads the four
workflows' YAML.

Where the key of an organization's App and its client ID reach a run,
each job that needs more than the workflow's own token makes one of the
App's, for the repositories `factory session repositories` prints, and
uses it in place of the build, board, and auto-merge tokens. Prepare and
Publish make theirs with `factory session token` (`src/session-token.mts`),
which signs the GitHub CLI and git in, and the others with
`actions/create-github-app-token`. The Session job makes none and is given
no key. A review is recorded, and the verdict posted, with the workflow's
own token.

A job that a part turns off carries an `if` on `inputs.parts`, so it is
skipped without starting a machine, and `partsOn` in `src/sync.mts` says
which setting turns each part on. Prepare asks `factory session ready`
whether there is work before it looks for a token. A change to one of the
four workflows reaches a repository only at the next release, since each
calls them at a version.

### A run in the cloud

`session.yml` is the three jobs of every run that uses the coding agent
([What a cloud run is](builds.md#what-a-cloud-run-is)), which `run.yml`
calls once for each kind. The skills are the same ones a session on a
machine follows, so nothing in a skill asks where it runs. The difference
is below the commands: `FACTORY_HANDOFF` names a folder, and where it is
set, every `factory` command works from that folder.

| File                | Who writes it                      | What it holds                                                                                    |
| ------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ |
| `in/run.json`       | Prepare                            | The run: its kind, ticket, pull request, branch, and the commit it starts from                   |
| `in/snapshot.json`  | Prepare                            | Each read it made ahead, by the method's name and its arguments                                  |
| `in/home.bundle`    | Prepare                            | The default branch, which the session starts in and can't change                                 |
| `in/work.bundle`    | Prepare                            | The same, and the branch the session works on                                                    |
| `out/request.json`  | Each `factory` command that writes | The commands asked for, with the text of each file they name                                     |
| `out/build.bundle`  | `factory pr push`                  | The commits                                                                                      |
| `clean/answer.json` | `factory session run`              | A review's answer, from what the agent itself printed, so no command of the session can write it |

- **A read** goes through the real adapter, wrapped twice in
  `src/handoff/replay.mts`: Prepare records each answer, and the session
  replays it. One nobody recorded throws `NotHandedError`, since an empty
  answer would be taken for the truth. A new read in a skill needs its
  command in `readsOf` in `src/session-prepare.mts`.
- **A write** is a command listed in `src/handoff/requests.mts`, which
  records it in place of running it. Publish runs only those `RULES` there
  names, with each argument checked against the run's own ticket and pull
  request, and every hidden marker taken out of the text but the ones the
  kind of run may post. A new write needs its name in both lists, and a
  flag it takes in its rule.
- **The commits** are checked by `src/handoff/bundle.mts`, in a bare clone,
  with hooks and the machine's git settings off. Nothing in them is checked
  out or run.
- **The sandbox** is the agent's own: `src/agent/claude-code-session.mts`
  writes its settings, which pass on the command line, so a repository's
  own settings can't loosen them.

A factory file must name nothing that belongs to the host repository: not
its paths, its commands, its subject, or its own skills. A test fails when
one does. That is what keeps the folder movable.

Nor does a skill, an agent, the rules, or the review's instructions name
one stack: a test runner, a framework, a package manager's commands, or a
branch called `main`. A skill runs `factory gate`, `factory test-one`,
`factory end-to-end`, and `factory specs check`, which run the repository's
own commands from its settings, and writes the default branch as the name
`factory default-branch` prints. `tests/boundary.test.ts` lists the words
it fails on. The three files written only for a website or an end-to-end
suite, `factory-ui-reviewer`, `factory-e2e-reviewer`, and `factory-design`,
may name a browser tool, and `factory-deps` npm's own files and commands,
since it works a dependency bot's pull requests.

## Adding a ticket system

Only GitHub is built. The factory is built so that a second system is an
addition, not a rewrite. Four rules keep it that way, and its setup is
[declared like any tool's](#setting-a-tool-up).

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

**3. The tool reads [`tickets.type`](configuration.md#tickets) and hands
the work to that type's adapter.** An adapter is one module in
`src/tickets/` that implements the `Tickets` type in
`src/tickets/types.mts`. `github` is the only one; any other value fails
`factory config check` and every ticket command with
`tickets.type "X" is not supported. "github" is the only ticket system built.`

| Operation               | In `Tickets`              | What it returns or does                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parse a key             | `key`                     | The key a person typed, or `KeyError` saying what a key looks like in this system. GitHub's are numbers, such as `12`, and `acme/api#12` for another repository's                                                                                                                           |
| Write a ticket          | `ref`                     | How the ticket is written in prose and output, such as `#12`                                                                                                                                                                                                                                |
| A key elsewhere         | `keyIn`, `home`           | The key as a checkout of another repository types it, and the repository the ticket lives in, or null in a system whose tickets live in none                                                                                                                                                |
| Read a ticket           | `read`                    | Its key, title, when the ticket system finished it (on GitHub, closed) or null, labels, body, comments, each with its ID, author, time, and body, and its record                                                                                                                            |
| List unfinished tickets | `listUnfinished`          | Key, title, and labels, for every ticket not finished, whatever its labels, however many there are                                                                                                                                                                                          |
| Read everything at once | `readAll`                 | Every ticket with the label it is given that is not finished, and the 30 with it finished most recently, as `read` returns each; with the board group, each carries its card                                                                                                                |
| Write a ticket's body   | `writeBody`               |                                                                                                                                                                                                                                                                                             |
| Comment                 | `comment`                 | Returns the comment's ID. Hidden markers pass through unchanged                                                                                                                                                                                                                             |
| Edit a comment          | `editComment`             | By its ID                                                                                                                                                                                                                                                                                   |
| Delete a comment        | `deleteComment`           | By its ID                                                                                                                                                                                                                                                                                   |
| Not found               | `NotFoundError`           | Reading a ticket that does not exist, or editing or deleting a comment that is gone, throws this, so a caller can tell it from any other failure                                                                                                                                            |
| Open a ticket           | `open`                    | With a title, a body, and labels. Returns its key                                                                                                                                                                                                                                           |
| Create a label          | `ensureLabel`             | Creates it where the ticket system needs a label to exist before it is used; nothing where it does not                                                                                                                                                                                      |
| Add or remove a label   | `addLabel`, `removeLabel` |                                                                                                                                                                                                                                                                                             |
| Who may decide          | `mayDecide`               | Whether a comment's author may decide on a ticket, so `factory ticket answers` takes their comment as an answer. GitHub's asks whether they can write to the repository. Rejects when it cannot say                                                                                         |
| Link text               | `linkText`                | What makes a merged pull request close the ticket, such as "Closes #12", and what says it builds part of one, "Part of #4"                                                                                                                                                                  |
| Links in a body         | `linksIn`                 | The tickets a pull request's body closes, and those it builds part of, each in the body's order                                                                                                                                                                                             |
| The address of a ticket | `address`                 | Its page, which the views link a ticket to                                                                                                                                                                                                                                                  |
| Finish a ticket         | `finish`                  | Marks it finished once the pull request that closes it merged. GitHub closes it if it is open                                                                                                                                                                                               |
| Statuses                | `statuses`                | Whether the ticket system has statuses of its own, which [`tickets.columns`](configuration.md#ticketscolumns) then maps with or without a board                                                                                                                                             |
| The record              | `record`                  | Adds, updates, removes, and reads the entries the factory records on a ticket: a claim, a start, a cost. Each is text and marker lines, and says whether a person must read it. GitHub's adapter keeps each as a comment; one that can hide them comments only for those a person must read |

No code above the adapter reads a marker out of a comment: the record is
the adapter's to keep, and `tests/memory-tickets.ts` with `strict` keeps
it apart from the comments, refusing hidden text in one, so a command
that went around it fails there.

**4. An adapter says which optional groups it has.** Each group is there
whole or not at all, and `factory ticket supports GROUP` prints `yes` or
`no`. A skill asks before it relies on one; a command that needs a group
its adapter lacks exits non-zero, names the group, and posts nothing.

| Group           | In `Tickets`   | Operations                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `board`         | `board`        | Read every card, with its place in the board's order, and the board's fields; list a board's columns, in the board's order; add a ticket to the board; move it to a column; set the factory's fields. Creating a board, adding columns, and adding fields are optional, and `factory init` names what to add by hand without them. Listing the repositories with a ticket in a column, `readyRepositories`, is optional too: an organization's poller needs it |
| `blockers`      | `blockers`     | List what a ticket waits on; record that it waits on another; remove that                                                                                                                                                                                                                                                                                                                                                                                      |
| `label-history` | `labelHistory` | Whether a label was ever removed from a ticket, which is how the factory knows the owner took `spec` off                                                                                                                                                                                                                                                                                                                                                       |
| `attachments`   | `attachments`  | Comment with images attached, or write a body with them                                                                                                                                                                                                                                                                                                                                                                                                        |
| `fields`        | `fields`       | List the ticket fields that hold text, with their descriptions; say whether a ticket can hold one, and how much; read a ticket's field values; set or clear them                                                                                                                                                                                                                                                                                               |

The GitHub adapter has every group, except that `attachments` needs the
GitHub CLI, so an adapter built without it has none. With
no board, state lives in the ticket's comments. With no blockers, the build
order is prose in the ticket and nothing enforces it.

The GitHub adapter's `fields` are issue fields, which it reads and
writes with the `repo` scope. With no fields group, every factory field
of a refined ticket stays in its description. `factory ticket view` and
`edit` join and split a ticket's document above the interface, so no
skill or agent knows whether a ticket has fields.

**The transport is a parameter.** The GitHub adapter, `src/code-host/`, and
`src/runner/` take one function for a REST call, one for a GraphQL query,
and one for an answer in plain text, such as a job's log
(`src/tickets/transport.mts`). `ghTransport` runs the GitHub CLI, for
sessions and CI. `fetchTransport` calls the API with a token, for the
poller, which runs with no `gh`: its image installs only the published
package.

What stays above the interface: working out a ticket's state from its
marker comments, costs, and the formatting of every view, in
`src/lib/work-status.mts` and the commands. They are the factory's own
logic, the same for any system. Nothing there writes `#` or reads a link
from a pull request's body itself: it asks the adapter. The code host's
own links, such as GitHub's closing references, count only when the
tickets are the code host's own (`src/lib/pull-tickets.mts`).

A second adapter exists from the start: an in-memory one,
`tests/memory-tickets.ts`, that every command's tests run against. It
keeps the interface honest, since anything the tests need has to go
through it. Its keys are numbers, as GitHub's are; with `strict` they are
keys like `PROJ-12`, and comment IDs and authors are opaque text, as Jira
and Linear give them, so a command that treats either as a number fails
there. The GitHub adapter has its own tests against recorded responses.

What an adapter does not cover: pull requests, reviews, and checks, which
are the code host's, and where an unattended build runs, which is the
runner's. Each has an interface of its own, described next, so a team can
keep its tickets in one system, its code on another, and run its builds on
a third.

## Adding a code host

The code host is where pull requests are. Only GitHub is built. The
settings name it with [`code-host.type`](configuration.md#code-host), and
`src/code-host/index.mts` hands a command the implementation of that name:
one module in `src/code-host/` that implements the `CodeHost` type in
`src/code-host/types.mts`. Any other value fails `factory config check`,
and every command that reads the settings and reaches a pull request, with
`code-host.type "X" is not supported. "github" is the only code host built.`

A command that a workflow also runs, such as `factory pr`, does not read
the settings there, so an unreadable settings file cannot fail the
workflow's step; it asks for the default. The poller you host has no
settings at all and names its implementations itself; a scheduled pass
reads the settings only for its board and Ready column.

| Operation                                | In `CodeHost`                                                 | What it returns or does                                                                                                                                                                                                                                                                                  |
| ---------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read a pull request; list the open ones  | `get`, `listOpen`                                             | Its number, title, state, whether it is merged or a draft, body, mergeable state, author, labels, head and base (commit, branch, repository), and auto-merge                                                                                                                                             |
| Open a pull request                      | `create`                                                      | From one branch into another, with a title and a body, as a draft or not. Returns its number, and fails in the code host's own words when the branch has nothing new or already has one open                                                                                                             |
| Find a pull request                      | `forBranch`, `forCommit`                                      | The open pull request from a branch, or none; the pull requests that hold a commit                                                                                                                                                                                                                       |
| What a pull request changes              | `files`, `mergeBase`                                          | Each file's path, its path before a rename, and its status; the commit two commits both descend from                                                                                                                                                                                                     |
| The default branch                       | `defaultBranch`                                               |                                                                                                                                                                                                                                                                                                          |
| The checks on a commit                   | `checkRuns`, `statuses`, `setStatus`                          | Check runs and commit statuses, kept apart because `factory deps` reads check runs alone and `factory pr watch` reads both; sets a status by name. A check run carries what the check wrote about its own result, when it wrote anything, and a status the account that set it, where the code host says |
| Conversation comments                    | `comments`, `commentView`, `comment`, `editComment`           | Each with its ID, author, time, and body. `comment` returns the new comment's ID, and hidden markers pass through unchanged                                                                                                                                                                              |
| Not found                                | `NotFoundError`                                               | Reading a pull request or a comment that does not exist throws this, the same error the ticket interface throws                                                                                                                                                                                          |
| Add or remove a label                    | `addLabel`, `removeLabel`                                     |                                                                                                                                                                                                                                                                                                          |
| Who added a label                        | `labeledBy`                                                   | The account that last added it, or null when the label is off or the code host does not say. The override counts only by this                                                                                                                                                                            |
| Reviews                                  | `reviews`, `reviewCommentsOf`, `reviewComments`               | Each review's ID, author, body, and time; the comments one review left on lines; every such comment on the pull request. A reply in a thread carries the comment it replies to                                                                                                                           |
| Review threads                           | `threads`, `openThreadCount`, `commentOn`, `reply`, `resolve` | Each thread's first comment, file and line, comments, and whether it is resolved or outdated. `commentOn` opens one on a line of a commit, or on the file where the line takes none, and says whether either would. `reply` and `resolve` take a comment's ID                                            |
| Write a body; mark ready                 | `setBody`, `ready`                                            |                                                                                                                                                                                                                                                                                                          |
| Commits not shown as signed              | `unverifiedCommits`                                           | One line for each, its short ID and the reason, which `factory pr ready` prints when it refuses                                                                                                                                                                                                          |
| A pull request's commits                 | `commits`                                                     | Each commit, and the account the code host itself verifies as its author, or null. Rejects when there may be more than it lists                                                                                                                                                                          |
| The tickets a pull request closes        | `closes`                                                      | Their numbers                                                                                                                                                                                                                                                                                            |
| The pull requests as the views read them | `open`, `linking`                                             | The open ones with their closing links, open threads, and check state; and those, open or not, that link to a ticket, which the board sync reads for cost notes                                                                                                                                          |
| The address of a pull request            | `address`                                                     | Its page, which the views link a pull request's number to                                                                                                                                                                                                                                                |
| What must pass before a merge            | `requireCheck`, `requiresStatus`                              | Requires a status before a merge to the default branch, as a rule of a given name, and with a source, counts that status only from the runner's own token. Says whether the rules that apply to a branch, the organization's among them, require a status                                                |
| A repository's properties                | `properties`, `setProperty`                                   | The repository's value for each property its owner defines, and sets one, which is how a repository comes under an organization's rule                                                                                                                                                                   |

There are no optional groups. Every operation is one a command uses
today, so a group is carved out on the day a second code host lacks one.

**An organization is reached before any repository is named.**
`factory init --org` is given an address and no checkout, so it asks
`organizationHosts` in `src/code-host/index.mts` for the code host that
serves the address: an `OrganizationHost`, whose `organization(name)`
returns an `Organization`, both in `src/code-host/types.mts`. GitHub's
is in `src/code-host/github.mts`, and its App's registration, tokens,
and sign-in are in `src/code-host/github-app.mts`.

| What it gives                        | In `OrganizationHost` or `Organization`                                                              | What it returns or does                                                                                                                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Whose address it is                  | `serves`, `ownerOf`, `addressOf`, `label`                                                            | Whether an address is on this code host, the owner it names, and an owner's address. An owner is an address, not one word, so a code host with nested owners fits                                                        |
| What the name is, and who is asking  | `kind`, `role`, `plan`, `signInLacks`                                                                | An organization, a person, or nothing; the signed-in account's place in it; whether its plan has organization-wide rules and shares secrets with private repositories; the permissions the sign-in lacks, with their fix |
| The repository that holds the preset | `repository`, `createRepository`, `file`, `putFiles`                                                 | A file already there is never replaced                                                                                                                                                                                   |
| Secrets and variables                | `secretNames`, `setSecret`, `variable`, `setVariable`                                                | Each for every repository of the organization. A value never appears in a command's arguments                                                                                                                            |
| What is required before a merge      | `defineProperty`, `ruleNames`, `requireCheckWhere`                                                   | A property each repository has a value for, and a rule that requires a check where the property has one value. What "required" means is the code host's to define                                                        |
| The organization's own app           | `appName`, `appNamed`, `registerApp`, `installation`, `awaitInstallation`, `installedOn`, `appsPage` | Registers an app from a form the person sends in a browser, hands its key over once, to `keep`, and finds where it is installed                                                                                          |

`init-org` names no code host: its lines say `host.label`, and its steps
are these members. A run's credential is the code host's too: GitHub
makes one from the App's key (`runToken`), and a code host that stores
one would read it. `tests/init-org.test.ts` runs the command against an
in-memory organization, and `tests/github-app.test.ts` has the App's
flow against faked replies.

**No skill, agent, or rule reaches the code host or the runner itself.**
Each runs a `factory pr` command, and a test fails when one names GitHub's
CLI, as a command or in a sentence. The review's instructions, `review.md`,
do the same, from the folder the session starts in, which is the default
branch and not the code under review.

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
that the tests of `pr`, `deps`, and `build` run against.
GitHub's has its own tests against faked replies, which is where a test
of which call GitHub is sent belongs.

## Adding a runner

The runner is where an unattended build runs. Only GitHub Actions is
built. The settings name it with [`builds.runner`](configuration.md#builds), and
`src/runner/index.mts` hands a command the implementation of that name:
one module in `src/runner/` that implements the `Runner` type in
`src/runner/types.mts`. Any other value fails `factory config check`, and
every command that reads the settings and reaches the runner, with
`builds.runner "X" is not supported. "github-actions" is the only runner built.`

| Operation                            | In `Runner`       | What it returns or does                                                                                                                    |
| ------------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Start a build of a ticket            | `startBuild`      | On a branch. A refused start throws the runner's own error, whose status and reason the poller's comment on the ticket carries             |
| Start an answer to a pull request    | `startAnswer`     | On a branch. The run answers what the pull request's checks or review found                                                                |
| How many answers it has had          | `answersTo`       | How many `startAnswer` has started for the pull request since it was opened, which is what limits them                                     |
| Start a Conflict or a Dependency run | `startOn`         | One session on one pull request, on a branch                                                                                               |
| Find the run a start made            | `findBuild`       | The page of the ticket's build started at or after a time, or nothing while none shows: a runner may answer a start with no run            |
| The page that lists builds           | `buildsPage`      | What `factory build` prints when the run is not found                                                                                      |
| The page of a run                    | `runPage`         | From the run's ID, which a ticket's claim comment records                                                                                  |
| The run this session is in           | `thisRun`         | Its ID, its page, and who started it, read from the session's environment; nothing outside a run                                           |
| The runs for a commit                | `runs`            | Each run's ID, which set of jobs it is a run of, what started it, its status and conclusion, and its `checksId`                            |
| The account a run posts as           | `poster`          | The account the run's own sign-in posts as, so a review's comment is told from anyone else's. GitHub Actions' is `github-actions[bot]`     |
| The folder of its job files          | `workflowsFolder` | The folder in a repository whose files say what the runner runs, which no session may change. GitHub Actions' is `.github/workflows`       |
| The review's runs for a commit       | `reviewRuns`      | Their status and conclusion, newest first                                                                                                  |
| Have the review run again            | `reviewAgain`     | The newest run of a commit's review, run again; false when none has run on it                                                              |
| The jobs that failed in a run        | `failedJobs`      | Each failed job's name and everything it printed. Which runs count is the caller's: `factory pr failed` takes those `wait-checks` waits on |

**A runner also needs its own job files, which no interface covers.**
`run.yml`, `review.yml`, `session.yml`, and `poller.yml` under
`.github/workflows/`, the files `src/workflow-files.mts` writes that
call them, and their secrets are GitHub Actions' own. `factory sync` writes the two files whatever
`builds.runner` says, and another runner would need its own set, written
for it.

Three things stay in GitHub Actions' words whatever the runner: the
factory's messages and comments say "GitHub Actions", the marker comments
on tickets say `actions`, and the board's "Runs in" field says "Actions".
The commands only a workflow runs (`review verdict`, `merge-policy`, and
those of `factory session`) read GitHub Actions' event file and its `GITHUB_*`
variables, and reach pull requests through the code host.

The in-memory runner is `tests/memory-runner.ts`, and GitHub Actions' has
its own tests against faked replies.

## Adding a spec tool

A spec tool keeps a copy of each ticket's Spec in the repository. Only
OpenSpec is built. The settings name it with
[`specs`](configuration.md#specs), and `src/specs/index.mts` hands a
command the adapter of that name: one module in `src/specs/` that
implements the `SpecTool` type in `src/specs/types.mts`. `none` needs no
adapter. Any other value fails `factory config check` with
`specs must be one of none, openspec`, which lists a new tool once its
adapter is registered.

**Nothing runs a spec tool except its adapter.** A skill never runs
`openspec` or any other tool's command. It runs `factory specs list`,
`new N`, `check`, and `finish N` ([Your repository's
commands](cli.md#your-repositorys-commands)), which print one line and
exit 0 with no spec tool, so a skill need not ask which is set. A test
fails when a factory skill, agent, rule, review instruction, or workflow
runs OpenSpec itself.

| What it gives                 | In `SpecTool`                     | OpenSpec's                                                                                                   |
| ----------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Its name in init's messages   | `name`                            | `OpenSpec`                                                                                                   |
| Its option in init's question | `label`                           | `OpenSpec: each ticket holds its spec, and each build also keeps it in openspec/specs/`                      |
| How init installs it          | `install`                         | `npm install --save-dev @fission-ai/openspec`, when `package.json` lists it in neither kind of dependency    |
| The check by default          | `defaultCheck`                    | `npx --no-install openspec validate --all --strict --no-interactive`                                         |
| Its environment               | `env`                             | `DO_NOT_TRACK=1`, so it collects no usage statistics                                                         |
| Its files that are process    | `processFiles`                    | `openspec/config.yaml`, which the merge policy always holds for the owner, whichever tool the settings name  |
| Whether it runs               | `runs`                            | `npx --no-install openspec --version` exits 0                                                                |
| The specs it keeps            | `list`                            | Each folder under `openspec/specs/` with a `spec.md`                                                         |
| A ticket's spec               | `folder`, `started`, `start`      | A change, `openspec/changes/issue-N/`, started with `openspec new change`                                    |
| The files to write            | `files`, `then`                   | The proposal, the spec deltas, and, for a ticket with the `spec` label, the design and tasks; then the check |
| Folding it in                 | `finished`, `finish`, `foldsInto` | `openspec archive`, into `openspec/specs/`; a change already archived counts as folded                       |

Other tools fill these differently: one that keeps a feature's spec in a
single page marks that page `update` rather than `new`, one with no
check of its own names a skill on the "Then:" line, and one that is not
an npm package installs with its own command. `tests/memory-tools.ts`
holds such a tool, `pagesSpecTool`, and the command and init tests run
against it too, so nothing outside `src/specs/` assumes OpenSpec.

A tool's own process, such as Spec Kit's `/speckit.clarify` or EGM's
review, is not part of the adapter: a team that wants it sets it as a
[plugin](plugins.md), as the refiner or a reviewer.

## Setting a tool up

A tool is a code host, a ticket system, a runner, or a coding agent. Each
says what it needs, so `factory init` sets it up, `factory doctor` checks
it, and `factory remove` takes it out, with no edit to those commands.
`src/tools.mts` registers each one by the name a setting gives it, with
how to open it and its setup, the `ToolSetup` type in `src/setup.mts`. A
code host also registers `repositoryOf`, the repository a remote's
address names, and `forkOf`, the repository one was forked from, which
is how `init` proposes the repository a checkout is for. The
names the settings accept are in `src/tool-names.mts`, and a test fails
when the two differ. Every member of a setup is optional.

| Member        | What it gives                                                                                                                                                                               | Used by                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `found`       | Its row under "Found", when it says more than the tool's name, such as where it was found                                                                                                   | `init`                                               |
| `steps`       | A value to write under the tool's block of the settings, or a secret: which parts read it, how to get it, and how to check a pasted one                                                     | `init`                                               |
| `checks`      | Its own lines in `doctor`: that it is reachable, signed in, or configured, each failure with its fix in the tool's words                                                                    | `doctor`                                             |
| `credential`  | A secret of more than one part, checked together, which a ticket system that is not GitHub also keeps on the machine                                                                        | `init`, `doctor`, `remove`, and every ticket command |
| `kept`        | The one secret among its steps that a person also keeps on their machine, for their next repository: the name it is filed under, what a line calls it, and every secret a job reads it from | `init`, `remove`                                     |
| `leftovers`   | What removing the factory leaves outside the repository, such as its secrets                                                                                                                | `remove`                                             |
| `unconfigure` | Its own files with the factory's part taken out, such as a coding agent's settings without the factory's hooks                                                                              | `remove`                                             |

**A value** is asked for once, after the parts are chosen, and written
under the tool's block: a ticket system's under `tickets`, which accepts a
key only when the ticket system in use declares it. **A secret** names the
parts that read it, or none when the tool always needs it. `init` asks for
it when one of those is not set, prints the tool's introduction, opens
its page or runs its command, reads it in a masked prompt, and stores it
through the runner under each name the tool gives. Its words are the
tool's: the prompt, the reason it refuses a value, and the line when
nothing is pasted.

**A secret a person keeps on their machine** is the one the tool's `kept`
names, and its step carries `machine`. In a repository a person owns,
`init` also writes it to the credentials file, filed under the tool and
`HOST/OWNER`, and in that person's next repository stores it from there
without asking, once the step's `machine.serves` says the value still
does for the parts that are on. In a repository an organization owns,
`init` asks for no such secret: the organization stores its own once.
GitHub's access token and Claude Code's token are the two. No other
command reads them, and no environment variable stands in for one.

**A credential** is a secret with more than one part, such as an email and
a token, checked together and stored under one name each: the `credential`
member of a setup, asked after its steps. A ticket system that is not
GitHub also keeps its credential on the machine: `init` writes it to
`~/.config/software-factory/credentials.yaml`, filed under the tool and
the value its setup names, such as `tickets.site`, and every command reads
it from there, or from an environment variable of the same name, which
takes priority. GitHub's tickets keep no credential there, since the
`gh` CLI's login does that job.

With more than one tool of a kind, `init` asks which, except for the code
host, which follows from the repository it is setting up: each code host
says which remotes are its own, and `init` reads every remote, asks
`forkOf` about each repository they name, and asks the person when they
name a fork or more than one. The coding agent has no setting until there is a
second.

A coding agent also runs a session in the cloud. What it is given is the
`CloudSession` type in `src/agent/types.mts`, and another agent confines
its commands its own way:

| What it gives      | For Claude Code, in `src/agent/claude-code-session.mts` | What it returns                                                                                                                                   |
| ------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| How it is confined | `sandboxSettings`                                       | The sandbox's settings: required, the hosts, the folders it may write, the ones it may not, and the agent's own credential kept from its commands |
| How it is started  | `sessionCommand`                                        | The command and its arguments, with the shape of the answer when the session is a review                                                          |

A coding agent also answers one question for `init`: given a prompt and
the shape of the answer as a JSON schema, it runs once, with no tools and
none of the repository's settings or hooks, and returns the answer or
the reason it has none. Claude Code runs `claude -p` on its smallest
model, from an empty folder. The prompts, the checks on the answers, and
what `init` prints live in `src/columns-suggest.mts` and
`src/ticket-fields.mts`, which name no agent and no ticket system, so a
second agent adds only its `answer`. `factory init` stops before its
first question when the coding agent's command isn't installed, by the
agent's `installed` method.

The tests show a tool that the factory does not ship going through all
three commands: `tests/fake-tools.ts` has a ticket system with a site
address and a token of its own, and a coding agent whose configuration is
one file.

## Checking a change

| Check                  | What it proves                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The tool's unit tests  | Each command does what it says, with coverage at or above the floors in `vitest.config.ts`, which only a build that deleted well-covered code may lower, saying so. A new test is seen failing before it is trusted                                                                                                                                             |
| `factory sync --check` | The copies match the source                                                                                                                                                                                                                                                                                                                                     |
| Pack and install       | CI packs the folder, installs the tarball once as a machine does, and runs `sync`, `config check`, and one read-only command in an empty scratch repository, which is left with no `package.json`. It works outside its host                                                                                                                                    |
| `factory-trace`        | A change to a rule did not make some kind of change heavier, lighter, or ambiguous                                                                                                                                                                                                                                                                              |
| Fork safety            | No `pull_request_target` or `workflow_run` job it runs or ships checks out a pull request's code, which would run a fork's code with secrets (`tests/fork-safety.test.ts`). A cloud run lays a pull request's branch out from a bundle, only for one from the same repository, and only on the Session job's machine, where nothing runs it outside the sandbox |
| One throwaway ticket   | After each stage, one small ticket goes through refine, build, and review for real. Nothing else tests the prose                                                                                                                                                                                                                                                |

The skills are instructions, and instructions cannot be unit tested. The
last row is the only real proof that a change to one still works.

## Releasing

1. On the Actions tab, run **Release** on `main` and choose the part of
   the version to raise: patch for fixes alone, minor for something new,
   and major for a change that breaks a repository using the factory. From
   0.1.2, they give 0.1.3, 0.2.0, and 1.0.0.
2. The run raises the highest `vX.Y.Z` tag by that part, and runs the
   whole CI on `main`'s commit, the same jobs a pull request gets. Only
   once they pass does it publish the version to npm, then the poller's
   image of that version to GitHub's container registry. Last, it tags the
   commit and creates a GitHub Release whose notes list the pull requests
   merged since the previous version. The tag is what each repository's
   two workflow files call `run.yml` and `review.yml` at, and the newest
   GitHub Release is how a repository's update job learns of a version.
   Those notes are the changelog, and the update's pull request in each
   repository links them, so a pull request's title is the line a user
   reads. When a release needs something done by hand in a repository
   that uses the factory, edit its GitHub Release as soon as the run
   ends, and put the steps first.
3. A run that stops partway has made no tag. Re-running its failed jobs,
   from the run's page, finishes it on the same commit and version, and
   does not publish to npm twice. A new run for a version npm already has
   stops and says so.
4. After the first release that publishes the image, pull it with no
   sign-in: `docker logout ghcr.io` and
   `docker pull ghcr.io/davidbyoung/software-factory-poller:VERSION`. If it
   is refused, set the package to Public on its GitHub page, once.

Nothing is committed for a release. `package.json` on `main` keeps the
version `0.0.0-development`, and the run writes the real one into its own
copy before publishing, so the tags and npm hold the released versions.

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
- **The factory's own words:** ticket, follow-up, the six states, the seven
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

### A page a reader follows

`README.md` and every page under `docs/` but this one is read by someone
who has never seen the factory and wants one thing done. `docs-reader`,
this repository's own reviewer, reads a changed page as that person.

- **A page says who it is for and what they will have at the end,** in its
  first lines.
- **The command is always written `factory ...`,** in a page, and in
  text a skill, hook, workflow, or session reads. It is installed once
  on a machine ([The CLI](cli.md#which-version-runs)), so nothing runs
  it through `npx`, and a test fails on a page that does.
- **Lead with the command that does it.** The same steps by hand go on a
  page of their own, linked once. A step that runs a skill shows its slash
  command, such as `/factory-refine 12`, not only words to say to a
  session: words leave the session to pick the skill, and leave the reader
  not knowing which one ran.
- **Say only what the reader must do or decide.** What a command does for
  them is one sentence, and a link to the page that lists it.
- **A setting links to its entry in `docs/configuration.md` where a page
  first names it.** A test fails on one that does not.
- **A setting the reader writes is shown as YAML they can paste,** with
  what each line is for.
- **A step ends with how the reader knows it worked.**
- **Each fact has one home.** Every other page links to it.
- **Write it as you would say it to a new teammate.** Whole sentences, a
  person doing each thing, and an example where the rule is abstract. A
  word the factory gives its own meaning, such as "the sync" or "a
  session", is explained or linked where the page first uses it. A table
  cell reads as part of a sentence, and no column repeats another. A
  column header names what its cells hold, such as "What it does" or
  "Without one", and reads on its own: not a pronoun or a clipped phrase,
  such as "It" or "Left out", that makes sense only once a cell is read
  into it.

### A command's output

A person reads it in a terminal, often while doing something else.

- **Precise and short.** A label and a value, or a mark and a few words,
  not a sentence explaining them. What a mark or a state word means is
  said once, in `docs/cli.md`.
- **A block is headed by the setting it shows,** such as
  [`tickets.fields`](configuration.md#ticketsfields), so the reader knows
  what to edit.
- **The marks mean one thing everywhere:** ✓ works, ✗ needs fixing,
  ? worth a look, - off on purpose.
- **A fault sits on the line it is about,** with the fix after it.
- **Success prints one line.** Silence reads as nothing happened.
- **A command is named as `factory X`,** as the docs write it.
- **A look has one meaning, and a line asks for the meaning.** A command
  prints through [`src/lib/output.mts`](../src/lib/output.mts), which
  holds the one table of looks, and nothing else prints or colors. Each
  look is below by its name in the code.

  | Role       | Look            | What it says              | Where it shows                                                                                                                                                                                   |
  | ---------- | --------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `heading`  | Bold underlined | A heading                 | What names a block or a table's columns                                                                                                                                                          |
  | `name`     | Bold            | The name of what follows  | A row's label, a question, a new value after an arrow, and the one name a line is about, such as the repository in a command's first line                                                        |
  | `skip`     | Dim             | Skip it                   | `none yet`, an old value, a `-`, that work is running, a setting left at its default, and the times and pull request lines in `status`. Never a label, and never a line that asks for something  |
  | `copy`     | Cyan            | Copy it, or you chose it  | A command, an address, a `/factory-...` skill, a ticket's number, the choice under the cursor, and the answer given                                                                              |
  | `yourTurn` | Yellow          | Your turn                 | An open question's `?`, a list of what the person does and its step numbers, `Waiting on you`, and `?` for worth a look. Never bold, which many terminals draw too bright for a white background |
  | `good`     | Green           | It worked, or was added   | `✓` and `+`                                                                                                                                                                                      |
  | `bad`      | Red             | It failed, or was removed | `✗`, `−`, `⚠`, and the first words of a failure that has no mark, up to its colon                                                                                                                |

  The text after a mark is plain, except a command, an address, or the
  name the line is about.

- **A line says what it is:** `heading`, `heads` for a table's column
  names, `row` for a label and a value, `cells` for a row of more, `step`
  for one of a list the person does, `action` for what heads that list,
  `mark`, `note` for work that is running, `verbatim` for another tool's
  output or a settings file's lines, and `text` for the rest. A `factory`
  command, an address, a skill, a mark that starts a line, and a failure's
  first words color themselves in all but `verbatim`. Another tool's
  command is `copy`, and a person's own words, such as a ticket's title,
  are `asIs`.
- **A command is a person's or a machine's:** its entry in
  `src/commands-list.mts` says which reads its output. A machine's is
  never in color.
- **A command's test prints through `into`,** in `tests/printed.ts`, which
  fails on a row or a step printed as `text`.
- **Piped output is the same text,** without color. Lines a skill reads
  keep their format.
- **Another tool's output passes through unchanged.** The factory adds
  its own line after it, never rewrites it.
