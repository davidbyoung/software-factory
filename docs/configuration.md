# Configuration

Everything you can change lives in one file, `.claude/factory.yaml`. This
page explains every key, then shows three complete files.

## How the file works

- **Every key has a default.** A key belongs in your file only when you
  change it. The shortest file that works is two lines.
- **It holds only what a script must compute.** Anything that needs judgment,
  such as when a reviewer applies, stays as prose in the instructions your
  coding agent reads, such as `CLAUDE.md`, where sessions already read it.
- **Paths are glob patterns.** `*` matches within one folder, `**` matches
  across folders, and both match names that start with a dot. A pattern with
  no wildcard matches that one path from the repository's root.
- **A part you can swap is a block with a `type`.** Today each has one type.
  When a part has no settings of its own, you may write it as one word:

  ```yaml
  specs: openspec
  ```

  means the same as:

  ```yaml
  specs:
    type: openspec
  ```

- **Comments are kept.** Setup writes the same comment above a section in
  every repository, and updates never remove yours.

## The shortest file

```yaml
version: 1
repository: your-name/your-repo
```

With this, sessions refine and build tickets when you tell them to, nothing
merges without you, and there is no board.

## The settings most repositories change

Most repositories change three things, and leave every other key at its
default.

- **A board,** to see every ticket's state. Set `tickets.board` to your
  board's number, and when your columns have other names, map them under
  `tickets.columns`. [`tickets`](#tickets) has both. On GitHub,
  [Setting up on GitHub](github/setup.md#a-board) has the steps around
  them.
- **What merges without you.** List the files that may under
  `auto-merge.allow`, such as your docs. [`auto-merge`](#auto-merge).
- **Your own reviewers.** An agent of yours, listed under `plugins` with
  the files it reads. [`plugins`](#plugins), and
  [Plug-ins](plugins.md) for a worked example.

The commands to run before each commit, [`before-commit`](#before-commit),
are the fourth most repositories set.

After any change, run `factory config check`, and
`factory sync`, which rewrites the files a change of
settings affects. A change under `plugins` alone needs no sync: plug-ins
are read from the settings each time.

## Every key

### `version`

The shape of this file, not the factory's version. It is `1`. It changes
only when keys are renamed or moved, and an [update](updating.md) converts
your file when it does.

- **Default:** none. Setup writes it.
- **If wrong:** every command of the factory stops and says which versions it
  understands.

### `repository`

The repository on the code host, as `owner/name`.

- **Default:** none. Setup writes it once.
- **If wrong:** commands read and write another repository's tickets, or
  fail because it does not exist.

It is a setting, not a lookup, so a command run outside a checkout, as the
poller is, still knows which repository to read.

### `tickets`

Where tickets live and how their state is shown.

```yaml
tickets:
  type: github
  board: 1
```

| Key     | Meaning            | Allowed          | Default  |
| ------- | ------------------ | ---------------- | -------- |
| `type`  | The ticket system  | `github`         | `github` |
| `board` | The board's number | A number, `none` | `none`   |

- **With `type: github`,** the board is a GitHub Project, and its number is
  the last part of its address.
- **With no board,** a ticket's state lives in its comments,
  `factory status` still shows it, and builds start only
  when you tell a session.
- **If `board` is wrong:** the board sync fails and names the board it could
  not read.
- **One board can hold more than one repository's tickets.** Give each
  repository the same `board`: each one's sync, `status`, and poller read
  only the cards for its own issues, and GitHub's Repository field tells
  them apart on the board.

A board shows the six states of [Workflow](workflow.md) as columns, and
keeps three fields the factory writes. A repository that writes nothing
below gets the factory's own board. `columns` and `fields` need a `board`.

#### `tickets.columns`

Which of your board's columns shows each state. Leave a key out to use the
factory's own name for it. `none` means your board has no column for that
state.

| Key        | State    | Default column | May be `none` |
| ---------- | -------- | -------------- | ------------- |
| `backlog`  | backlog  | Backlog        | No            |
| `refining` | refining | In refinement  | Yes           |
| `ready`    | ready    | Ready          | Yes           |
| `building` | building | In progress    | Yes           |
| `review`   | review   | In review      | Yes           |
| `done`     | done     | Done           | Yes           |

- **A name matches whatever its capitals and the spaces around it,** so
  the default "In progress" finds a board's "In Progress".
- **A ticket shows in its state's column. When that state has none, it
  shows in the column of the nearest earlier state that has one.** Nothing
  but an approved ticket shows in the `ready` column, so a state with no
  column passes over it.
- **A card in a column no state names is left alone.** The sync writes none
  of its fields while it sits there, and nothing builds it.
- **With `ready: none`,** no column approves a build. A build starts only
  when you tell a session to build the ticket or run
  `factory build N`, so
  `factory config check` requires `builds.trigger: manual`.
- **If a repository's `ready` column has another name,** the poller needs it
  too: see `FACTORY_READY_COLUMN` in [Builds](builds.md).
- `factory config get tickets.columns.ready` prints the
  name in effect, or `none`.

#### `tickets.fields`

Which of your board's fields the sync writes: `session`, `runs-in`, and
`cost`, with the defaults Session, Runs in, and Cost. Each may be `none`.
The board's own status field keeps its name, Status on a GitHub Project,
and has to be a single select holding every column named above.

| The settings   | The board                          | The sync                                                       |
| -------------- | ---------------------------------- | -------------------------------------------------------------- |
| name the field | has it, with the right type        | writes it                                                      |
| name the field | lacks it, or it has the wrong type | fails, naming the field and its key                            |
| leave default  | has it, with the right type        | writes it                                                      |
| leave default  | lacks it                           | skips it, with a note                                          |
| leave default  | has it, with the wrong type        | fails, and says to name another field or set the key to `none` |
| say `none`     | either                             | never writes it                                                |

Session is Text, Runs in is a single select with the options Local and
Actions, and Cost is a Number. `factory board check` reads
your board and says what the factory will do with it.

Two examples. The default, which needs nothing written:

```yaml
tickets:
  type: github
  board: 1
```

A board with only Todo, In Progress, and Done, as a new GitHub Project
starts, and none of the factory's fields:

```yaml
tickets:
  type: github
  board: 7
  columns:
    backlog: Todo
    refining: none
    ready: none
    building: In Progress
    review: none
    done: Done
builds:
  trigger: manual
```

`factory config check` rejects, naming the key: a key it
does not know;
`backlog: none`; two states naming the same column; `columns` or `fields`
with no `board`; and `ready: none` while `builds.trigger` is not `manual`.
It reads no board.

`type` exists so that another ticket system changes this block and nothing
else. Only `github` is built. Any other value fails
`factory config check` and every ticket command with:
`tickets.type "X" is not supported. "github" is the only ticket system built.`

### `code-host`

Where the repository and its pull requests live.

```yaml
code-host:
  type: github
```

| Key    | Meaning       | Allowed  | Default  |
| ------ | ------------- | -------- | -------- |
| `type` | The code host | `github` | `github` |

`code-host: github` means the same, and most files leave the block out.
It exists so that code kept somewhere else changes this block and nothing
else. Only `github` is built. Any other value fails
`factory config check`, and every command that reads the
settings and reaches a pull request, with:
`code-host.type "X" is not supported. "github" is the only code host built.`

### `builds`

```yaml
builds:
  trigger: own-server
  runner: github-actions
```

| Key       | Meaning                                             | Allowed                                 | Default          |
| --------- | --------------------------------------------------- | --------------------------------------- | ---------------- |
| `trigger` | What starts a build for a ticket you moved to Ready | `own-server`, `github-action`, `manual` | `manual`         |
| `runner`  | Where a build in the cloud runs                     | `github-actions`                        | `github-actions` |

`trigger` is what notices a card moved to Ready, and `runner` is where the
build it starts then runs: a poller on your own server still starts its
builds on the cloud runner. Only `github-actions` is built. Any other value
fails `factory config check`, and every command that reads
the settings and reaches the runner, with:
`builds.runner "X" is not supported. "github-actions" is the only runner built.`

- **`manual`:** nothing watches the board. You tell a session "work 12".
- **`own-server`:** a small poller you host reads the board once a minute.
- **`github-action`:** a schedule on the cloud runner does the same, more
  slowly.
  _[Planned](developing.md#what-is-built)_: `factory config check`
  refuses this value until it is built. Use `own-server` or `manual`.

[Builds](builds.md) explains each. **If `trigger` says `own-server` and no
poller is running,** a ticket moved to Ready sits there, and
`factory status` flags it "not started".

### `specs`

How the written spec for a change your visitors or users will see is kept.

```yaml
specs: openspec
```

| Allowed    | Meaning                                                                   |
| ---------- | ------------------------------------------------------------------------- |
| `none`     | The ticket's acceptance criteria are the only spec                        |
| `openspec` | A visible, non-trivial change also adds its behavior to `openspec/specs/` |

- **Default:** `none`.
- **If you set `openspec` without OpenSpec installed:** a build of a visible
  change stops at its first spec step and says so.

### `before-commit`

Commands run, in order, before every commit a session makes. If one fails,
the commit is blocked and the session is shown the output.

```yaml
before-commit:
  - npm run -s format:check
  - npx tsc --noEmit
  - npm run -s lint
```

- **Default:** none. Setup proposes some from your `package.json`,
  `composer.json`, or Makefile, and asks.
- **Keep them fast.** They run on every commit. Your full test suite belongs
  in the gate your agent's instructions name, which a session runs before it
  reports a task done, and in CI.
- **If one is wrong:** every commit is blocked with that command's error.

### `build-setup`

Commands run, in order, from the repository's root before a build in the
cloud starts work. Your npm dependencies are already installed by then,
with `npm ci`.

```yaml
# Commands run from the repository's root before an unattended build starts
# work. Your npm dependencies are already installed by then.
build-setup:
  - npx playwright install --with-deps chromium
```

- **Default:** none.
- **What goes here:** what a session needs that `npm ci` does not give it,
  such as a browser for end-to-end tests or a system package.
- **If one fails:** the run stops before the session starts, with that
  command's output in its log.
- `factory config get build-setup` prints one command per
  line.

### `session-minutes`

How long each kind of session that runs on its own in the cloud may run, in
minutes. Raise one when your tests, your build, or your site's
comparison take long enough that honest work is being cut off.

```yaml
# How long each unattended session may run, in minutes.
session-minutes:
  build: 300
```

| Key            | The session                                   | Default |
| -------------- | --------------------------------------------- | ------- |
| `build`        | A build of a ticket                           | `230`   |
| `conflicts`    | A fix of a pull request's conflicts with main | `110`   |
| `review`       | An answer to your review of a pull request    | `50`    |
| `dependencies` | Work on the dependency pull requests          | `50`    |

- **Each is a whole number above zero.** A key you leave out keeps its
  default.
- **The job around a session gets 10 minutes more,** so the steps after it,
  which release the ticket and post what happened, still run when the
  session is stopped.
- **`factory sync` writes these where the cloud runner
  reads them,** and `factory sync --check` fails until it
  has run after a change.
- **The cloud runner may stop a job sooner.** On GitHub, see
  [its limits](github/reference.md#limits).
- The cloud jobs that run no session, such as the board's sync and who
  merges, keep fixed short limits.
- `factory config get session-minutes.build` prints the
  value in effect.

### `plugins`

Your own skills and agents, and the job each does. Refining, building, and
reviewing tests are built in; these add to them.

```yaml
plugins:
  - skill: design-mockups
    role: mockups
  - skill: add-endpoint
    role: builder
    labels:
      - new-endpoint
  - agent: migration-reviewer
    role: reviewer
    files:
      - db/migrations/**
```

| Key              | Meaning                                                               |
| ---------------- | --------------------------------------------------------------------- |
| `skill`, `agent` | The name of one of your own skills or agents                          |
| `role`           | `mockups`, `builder`, or `reviewer`                                   |
| `labels`         | For a `builder`: it builds a ticket carrying one of these labels      |
| `files`          | For a `reviewer`: it is considered when a change touches one of these |

Where your coding agent keeps them: in Claude Code, see
[Skills in Claude Code](github/reference.md#skills-in-claude-code).

- **Default:** none.
- **`files` is a filter, not the whole rule.** When a reviewer really
  applies is in that agent's own description. A reviewer whose files matched
  but which did not apply gets one line in the pull request saying why.
- **If a name is wrong:** `factory config check` fails and
  names the missing file.

### `site`

How the factory looks at your website. Leave it out if the repository is not
one. With it, and `factory-ui-reviewer` listed under `plugins`, a visible
change is pictured before and after, and the difference is reviewed.

```yaml
site:
  # A command that builds and serves the site from the repository's root,
  # and the address it answers at. $PORT is set for you.
  start: npm run build && npx serve out -p $PORT
  url: http://localhost:$PORT
  # Optional. Your design rules, applied on top of the built-in ones.
  design-guide: docs/design.md
```

| Key             | Default       | Meaning                                                                                              |
| --------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| `start`         | required      | Builds and serves the site from the repository's root; `$PORT` is set                                |
| `url`           | required      | The address `start` answers at                                                                       |
| `design-guide`  | none          | A file of your own design rules                                                                      |
| `pages`         | found         | The paths to look at. Otherwise from `/sitemap.xml`, or the home page's links                        |
| `widths`        | `[390, 1280]` | The widths, in pixels, each page is shot at                                                          |
| `hide`          | none          | CSS selectors hidden before every picture, for something that floats                                 |
| `checks`        | none          | Your own measuring commands. Each gets one JSON object on its standard input                         |
| `max-pages`     | `4`           | How many changed pages the agent reads closely                                                       |
| `start-minutes` | `5`           | How long to wait for the site to answer after `start` is run                                         |
| `accessibility` | `wcag22aa`    | The WCAG level axe-core measures changed pages against: `wcag22aa`, `wcag21aa`, `wcag2aa`, or `none` |
| `new-values`    | `true`        | `false` leaves out the font sizes, colors, spacing, and radii the base site does not use             |

- **`factory config get site`** prints every key in this
  order, defaults included, one `key: value` line each.
  `factory config get site.widths` prints one key, a list one item to a line, and `none` for a key that is not
  set; `site.pages` prints `found` when it is not set.
- **`factory config check`** rejects a `site` with no `start` or `url`, a
  `design-guide` that is not a file, and `factory-ui-reviewer` listed with no
  `site`. It also fails when the `playwright` package is not found from the
  repository's root: `npm install -D playwright`. It looks for the package and
  never for a browser.
- **A `checks` command** gets `{"before", "after", "pages", "report"}` on its
  standard input: the two addresses, the paths that changed, and the folder of
  pictures. Each non-empty line it prints is a finding; its exit code says
  nothing.

### `auto-merge`

Which pull requests may merge without you.

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

1. every changed file matches a pattern under `allow`;
2. no changed file matches a pattern under `deny`;
3. every command under `commands` exits 0;
4. CI passes, including the automated review's verdict.

Anything else waits for you, and the pull request says why.

| Key        | Meaning                                                              | Default |
| ---------- | -------------------------------------------------------------------- | ------- |
| `allow`    | Patterns for files safe to merge unread                              | empty   |
| `deny`     | Exceptions inside `allow`. `deny` always wins                        | empty   |
| `commands` | Your own checks. Each is run once for a pull request and can veto it | empty   |

- **With the default, nothing merges without you.**
- **Always held for you, whatever you allow:** the factory's own files
  (`.claude/`, `.github/`, every `CLAUDE.md` and `AGENTS.md`, and
  `openspec/config.yaml`).
- **A command** is run once for a pull request, from the root of a checkout
  of your default branch, never the pull request's. It is given one JSON
  object on its standard input:

  ```json
  {
    "repository": "harbor-goods/storefront",
    "pull": 42,
    "base": "the merge base's commit",
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

  It exits 0 to allow the merge, and anything else to hold the pull request
  for you. Each line it prints is shown as a reason; one that prints nothing
  is shown as "held by" and the command. A command that cannot be run
  counts as a hold.

- **The reasons a held pull request shows**, one for each file or command
  that held it, in this order of checking:

  | Reason                                 | Why                                                 |
  | -------------------------------------- | --------------------------------------------------- |
  | `PATH: the factory's own files`        | One of the files below, whatever `allow` says       |
  | `PATH: held by auto-merge.deny`        | It matches `deny`                                   |
  | `PATH: not in auto-merge.allow`        | It matches nothing in `allow`                       |
  | What a command printed                 | A command exited with anything but 0                |
  | `held by COMMAND`                      | A command exited with anything but 0, printing none |
  | `held by COMMAND: it could not be run` | The command was not found or could not be started   |
  | `no changed files`                     | The pull request changes nothing                    |

  A renamed file is checked under both its names.

- **If a pattern matches no file:** `factory config check`
  warns, since a stale pattern is how a policy rots.
- **If `allow` is too wide:** changes you meant to read merge unread.
  Start with a short list and add to it.
- **If a `deny` pattern matches nothing inside `allow`:** it does nothing,
  and `factory config check` says so.

### `ci-review`

The automated review of every pull request: Claude reads each one once it
is marked ready, comments on what it finds, and posts a verdict. It is on
while `ci-review` is written, even with nothing under it, and `factory
sync` then writes its workflow, `.github/workflows/factory-claude-review.yml`.
[The automated review](github/setup.md#the-automated-review) has the steps
it needs on GitHub.

```yaml
# The automated review of every pull request, on while this is written.
# "commands" are what it may run to confirm a finding, beside reading the
# pull request and commenting on it.
ci-review:
  commands:
    - npm test
    - npx tsc --noEmit
```

- **Default:** off.
- **`commands`:** each is a command prefix the reviewer may run, such as
  your tests, the type check, or lint. Without any, it reads the pull
  request, its history, and your instructions, and runs nothing of yours.
  A command may hold no comma, parenthesis, or quote.
- **Read from the pull request's base commit,** so a change to the
  settings alone cannot widen what its own review may run.
- **To turn it off,** delete `ci-review` and run
  `factory sync`, which deletes the workflow.
- `factory review tools` prints every tool the review may
  use, as its workflow passes them on.

### `approvers`

_[Planned](developing.md#what-is-built)_: `factory config check`
refuses this key until it is built.

The people whose comments a session treats as instructions, and whose move
of a ticket to Ready counts as approval. Everyone else's comments are
information.

```yaml
approvers:
  - your-name
  - a-teammate
```

- **Default:** the repository's owner. One person never writes this key.
- **If a name is wrong:** that person's comments are treated as
  information, and a ticket they move to Ready is not built.
  _[Planned](developing.md#what-is-built)_: `factory doctor`
  flags a name that is not an account with access to the repository.

A session posts through a person's account too, so it marks its own comments
and never takes one as an instruction.

### `rules`

Numbers the process rules use, for a repository that wants different ones.
`factory sync` writes each into the copies of the rules and skills that
state it, so run it after changing one.

```yaml
rules:
  small-change-lines: 30
  review-rounds: 2
```

| Key                  | Meaning                                                               | Default |
| -------------------- | --------------------------------------------------------------------- | ------- |
| `small-change-lines` | A change under this many lines, outside tests, takes the lighter path | `30`    |
| `review-rounds`      | Rounds a session works a review before it hands what is left to you   | `2`     |

- **If a value is not a whole number above zero:**
  `factory config check` fails and names the key.

Any rule that is prose, not a number, you change by saying otherwise in
your own instructions for the agent, such as `CLAUDE.md`, which win over the
factory's rules.

## Checking the file

| Command                  | What it does                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Your editor              | The first line of the file points at the factory's schema, which flags a misspelled key as you type it                 |
| `factory config check`   | Fails on an unknown key, a wrong type, a plug-in with no file, and warns on a pattern matching nothing. Runs in CI     |
| `factory config explain` | Prints every setting in effect, as the file would read with every default written out, each default marked `# default` |
| `factory doctor`         | Checks the file against the real board, and that each secret your parts read is set                                    |

The first line of the file, which the three files below start with:

```yaml
# $schema: ../node_modules/@davidbyoung/software-factory/settings.schema.json
```

Both editor families read it: JetBrains' editors and the YAML language server
that Visual Studio Code's YAML extension uses. The path is relative to the
settings file, so it finds the schema in the installed package, which matches
the installed version and works offline. In a checkout with nothing installed
the editor finds no schema and says so.

The editor's check is a help. It accepts some files
`factory config check` refuses, such as a plug-in whose
file does not exist, and that command is the one that counts.

## Three complete files

### A web application with its own reviewers

An online store. It adds a skill that builds new API endpoints the way
this project scaffolds them, and three reviewers of its own. It sets `site`,
so the factory's design skill makes its mockups with no entry here. Changes to components, styles, docs, and tests merge
unread; anything touching checkout or consent waits for a person.

```yaml
# $schema: ../node_modules/@davidbyoung/software-factory/settings.schema.json
# Settings for the software factory. Every key is explained in
# docs/configuration.md in the factory's repository.
#
# Anything not listed here keeps its default: no pull request merges without
# you, a build starts when you tell a session to work a ticket, and only the
# built-in reviewers run.
#
# "version" is the shape of this file, not the factory's version.
version: 1
repository: harbor-goods/storefront

# Where tickets live. "board" is the number in your GitHub Project's address.
tickets:
  type: github
  board: 1

# What starts a build once a ticket is moved to Ready on the board:
# own-server (a small poller you host), github-action, or manual (you tell
# a session to build it).
builds:
  trigger: own-server

# How the written spec for a change your users will see is kept: openspec,
# or none.
specs: openspec

# Commands run on the session's machine, from the repository's root, before
# every commit it makes. If one fails, the commit is blocked.
before-commit:
  - npm run -s format:check
  - npx tsc --noEmit
  - npm run -s lint

# Your own skills and agents. A skill is a set of instructions a session
# follows; an agent is a separate reviewer a session launches. Refining,
# building, and reviewing tests are built in; these add to them. "role" is
# one of:
#   mockups   makes pictures to choose from when a decision changes the look
#   builder   builds a ticket that carries one of "labels" (label names),
#             in place of the built-in build
#   reviewer  is asked to read a finished change when it touches a path
#             matching "files", and reports problems; it edits nothing
plugins:
  - skill: add-endpoint
    role: builder
    labels:
      - new-endpoint
  - agent: migration-reviewer
    role: reviewer
    files:
      - db/migrations/**
  - agent: factory-ui-reviewer
    role: reviewer
    files:
      - src/components/**
      - src/styles/**
  - agent: accessibility-reviewer
    role: reviewer
    files:
      - src/components/**

# How the factory looks at this website, for factory-ui-reviewer.
site:
  start: npm run build && npx serve out -p $PORT
  url: http://localhost:$PORT

# Which pull requests may merge without you. Patterns are globs matched
# against paths from the repository's root, and deny wins over allow. A pull
# request merges itself only when every changed file matches "allow", none
# matches "deny", every command under "commands" (if you list any) exits 0
# when CI runs it, and CI passes. Anything else waits for you.
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
```

### A basic website

A small marketing site with a board, no reviewers of its own, and nothing
merging unread. Everything not written here is a default.

```yaml
# $schema: ../node_modules/@davidbyoung/software-factory/settings.schema.json
# Settings for the software factory. Every key is explained in
# docs/configuration.md in the factory's repository.
#
# Anything not listed here keeps its default: no pull request merges without
# you, a build starts when you tell a session to work a ticket, and only the
# built-in reviewers run.
#
# "version" is the shape of this file, not the factory's version.
version: 1
repository: riverbend-studio/site

# Where tickets live. "board" is the number in your GitHub Project's address.
tickets:
  board: 4

# Commands run on the session's machine, from the repository's root, before
# every commit it makes. If one fails, the commit is blocked.
before-commit:
  - npm run lint
  - npm run typecheck
```

Builds start when someone tells a session to work a ticket, since
`builds.trigger` defaults to `manual`.

### A repository that is not JavaScript

A PHP library. Its commands are Composer's. It lets documentation merge
unread and has one reviewer of its own for its public API.

```yaml
# $schema: ../node_modules/@davidbyoung/software-factory/settings.schema.json
# Settings for the software factory. Every key is explained in
# docs/configuration.md in the factory's repository.
#
# Anything not listed here keeps its default: no pull request merges without
# you, a build starts when you tell a session to work a ticket, and only the
# built-in reviewers run.
#
# "version" is the shape of this file, not the factory's version.
version: 1
repository: northwind-php/ledger

# Where tickets live. "board" is the number in your GitHub Project's address.
tickets:
  type: github
  board: 2

# Commands run on the session's machine, from the repository's root, before
# every commit it makes. If one fails, the commit is blocked.
before-commit:
  - composer lint
  - composer analyse

# Your own skills and agents. A skill is a set of instructions a session
# follows; an agent is a separate reviewer a session launches. Refining,
# building, and reviewing tests are built in; these add to them. "role" is
# one of:
#   mockups   makes pictures to choose from when a decision changes the look
#   builder   builds a ticket that carries one of "labels" (label names),
#             in place of the built-in build
#   reviewer  is asked to read a finished change when it touches a path
#             matching "files", and reports problems; it edits nothing
plugins:
  - agent: api-compatibility-reviewer
    role: reviewer
    files:
      - src/**

# Which pull requests may merge without you. Patterns are globs matched
# against paths from the repository's root, and deny wins over allow. A pull
# request merges itself only when every changed file matches "allow", none
# matches "deny", every command under "commands" (if you list any) exits 0
# when CI runs it, and CI passes. Anything else waits for you.
auto-merge:
  allow:
    - docs/**
  deny:
    - docs/security/**
```

If this team moved its tickets to Jira, only the `tickets` block would
change. **Only GitHub is built**; the block below shows the shape the
design leaves room for.

```yaml
tickets:
  type: jira
  site: northwind.atlassian.net
  project: LEDGER
```
