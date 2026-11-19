# Configuration

This page is for changing what the factory does in your repository once it
is set up. Everything you can change is in one file,
`.claude/factory.yaml`, which [`factory init`](github/setup.md) writes when
you set the factory up. You don't need to read this page top to bottom:
start with
[the settings most repositories change](#the-settings-most-repositories-change),
and look up any other setting under [Every setting](#every-setting).

## Words this page uses

- **Session:** one conversation with the coding agent, such as Claude
  Code, working in your repository. A session on your own machine is a
  local session. One that runs in the cloud with nobody at the keyboard is
  an unattended session.
- **Build:** a session taking one approved ticket to a pull request.
- **The cloud runner:** where the factory's unattended work runs. Today
  that is GitHub Actions.
- **The board:** a GitHub Project showing each ticket's state as a column.
  It is optional.
- **The board sync:** a job on the cloud runner that moves each ticket to
  its column on the board and fills in its fields. It is the only thing
  that writes to the board.
- **`factory sync`:** a command you run. It copies the factory's skills,
  agents, rules, and workflows into your repository, choosing which ones
  from this file. It has nothing to do with the board sync.
- **Skill and agent:** a skill is a set of instructions a session follows,
  and an agent is a separate reviewer a session launches to read something
  and report back.

The [glossary](glossary.md) has the rest.

## How the file works

- **Two settings are required, and a third before any build.** Every
  file has [`version`](#version) and [`repository`](#repository), and a
  session can't build a ticket until you set
  [`commands.gate`](#commandsgate). Every other setting has a default, and
  you write it only when you want something else.
- **It holds only what a script needs.** Anything that needs judgment,
  such as when one of your reviewers should apply, goes in the
  instructions your coding agent already reads, such as `CLAUDE.md`.
- **File patterns are globs.** `*` matches within one folder and `**`
  matches across folders. Both match names that start with a dot. A
  pattern with no wildcard matches that one path from the repository's
  root.
- **A command is one line of shell.** Each runs with bash, from the
  repository's root. Only the commands under [`site.checks`](#site) and
  [`auto-merge.commands`](#auto-merge) are given anything on their
  standard input, and their entries say what.
- **Some settings choose between tools, and name the tool with `type`.**
  When `type` is the only thing in the block, you can write the tool's
  name on the same line. These two mean the same:

  ```yaml
  specs: openspec
  ```

  ```yaml
  specs:
    type: openspec
  ```

- **Your comments are kept.** `factory init` writes a comment above each
  section, and updates never remove yours.

## The shortest file

```yaml
version: 2
repository: your-name/your-repo
```

With only this, the factory refines a ticket when you run `/factory-refine N` in a session,
nothing merges without you, and there is no board. Before a session can
build a ticket, you also need to tell it how to check a change:
[`commands.gate`](#commandsgate), below.

## The settings most repositories change

- **How to check a change:** your tests, linter, and type check, under
  [`commands.gate`](#commandsgate). A build cannot finish without it.
- **Quick checks before every commit:** your formatter and the other
  checks that take a few seconds, under
  [`commands.before-commit`](#commandsbefore-commit).
- **A board:** your GitHub Project's number, under
  [`tickets.board`](#tickets).
- **What may merge without you:** for example your docs, under
  [`auto-merge.allow`](#auto-merge).
- **Reviewers of your own:** an agent you wrote, which reads a change that
  touches certain files, under
  [`plugins.build.reviewers`](#pluginsbuild). [Plugins](plugins.md) has a
  worked example.

**After you change the file,** run:

```bash
factory config check
factory sync
```

`factory config check` prints nothing when the file is valid, and names
the setting when it is not. `factory sync` then rewrites the copied files
that depend on what you changed, and lists each file it wrote. A change
under `plugins` alone needs no `factory sync`, since the factory reads
your plugins from this file each time.

## Every setting

### `version`

Which layout of this file you are using. It is not the factory's version.
Write `2`.

- **Default:** none. `factory init` writes it.
- **If it is wrong,** every factory command that reads this file stops
  with `version: must be 2`. For a version 1 file, it also says where
  [Updating](updating.md#moving-to-settings-version-2) shows each setting
  that moved.

### `repository`

Your repository, as `owner/name`, such as `harbor-goods/storefront`.

- **Default:** none. `factory init` writes it.
- **If it is wrong,** commands read and write another repository's
  tickets, or fail because it does not exist.

It is written down rather than worked out from your checkout, because the
[poller](#builds), which watches your board from outside any checkout,
needs it too.

### `tickets`

Where your tickets live, and which board shows them.

```yaml
tickets:
  type: github
  board: 1
```

- **`type`** is the ticket system. Only `github` is built, and it is the
  default.
- **`board`** is your GitHub Project's number: the last part of its
  address, such as `1` in `github.com/users/your-name/projects/1`. The
  default, `none`, means no board.

Without a board, `factory status` still shows every ticket's state, which
the factory keeps in comments on the ticket. Builds then start only when
you run `/factory-build N` in a session.

One board can show tickets from several repositories. Give each
repository the same `board`. Each repository's board sync,
`factory status`, and poller only touch that repository's own tickets.

`factory board check` reads your board and says what the factory will do
with it.

#### `tickets.columns`

The board has one column for each of the six
[states](workflow.md#the-six-states) a ticket goes through. If your
board's columns have the factory's names, write nothing here. If they have
other names, or your board has fewer columns, say which column shows each
state. A new GitHub Project starts with only Todo, In Progress, and Done,
so its settings would be:

```yaml
tickets:
  board: 7
  columns:
    backlog: Todo
    building: In Progress
    done: Done
    refining: none
    ready: none
    review: none
builds:
  trigger: manual
```

The factory's own names, used for any state you leave out, are:

| State      | Column the factory looks for |
| ---------- | ---------------------------- |
| `backlog`  | Backlog                      |
| `refining` | In refinement                |
| `ready`    | Ready                        |
| `building` | In progress                  |
| `review`   | In review                    |
| `done`     | Done                         |

- **Capitals don't matter,** so "In progress" finds your "In Progress".
- **`none` means your board has no column for that state.** A ticket in
  that state stays in the column of the state before it. With
  `review: none`, a ticket whose pull request is in review stays in In
  progress. Every state can be `none` except `backlog`.
- **A ticket never falls back into Ready,** since only a ticket you
  approved goes there, so the fallback skips it. With `building: none`
  alone, a ticket being built has no column of its own, the state before
  building is ready, and Ready is skipped, so it shows in In refinement.
- **With `ready: none`, nothing on the board approves a build,** so you
  need `builds.trigger: manual`, and you start each build by asking a
  session.
- **A ticket in a column no state uses is left alone.** The board sync
  doesn't move it or fill in its fields, and nothing builds it.
- **If you host your own poller** and rename the Ready column, the poller
  needs the new name too: see `FACTORY_READY_COLUMN` in
  [Builds](builds.md#what-it-reads-from-its-environment).

`factory config check` stops on a state it doesn't know, on
`backlog: none`, on two states sharing one column, on `columns` without a
`board`, and on `ready: none` when `builds.trigger` isn't `manual`. It
doesn't read your board: `factory board check` does.

#### `tickets.fields`

Besides moving a ticket between columns, the board sync fills in three
fields so you can see at a glance what is happening to it:

- **Session:** which session is working on the ticket, or "Waiting on
  you".
- **Runs in:** whether that session is on someone's machine or in the
  cloud.
- **Cost:** roughly what refining and building the ticket has cost so far.

`factory init` adds these three fields to your board, so most repositories
write nothing here. Write this block only when your board already has a
field you want used instead, or to stop the board sync filling one in:

```yaml
tickets:
  board: 7
  fields:
    session: Agent # fill in your existing "Agent" field instead
    cost: none # never fill in a cost
```

- **A field you name must exist,** holding the right kind of value: text
  for Session, a single select with the options Local and Actions for Runs
  in, and a number for Cost. If it doesn't, the board sync stops and says
  which field is wrong.
- **When you name nothing,** the board sync looks for fields called
  Session, Runs in, and Cost, fills in those it finds, and skips the rest
  with a note.
- **It never overwrites a field of yours.** If your board has a field
  called Cost that holds text, the board sync stops rather than write over
  it, and asks you to name another field or write `cost: none`.
- **The column itself is the board's own Status field,** which has to be
  a single select with an option for each column in
  [`tickets.columns`](#ticketscolumns).

### `code-host`

Where your repository and its pull requests live. Only `github` is built,
and it is the default, so most files leave this out.

```yaml
code-host: github
```

### `builds`

What starts a build when you approve a ticket, and where the build runs.

```yaml
builds:
  trigger: own-server
```

| Setting        | What it sets                                          | Choices                                 | Default          |
| -------------- | ----------------------------------------------------- | --------------------------------------- | ---------------- |
| `trigger`      | What notices you moved a ticket to Ready on the board | `manual`, `own-server`, `github-action` | `manual`         |
| `runner`       | Where a build in the cloud runs                       | `github-actions`                        | `github-actions` |
| `poll-minutes` | With `github-action`, how often it checks the board   | 5, 10, 15, 30, or 60                    | 5                |

The three triggers:

- **`manual`:** nothing watches the board. You build a ticket by running
  `/factory-build 12` in a session.
- **`own-server`:** a small program you host, the poller, checks the board
  once a minute and starts a cloud build for each ticket in Ready.
  [Hosting the poller](builds.md#hosting-the-poller-own-server) shows how
  to run it.
- **`github-action`:** a schedule on GitHub Actions does the same every
  `poll-minutes` minutes, with nothing for you to host. On a private
  repository, each check is billed as at least one Actions minute.
  `factory sync` adds its workflow.

Watch the spelling: the trigger is `github-action`, singular, and the
runner is `github-actions`, plural.

Whatever starts it, a cloud build runs on the cloud runner.
[Builds](builds.md) explains each trigger. **It worked when** a ticket you
move to Ready shows as In progress on the board within a few minutes. If
nothing is watching the board, a ticket you move to Ready just sits there, and `factory status`
marks it "not started": after 5 minutes with `own-server`, and after
`poll-minutes` plus 15 minutes with `github-action`.

`factory config check` stops on `poll-minutes` with any trigger but
`github-action`, and on any value but the five above.

### `specs`

Whether a change your users will see also gets a written spec, kept beside
your code.

```yaml
specs: openspec
```

- **`none`,** the default: the ticket's acceptance criteria are the only
  spec.
- **`openspec`:** a visible change that isn't
  [small](workflow.md#sizing-the-work-to-the-change) also writes its new
  behavior into `openspec/specs/`, using
  [OpenSpec](https://github.com/Fission-AI/OpenSpec), so that folder
  always describes what your project does. Install it first, with
  `npm install -D @fission-ai/openspec`. Without it, a build stops at its
  first spec step and says so.

#### `specs.check`

The command that checks your written specs are sound.
`factory specs check` runs it, and so does a build each time it writes a
spec.

```yaml
specs:
  type: openspec
  check: npx --no-install openspec validate --all --strict --no-interactive
```

- **Default:** the command above,
  `npx --no-install openspec validate --all --strict --no-interactive`,
  with `type: openspec`, so most repositories leave it out.
- **It runs with `DO_NOT_TRACK=1` set,** so OpenSpec collects no usage
  statistics.
- **With `specs: none`** there is nothing to check, and writing `check`
  fails `factory config check`.

### `commands`

The commands that are your project's own: how a session checks a change,
runs one test, and so on. The factory's skills never name a test runner or
a linter. They run `factory gate`, `factory test-one`, and the like, which
run what you write here.

```yaml
commands:
  build-setup:
    - npx playwright install --with-deps chromium
  before-commit:
    - npm run -s format:check
    - npx tsc --noEmit
  gate:
    - npm run check
  test-one: npx vitest run $FILE -t "$NAME"
  end-to-end: npx playwright test $FILE
  coverage:
    run: npm run coverage
    report: coverage/lcov.info
  relock: npm install
```

| Setting         | Runs                                                             | Default                    |
| --------------- | ---------------------------------------------------------------- | -------------------------- |
| `build-setup`   | Before a cloud build starts work                                 | none                       |
| `before-commit` | Before every commit a session makes                              | none                       |
| `gate`          | Before a session calls a task done                               | none, and a build needs it |
| `test-one`      | When a session runs one test alone                               | none                       |
| `end-to-end`    | When a session runs one end-to-end test file alone               | none                       |
| `coverage`      | When a session checks that a pull request's new lines are tested | none                       |
| `relock`        | After a conflict in your lock file                               | `npm install`              |

- **`$FILE` and `$NAME`** are set for you when a command runs one test.
  [`commands.test-one`](#commandstest-one) says how.
- **Only `gate` is needed for a build.** Each of the others turns
  something on, and its entry below says what happens without it.
- **A list runs in order and stops at the first command that fails.**

#### `commands.build-setup`

Commands that run before a cloud build starts work, to install what the
session will need. Your npm dependencies are already installed by then,
with `npm ci`, but nothing else is.

```yaml
commands:
  build-setup:
    - npx playwright install --with-deps chromium # a browser for end-to-end tests
```

In a project that isn't JavaScript, install its dependencies here too,
such as `composer install` or `pip install -r requirements.txt`.

- **Default:** none.
- **If one fails,** the build stops before the session starts, and the
  run's log shows that command's output.

#### `commands.before-commit`

Quick checks that run before every commit a session makes. If one fails,
the commit is blocked and the session sees why.

```yaml
commands:
  before-commit:
    - npm run -s format:check
    - npx tsc --noEmit
    - npm run -s lint
```

- **Default:** none.
- **Keep them to a few seconds.** They run on every commit. Your tests
  belong in [`commands.gate`](#commandsgate), which runs once per task.
- **They only apply to a session's commits,** not to commits you make
  yourself.

#### `commands.gate`

The checks a change has to pass before a session calls it done or opens a
pull request. Think of it as what your CI runs on a pull request, minus
anything too slow for a session to sit and wait for. `factory gate` runs
them in order and stops at the first failure, so put the fastest first.

If you already have one command that runs every check, such as
`npm run check` or `make check`, the gate can be just that:

```yaml
commands:
  gate:
    - npm run check
```

Otherwise, list each check. What that looks like in a few languages:

```yaml
# JavaScript or TypeScript
gate:
  - npm run format:check
  - npm run lint
  - npx tsc --noEmit
  - npm test
```

```yaml
# Python
gate:
  - ruff format --check .
  - ruff check .
  - mypy src
  - pytest -q
```

```yaml
# Go
gate:
  - test -z "$(gofmt -l .)"
  - go vet ./...
  - go test ./...
```

```yaml
# PHP
gate:
  - composer validate --strict
  - vendor/bin/php-cs-fixer fix --dry-run --diff
  - vendor/bin/phpstan analyse
  - vendor/bin/phpunit
```

```yaml
# Rust
gate:
  - cargo fmt --check
  - cargo clippy -- -D warnings
  - cargo test
```

Leave out:

- **Anything that changes files,** such as `prettier --write`. The gate
  checks a change; it doesn't fix it.
- **A test suite that takes many minutes,** such as a full browser suite.
  CI still runs it on the pull request.
- **Anything that needs production secrets, or deploys.**

There is no default. Without a gate, `factory gate` fails with
`commands.gate is not set`, and a build stops there, because an empty gate
would pass every change. `factory init` lists it under "Left to do".

When a command fails, `factory gate` prints `gate failed on:` and the
command, and runs none after it. The session fixes the cause and runs the
gate again.

**Check your gate yourself** before a session relies on it: run
`factory gate` on a clean checkout. It should print each command and exit 0. `factory config check` only checks that the file is valid, not that
your commands work.

#### `commands.test-one`

Runs one test file alone, or one test in it. A session uses it to watch a
new test fail before the change, and to narrow down a bug.
`factory test-one FILE NAME` runs your command with `$FILE` and `$NAME`
set. When only a file is given, `$NAME` is empty, so the command should
run the whole file then:

```yaml
commands:
  test-one: npx vitest run $FILE -t "$NAME" # an empty -t runs every test
```

```yaml
commands:
  test-one: vendor/bin/phpunit $FILE ${NAME:+--filter "$NAME"} # --filter only with a name
```

- **Default:** none. `factory test-one` then fails with
  `commands.test-one is not set`, and a session finds its own way to run
  one test.

#### `commands.end-to-end`

Runs one end-to-end test file alone, with `$FILE` set.
`factory end-to-end FILE --times 10` runs it ten times and stops at the
first failure, as `failed on run 3 of 10`. A build does that with each new
end-to-end test, since one that fails one run in ten will fail someone's
pull request.

```yaml
commands:
  end-to-end: npx playwright test $FILE
```

- **Default:** none. Leave it out if you have no end-to-end tests.
- **Setting it makes `factory-e2e-reviewer` available,** the factory's
  reviewer for browser tests. To use it, run `factory sync`, then list it
  under [`plugins.test.reviewers`](#pluginstest). That list replaces the
  default, so list `factory-test-reviewer` there too.

#### `commands.coverage`

The command that measures test coverage, and where it writes its lcov
report. A session working on a pull request's review runs it to find new
lines no test covers.

```yaml
commands:
  coverage:
    run: npm run coverage
    report: coverage/lcov.info
```

- **Default:** none, and a session doesn't check coverage.
- **Write both `run` and `report`,** or neither.

#### `commands.relock`

The command that rebuilds your package manager's lock file. When the lock
file conflicts with the default branch, a session takes the default
branch's copy and runs this, instead of merging the file by hand.

```yaml
commands:
  relock: composer update --lock
```

- **Default:** `npm install`.
- **Another generated file that conflicts,** such as a generated API
  client, needs a [resolver](#pluginsconflicts).

### `session-minutes`

How long each kind of unattended session may run, in minutes, before the
cloud runner stops it. Raise one if your tests or your build are slow
enough that sessions are cut off mid-task.

```yaml
session-minutes:
  build: 300
```

| Setting        | Limits the session that is                                | Default |
| -------------- | --------------------------------------------------------- | ------- |
| `build`        | Building a ticket                                         | `230`   |
| `conflicts`    | Fixing a pull request's conflicts with the default branch | `110`   |
| `review`       | Answering your review of a pull request                   | `50`    |
| `dependencies` | Working through dependency updates                        | `50`    |

- **Each is a whole number above zero.**
- **Run `factory sync` after changing one,** since it writes them into the
  workflows. `factory config check` fails until you do.
- **GitHub may stop a job sooner:** see
  [its limits](github/reference.md#limits).

### `plugins`

Your own skills and agents, doing a job the factory would otherwise do
itself, or adding to it. Each job is a **role**. For example, an agent you
list in the `reviewers` role reads every change that touches its files,
alongside the factory's own reviewers. Roles are grouped by the part of
the work they belong to: `refine`, `build`, `test`, and `conflicts`.

```yaml
plugins:
  build:
    reviewers:
      - agent: migration-reviewer # .claude/agents/migration-reviewer.md
        files:
          - db/migrations/**
```

Every role is optional. Leaving one out never turns a step off: the
factory does that step its own way. A reviewer is an agent, since it only
reads and reports. Every other role takes a skill, which the session
follows itself. [Plugins](plugins.md) says what each role is handed and
what it has to give back.

| Role                  | What you list | How many | When it is used                                                                               | If you list none                                                                                                    |
| --------------------- | ------------- | -------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `refine.refiner`      | A skill       | One      | Whenever a ticket is refined                                                                  | `factory-refine` refines tickets                                                                                    |
| `refine.mockups`      | A skill       | One      | Whenever a decision changes how something looks                                               | `factory-design` draws mockups if you set [`site`](#site), and otherwise the session describes the choices in words |
| `build.builders`      | Skills        | A list   | For a ticket with one of the builder's `labels`. Each builder needs at least one              | The factory's own build builds every ticket                                                                         |
| `build.reviewers`     | Agents        | A list   | When a change touches one of the reviewer's `files`. Each reviewer needs at least one pattern | Only the factory's own reviewers read a change                                                                      |
| `test.prover`         | A skill       | One      | Whenever a new test needs proof that it can fail                                              | `factory-mutate` proves each new test can fail                                                                      |
| `test.reviewers`      | Agents        | A list   | When a change touches tests. A reviewer given `files` reads only changes to those             | `factory-test-reviewer` reads new tests                                                                             |
| `conflicts.resolvers` | Skills        | A list   | When a conflict is in one of the resolver's `files`. Each resolver needs at least one pattern | The session merges conflicts by hand, and [`commands.relock`](#commandsrelock) rebuilds the lock file               |

In Claude Code, a skill lives at `.claude/skills/NAME/SKILL.md` and an
agent at `.claude/agents/NAME.md`:
[Skills in Claude Code](github/reference.md#skills-in-claude-code).

- **`factory plugins`** prints every plugin the factory will use, its own
  included, one per line: skill or agent, its name, its role, and its
  files or labels. `factory plugins reviewer` prints one role's.
- **`factory config check`** stops on an agent in a role that takes a
  skill, or the other way round; on `files` or `labels` in a role that
  doesn't take them; on a builder with no `labels`; on a build reviewer or
  resolver with no `files`; and on a skill or agent whose file doesn't
  exist. It warns on a `files` pattern that matches no file.

#### `plugins.refine`

- **`refiner`:** your own skill for refining a ticket, used instead of
  `factory-refine`.
- **`mockups`:** your own skill for drawing the choices when a decision
  changes how something looks.

A role that takes one plugin is a block, not a list:

```yaml
plugins:
  refine:
    refiner:
      skill: acme-refine # .claude/skills/acme-refine/SKILL.md
    mockups:
      skill: design-mockups
```

#### `plugins.build`

- **`builders`:** your own skill for building certain tickets, used
  instead of the factory's build for any ticket with one of its `labels`.
  If two builders share a label, the first one listed builds the ticket.
- **`reviewers`:** your own agents, each asked to read a change that
  touches a file matching its `files`. The pattern only decides who is
  asked: the agent's own description says when it really applies. One
  that was asked but didn't apply gets a line in the pull request saying
  why.

```yaml
plugins:
  build:
    builders:
      - skill: add-endpoint
        labels:
          - new-endpoint
    reviewers:
      - agent: migration-reviewer
        files:
          - db/migrations/**
```

#### `plugins.test`

- **`prover`:** your own skill for proving a new test can fail, used
  instead of `factory-mutate`.
- **`reviewers`:** the agents that read new and changed tests. **This list
  replaces the default,** so `factory-test-reviewer` runs only if you list
  it, and `reviewers: []` means no test reviewer runs. Without `files`, a
  reviewer reads every change to tests; with `files`, only changes to
  matching files. `factory-e2e-reviewer` needs
  [`commands.end-to-end`](#commandsend-to-end).

```yaml
plugins:
  test:
    prover:
      skill: acme-mutation
    reviewers:
      - agent: factory-test-reviewer
      - agent: factory-e2e-reviewer
        files:
          - e2e/**
```

#### `plugins.conflicts`

- **`resolvers`:** your own skills for files that should be rebuilt rather
  than merged by hand after a conflict, such as a generated API client.
  Each handles the files matching its `files`. If two match one file, the
  first one listed rebuilds it.
- **A new resolver is used once it has merged,** since conflicts are fixed
  using the default branch's copy of this file, never a pull request's.

```yaml
plugins:
  conflicts:
    resolvers:
      - skill: regenerate-api-client
        files:
          - src/generated/**
```

### `site`

How the factory looks at your website, if your repository is one. With
`site` set and `factory-ui-reviewer` listed under
[`plugins.build.reviewers`](#pluginsbuild), every change that alters how
the site looks is screenshotted before and after, and the difference is
reviewed. The screenshots are taken with Playwright, so install it in
your repository first, with `npm install -D playwright`. Until you do,
`factory config check` fails on a file with `site`.

Most sites need only two lines:

```yaml
site:
  start: npm run build && npx serve out -p $PORT
  url: http://localhost:$PORT
```

**It worked when** `factory site compare` builds your branch and the
default branch, takes the screenshots, and prints where it saved them.
[`factory site`](cli.md#factory-site) has the details.

Every setting `site` takes:

| Setting         | What it sets                                                                                                      | Default                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `start`         | A command that builds and serves the site, with `$PORT` set for it. Required                                      | none                                                                 |
| `url`           | The address `start` serves the site at. Required                                                                  | none                                                                 |
| `design-guide`  | A file of your own design rules, checked on top of the factory's                                                  | none                                                                 |
| `pages`         | A list of paths to look at                                                                                        | The pages in `/sitemap.xml`, or else the ones the home page links to |
| `widths`        | A list of screen widths, in pixels                                                                                | `[390, 1280]`                                                        |
| `hide`          | A list of CSS selectors hidden before each screenshot, for something that floats over the page                    | none                                                                 |
| `checks`        | A list of your own measuring commands, described below                                                            | none                                                                 |
| `max-pages`     | How many changed pages the reviewer reads closely                                                                 | `4`                                                                  |
| `start-minutes` | How long to wait for the site to answer after `start` runs                                                        | `5`                                                                  |
| `accessibility` | The WCAG level changed pages are checked against: `wcag22aa`, `wcag21aa`, `wcag2aa`, or `none`                    | `wcag22aa`                                                           |
| `new-values`    | Whether the review points out font sizes, colors, spacing, and corner radii that the rest of the site doesn't use | `true`                                                               |

The optional ones that take a list are written like this:

```yaml
site:
  start: npm run build && npx serve out -p $PORT
  url: http://localhost:$PORT
  pages:
    - /
    - /pricing
  hide:
    - .chat-widget
  checks:
    - node scripts/check-tap-targets.mjs
```

**A command under `checks`** is given one JSON object on its standard
input: `before` and `after`, the two sites' addresses; `pages`, the paths
that changed; and `report`, the folder of screenshots. Each line it prints
is reported as a finding. Its exit code is ignored.

### `auto-merge`

Which pull requests may merge without you reading them.

```yaml
auto-merge:
  allow:
    - docs/**
    - src/components/**
    - tests/**
  deny:
    - src/components/checkout/**
  commands:
    - node scripts/public-api-changed.mjs
```

A pull request merges itself only when **all** of these hold:

1. every file it changes matches a pattern under `allow`;
2. no file it changes matches a pattern under `deny`;
3. every command under `commands` exits 0;
4. CI passes. With [`pr-review`](#pr-review) on, that includes the
   automated review finding it ready.

Otherwise it waits for you, and the pull request says why.

- **By default every list is empty, so nothing merges without you.**
- **`deny` carves exceptions out of `allow`,** and always wins.
- **Some files always wait for you,** whatever `allow` says: the
  factory's own, which are everything under `.claude/` and `.github/`,
  every `CLAUDE.md` and `AGENTS.md`, and `openspec/config.yaml`.
- **Start with a short `allow` list** and add to it. Too wide a list
  merges changes you meant to read.
- **`factory config check` warns about a pattern that matches no file,**
  since a stale pattern is how a policy quietly stops meaning anything.

**A command under `commands`** is your own check. It runs once for each
pull request, from a checkout of your default branch, never the pull
request's, and reads one JSON object on its standard input:

```json
{
  "repository": "harbor-goods/storefront",
  "pull": 42,
  "base": "the commit the pull request branched from",
  "head": "the pull request's newest commit",
  "files": [
    {
      "filename": "src/a.ts",
      "previous_filename": "src/b.ts",
      "status": "renamed"
    }
  ]
}
```

It exits 0 to let the pull request merge, and anything else to hold it for
you. Each line it prints is shown as a reason.

What a held pull request says, one line for each file or command that held
it:

| The status says                        | Why                                             |
| -------------------------------------- | ----------------------------------------------- |
| `PATH: the factory's own files`        | The file is one of the factory's, listed above  |
| `PATH: held by auto-merge.deny`        | The file matches `deny`                         |
| `PATH: not in auto-merge.allow`        | The file matches nothing in `allow`             |
| What your command printed              | Your command exited with something other than 0 |
| `held by COMMAND`                      | The same, and the command printed nothing       |
| `held by COMMAND: it could not be run` | The command was not found or could not start    |
| `no changed files`                     | The pull request changes nothing                |

A renamed file is checked under both its old and new names.

### `pr-review`

An AI code review of every pull request. Once a pull request is marked
ready, the coding agent reads it, comments on what it finds, and posts a
verdict that [`auto-merge`](#auto-merge) waits for. It is separate from
your own CI, which keeps running your tests as before.

```yaml
pr-review:
  commands:
    - npm test
    - npx tsc --noEmit
```

- **Default:** off. Writing `pr-review` turns it on, even with nothing
  under it (`pr-review: {}`), and `factory sync` then adds its workflow,
  `.github/workflows/factory-claude-review.yml`.
  [Setting up on GitHub](github/setup.md) has what it needs there.
- **`commands` is what the reviewer may run** to confirm something it
  suspects, beyond reading the code and commenting. It doesn't run them on
  every pull request. Without any, it only reads. A command can't contain
  a comma, a parenthesis, or a quote.
- **Each command you list runs the pull request's own code,** in a job
  that holds the review's token. Only list commands you'd be comfortable
  running on any pull request.
- **It reads this list from the branch the pull request merges into,** so
  a pull request can't widen what its own review may run.
- **To turn it off,** delete `pr-review` and run `factory sync`, which
  removes the workflow.
- `factory review tools` prints everything the reviewer may use.

### `approvers`

_[Planned](developing.md#what-is-built)_: `factory config check` refuses
this setting until it is built.

The people whose comments a session takes as instructions, and whose move
of a ticket to Ready counts as approving it. Everyone else's comments are
read as information.

```yaml
approvers:
  - your-name
  - a-teammate
```

- **Default:** the repository's owner, so a repository with one person
  leaves it out.
- **If a name is wrong,** that person's comments are treated as
  information, and a ticket they approve is not built.

### `rules`

Two numbers the factory's rules use, for a repository that wants
different ones. Run `factory sync` after changing one, since it writes the
number into the rules and skills that use it.

```yaml
rules:
  small-change-lines: 30
  review-rounds: 2
```

| Setting              | What it sets                                                                                                                                                                      | Default |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `small-change-lines` | How many changed lines, outside tests, specs, and content, a change can have and still count as [small](workflow.md#sizing-the-work-to-the-change), which skips the heavier steps | `30`    |
| `review-rounds`      | How many rounds of review comments a session answers before it hands what is left to you                                                                                          | `2`     |

Each must be a whole number above zero. Any rule that isn't a number, you
change by saying so in your own instructions for the coding agent, such as
`CLAUDE.md`, which win over the factory's rules.

## Checking the file

| Command or tool          | What it does                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| Your editor              | Flags a misspelled setting as you type, using the schema named on the file's first line              |
| `factory config check`   | Stops on anything the factory can't use, and warns about patterns that match nothing. CI runs it     |
| `factory config explain` | Prints the whole file as the factory reads it, with every default written out and marked `# default` |
| `factory doctor`         | Checks the file against your real board, and that each secret the factory needs is set               |

The first line `factory init` writes is optional. It points your editor at
the schema in the installed package:

```yaml
# $schema: ../node_modules/@davidbyoung/software-factory/settings.schema.json
```

JetBrains editors and Visual Studio Code's YAML extension both read it.
The editor's check is only a help: it accepts some things
`factory config check` refuses, such as a plugin whose file doesn't exist.

## Three complete files

The skills, agents, and scripts these files name are examples. Yours would
have to exist in your repository for `factory config check` to pass.

### A web application with its own reviewers

An online store with a board, a skill of its own for building new API
endpoints, two reviewers of its own, and the factory's UI reviewer.
Changes to components, styles, docs, and tests merge unread, except
anything touching checkout or consent.

```yaml
# $schema: ../node_modules/@davidbyoung/software-factory/settings.schema.json
version: 2
repository: harbor-goods/storefront

tickets:
  board: 1

builds:
  trigger: own-server

specs: openspec

commands:
  build-setup:
    - npx playwright install --with-deps chromium
  before-commit:
    - npm run -s format:check
    - npx tsc --noEmit
    - npm run -s lint
  gate:
    - npm run check
  test-one: npx vitest run $FILE -t "$NAME"

plugins:
  build:
    builders:
      - skill: add-endpoint
        labels:
          - new-endpoint
    reviewers:
      - agent: migration-reviewer
        files:
          - db/migrations/**
      - agent: accessibility-reviewer
        files:
          - src/components/**
      - agent: factory-ui-reviewer
        files:
          - src/components/**
          - src/styles/**

site:
  start: npm run build && npx serve out -p $PORT
  url: http://localhost:$PORT

auto-merge:
  allow:
    - docs/**
    - src/components/**
    - src/styles/**
    - public/**
    - tests/**
  deny:
    - src/components/checkout/**
    - src/components/consent/**
  commands:
    - node scripts/public-api-changed.mjs

pr-review:
  commands:
    - npm test
```

### A small website

A marketing site with a board and nothing else changed. Builds start when
someone asks a session, since `builds.trigger` defaults to `manual`.

```yaml
# $schema: ../node_modules/@davidbyoung/software-factory/settings.schema.json
version: 2
repository: riverbend-studio/site

tickets:
  board: 4

commands:
  before-commit:
    - npm run lint
  gate:
    - npm run lint
    - npm run typecheck
    - npm test
```

### A project that isn't JavaScript

A PHP library. Its commands are Composer's and PHPUnit's, and a cloud
build installs its dependencies first. Docs merge unread, and one reviewer
of its own reads changes to its public API.

```yaml
# $schema: ../node_modules/@davidbyoung/software-factory/settings.schema.json
version: 2
repository: northwind-php/ledger

tickets:
  board: 2

commands:
  build-setup:
    - composer install --no-interaction
  before-commit:
    - composer lint
  gate:
    - composer lint
    - composer analyse
    - composer test
  test-one: vendor/bin/phpunit $FILE ${NAME:+--filter "$NAME"}
  relock: composer update --lock

plugins:
  build:
    reviewers:
      - agent: api-compatibility-reviewer
        files:
          - src/**

auto-merge:
  allow:
    - docs/**
  deny:
    - docs/security/**
```
