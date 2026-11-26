# Adopting it in an existing repository

Most repositories already have a toolchain, a board, instructions for a
coding agent, a team, or several packages in one repository. This page
says what the factory does in each case, and what it leaves alone.

## Try it without committing to it

Do the [quick start](quick-start.md), and do not merge the pull request
`factory init` opens. Your checkout is left on that pull request's
branch, `set-up-factory`: start an agent session there and refine and
build one ticket. If you decide against it, close the pull request and
delete the branch. [Removing it](removing.md) covers the case where you
have already merged.

## A repository that is not JavaScript

The factory's tool runs on Node, whatever your project is written in,
and it is installed on each machine, not in your repository. In a PHP,
Python, or Go repository that means:

- **Nothing of Node's goes in the repository.** The factory adds no
  `package.json`, no `package-lock.json`, and no `node_modules/`. The one
  exception is a spec tool that npm installs, such as OpenSpec, if you
  choose one ([`specs`](configuration.md#specs)): `factory init` then
  writes a small private `package.json` for it, and ignores
  `node_modules/`.
- **Everyone who runs an agent session in the repository needs Node
  22.18 or later,** and the `factory` command, installed once on their
  machine as [the quick start](quick-start.md#1-install) shows.
- **Your own CI does not change.** The factory's cloud jobs install Node
  and the factory for themselves. They run `npm ci` for your project only
  when its root has a `package-lock.json`, so in a repository without one
  they install nothing of yours. What a session in the cloud needs on its
  machine beyond that, such as a language, goes under
  [`commands.build-setup`](configuration.md#commandsbuild-setup). It
  installs your project's dependencies itself, from the registries you
  list under [`builds.hosts`](configuration.md#builds)
  ([What a session can use](builds.md#what-a-session-can-use)).
- **Your commands stay yours.** The gate a build runs, and everything
  else under [`commands`](configuration.md#commands) in the settings, is
  whatever your project runs: `composer test`, `make check`,
  `go vet ./...`.

The factory's hooks run that one command, so they need nothing beyond
Node and the install. On a machine without it, they stop a session's
commands and say how to install it. Someone who only writes code by
hand, and never runs an agent session in the repository, needs none of
this.

[Configuration](configuration.md#a-project-that-isnt-javascript) has a
complete settings file for a PHP library.

## A monorepo

This is for a repository that holds several packages, such as Node
packages under `packages/` and Python services under `services/`. At the
end, a [session](glossary.md#the-words) that changes one package runs
that package's checks, its [gate](glossary.md#the-words), not every
package's, and a change to a file nobody accounted for still runs them
all.

Set the factory up first, at the repository's root, with the
[quick start](quick-start.md): one `factory init`, one
`.claude/factory.yaml`, and one board, as for any repository. This
section changes the commands under `commands` in that file, on the
branch the quick start leaves you on.

**If your monorepo already has Nx, Turborepo, or Pants,** it already
knows which packages a change affects, and you skip steps 1 and 2. Make
your gate one command that asks it, and pass it
[`$BASE`](configuration.md#commands-for-some-folders), the commit your
branch started from on your default branch:

```yaml
commands:
  gate:
    - npx nx affected -t lint test --base=$BASE
    # Turborepo: npx turbo run lint test --filter="...[$BASE]"
    # Pants: pants --changed-since=$BASE --changed-dependents=transitive test
```

**It worked when** `factory gate` prints `$ npx nx affected ...` with no
line before it, and ends with `✓ Every gate command passed.` When it
starts with `? Can't tell what changed`, `$BASE` is empty: run the fetch
command that line prints, and run the gate again. Read on only to split
up your other commands, such as
[`commands.test-one`](configuration.md#commandstest-one), by package
([The other settings](#the-other-settings)).

### 1. Write each package's commands

Write [`commands.gate`](configuration.md#commandsgate) in
`.claude/factory.yaml`, replacing the one
command `factory init` asked you for, if you gave one, with a command for
each kind of package:

```yaml
commands:
  gate:
    - npm run -s format:check # from the root, for every change
    - run: npm test
      in: packages/* # in each package, when that package changes
      files: [./**, packages/shared/**, package.json, package-lock.json]
    - run: poetry run pytest -q
      in: services/* # in each service, when that service changes
```

- **`in: packages/*`** makes one command for each folder under
  `packages/`, and runs each inside its own folder.
- **`files`** lists the changed files that run it, as patterns such as
  `src/**/*.ts`. `./` means the command's own folder, so `./**` is every
  file in that package. A pattern without `./` starts at the root.
- **Without `files`,** a change to any file in its folder runs it, as
  with `pytest` above. **Writing `files` replaces that,** so keep `./**`
  in the list, or the package's own changes stop running it.
- **List what a package's checks read outside its folder,** such as a
  shared library or the root's lock file, as `npm test` does above. Then
  a change to that file runs every package's tests. The factory looks at
  which files changed, not at what your code imports, so a file you leave
  out runs nothing of that package's when it changes.
- **A plain text command,** such as the format check, runs from the root
  for every change, as in any repository.

A changed file is **covered** when a gate command's `files` match it, or
its folder does when it has no `files`. A changed file that nothing
covers runs every gate command, since the factory can't tell what it
might break. That is what keeps an edit to a root file such as
`tsconfig.base.json` from passing with no type check.

**It worked when** `factory gate --dry-run` lists each command as it
will run, such as `cd packages/api && npm test`, each marked `runs` or
`left out` for the change on your branch.

### 2. Settle what nothing covers

Your repository has files outside every package: CI workflows, scripts,
and root settings. `factory config check` lists the ones nothing covers.
A folder with nothing covered in it is one line, with how many files it
holds:

```
$ factory config check
? 4 paths are in no gate command's files and not in commands.ignore, so a change to one runs every command:
    .github/             6 files
    scripts/             11 files
    docs/                9 files
    tsconfig.base.json
  Add each to commands.ignore, or to the files of the gate commands it affects.
✓ The settings are valid.
```

For each, decide what a change to it could break:

- **Some of your checks:** add it to those commands' `files`.
  `tsconfig.base.json` goes in `npm test`'s, since every Node package
  reads it, and `scripts/**` goes in the `files` of the commands that run
  those scripts.
- **None of them:** add it to
  [`commands.ignore`](configuration.md#commandsignore). Your CI
  workflows, `.github/**`, are checked by your CI itself, and `docs/**`
  holds no code:

  ```yaml
  commands:
    ignore:
      - .github/**
      - docs/**
  ```

  A change to an ignored file runs only the plain text commands, such as
  the format check, even where a command's `./**` would match it.

- **You're not sure:** leave it. A change to it runs every command, which
  is slow but never misses anything.

Then run every command once, whatever changed, to check that each works
in its folder:

```bash
factory gate --all
```

**It worked when** `factory config check` prints only
`✓ The settings are valid.`, or lists only files you chose to leave, and
`factory gate --all` ends with `✓ Every gate command passed.` Commit
`.claude/factory.yaml` on that branch.

### What runs from then on

A session's `factory gate` compares its branch with the commit the branch
started from on your default branch, which it reads from `origin/` and
the default branch's name, and runs each command a changed file sets
off. With fifty packages and twenty services, and `main` as the default
branch:

```
$ factory gate
commands.gate: 2 of 71 run, for the 3 files changed since origin/main
  npm run -s format:check          every change
  cd packages/api && npm test      packages/api/src/orders.ts, and 1 more
- 69 left out, since this change touches none of their files: factory gate --dry-run lists each
```

A change to `.claude/factory.yaml` runs every command, so a command you
add is tried in the pull request that adds it. A changed file nothing
covers also runs every command, and the first line names it, so you know
what to add. [Commands for some folders](configuration.md#commands-for-some-folders)
has every rule.

### The other settings

Each of these is optional. Split one only when your packages need
different commands for it.

- **[`commands.test-one`](configuration.md#commandstest-one) and
  [`commands.end-to-end`](configuration.md#commandsend-to-end),** which a
  session uses to run one test file, if your packages run their tests
  with different tools: give a command for each kind of package, and the
  factory runs the one whose folder holds the test file.
- **[`commands.coverage`](configuration.md#commandscoverage),** if each
  package measures its own coverage: give each its command and report,
  and `factory coverage` runs the ones a change needs.
- **[`commands.relock`](configuration.md#commandsrelock),** if your
  packages keep their own lock files, such as one in each Python
  service: `factory relock` rebuilds the ones a change needs after a
  conflict.
- **[`site`](configuration.md#site),** if the repository holds more than
  one web app: list a site for each, and `factory site compare` takes
  screenshots of the ones a change touches.
- **A [preset](presets.md),** a shared set of settings, if your company
  has one written for one package, such as a Python preset: apply it to
  each of your services with `factory preset add NAME --in 'services/*'`.
- **Notes for a session about one package** go in a `CLAUDE.md` in that
  package's folder, which Claude Code reads when it works there.

## You already have a board

A ticket is always in one of six [states](workflow.md#the-six-states),
and the factory shows each state as a column of your board. The settings
call the states `backlog`, `refining`, `ready`, `building`, `review`, and
`done`, in that order. `factory init` saves which of your columns shows
each in [`tickets.columns`](configuration.md#ticketscolumns), always all
six, and every factory command needs all six there.

**In an organization,** the board is chosen once, by the owner who runs
[`factory init --org`](github/setup.md#set-an-organization-up-once).
For a board the organization already has, that command asks about its
columns exactly as this section shows `factory init` doing, and saves
the answer in the organization's [preset](presets.md), the file
`factory-preset.yaml` that its repositories share, where this section
says `.claude/factory.yaml`. `factory init` in a repository that
follows the preset takes the board from it, and asks nothing about
boards or columns.

When you run `factory init`, step 2 of the
[quick start](quick-start.md#2-set-it-up), it lists your boards to choose
from. If the one you choose already has the factory's own columns,
Backlog, In refinement, Ready, In progress, In review, and Done, init
asks nothing and saves them. Capitals don't matter, so your
"In Progress" is its "In progress":

```text
? Which board? Use an existing one: Shop board (#3)

Board 3 has a column for each of the factory's six states:

  State      Column
  backlog    Backlog
  refining   In refinement
  ready      Ready
  building   In Progress
  review     In review
  done       Done
```

If it lacks any, init asks your coding agent, Claude Code, which of your
columns shows each state, and shows you the answer before it changes
anything. This is one short request with no tools, made with the sign-in
Claude Code already has, and it sends your column names and nothing else.
On a board with the columns Todo, In Progress, Code review, and Done:

```text
? Which board? Use an existing one: Shop board (#3)

Board 3 has the columns Todo, In Progress, Code review, and Done.
Asking Claude Code which of them shows each of the factory's six states...

  State      Column
  backlog    Todo
  refining   none, shows in Todo
  ready      none
  building   In Progress
  review     Code review
  done       Done

? Use these columns? (Use arrow keys)
❯ Yes
  Change some
  No: add the factory's columns instead
```

A state with no column shows its tickets in the column of the state
before it, so here a ticket being refined stays in Todo. With no column
for ready, you start each build with `/factory-build N` in a session,
rather than by moving its ticket on the board. So init offers no column
for ready only when [`builds.trigger`](configuration.md#builds) is
`manual`, the setting for builds that start when you ask.

- **Yes** saves the table in your settings, `.claude/factory.yaml`:

  ```yaml
  tickets:
    board: 3
    columns:
      backlog: Todo
      refining: none
      ready: none
      building: In Progress
      review: Code review
      done: Done
  ```

- **Change some** lets you pick the states to change from a list, then,
  for each, pick one of your columns, no column, or a new column with the
  factory's name, which init adds to your board. Each state needs a column
  of its own: two states can't share one.
- **No** adds each of the factory's six columns your board lacks, here
  Backlog, In refinement, Ready, and In review, and saves the six
  factory names. Your Todo, In Progress, Code review, and Done columns
  stay. In Progress and Done are used, since their names match. The
  factory ignores the tickets in Todo and Code review: nothing moves or
  builds them until you move them to one of its columns.

Init ends by running its checks. When the columns are right, you see:

```text
Checks
  ✓ Board 3 has every column the settings name
```

**When init can't get an answer, it asks you instead.** That happens
when Claude Code isn't signed in, or when its answer can't be used, such
as one column for two states. Init prints Claude Code's own reason, then
asks for each state's column in turn, offering your columns, no column,
or a new column with the factory's name, and shows you the table to
confirm as above:

```text
Claude Code's answer could not be used: it failed: Failed to authenticate: OAuth session expired and could not be refreshed.
Choose the column for each state yourself.
? Which column shows backlog?
```

To be asked nothing about columns at all, do one of these before you
run `factory init`:

- write a `columns` block like the one above in `.claude/factory.yaml`
  yourself, with all six states, beside your `board`, as
  [`tickets.columns`](configuration.md#ticketscolumns) describes. When
  `factory config check` ends with `✓ The settings are valid.`, init
  won't ask;
- add the six columns to your board yourself, so init has nothing to ask.

Running init again is safe: it keeps what your settings already say. If
the block leaves a state out, every factory command stops and names it,
and running init asks you only for that state. If you change your
board's columns later, edit the block, or delete it and run
`factory init` again for a new suggestion.

Init suggests one column for each state. When two of your columns mean the
same state, such as Code review and QA, write a list in the block
yourself: see [`tickets.columns`](configuration.md#ticketscolumns).

What else to expect on a board you already use:

- **The factory never renames or deletes your columns,** and only adds the
  ones you agree to.
- **It adds three fields to your board,** Session, Runs in, and Cost, and
  overwrites them on every sync, so don't type into them. Your own board
  fields are never touched. [`tickets.fields`](configuration.md#ticketsfields)
  says what each holds.
- **Your board's own automations**, such as moving a closed ticket to
  Done, have not been tested alongside the factory. Turn them off if
  tickets jump unexpectedly.

To see what the factory will do with your board at any time, run
`factory board check`. It lists each state's column, as the table above
does, and each field the sync fills in, and marks a problem with ✗ on its
row, such as a column your settings name that the board lacks.

## Your tickets already have fields

If your tickets have text fields of their own, such as an "Acceptance
criteria" field your team fills in by hand, the factory can write what
it settles when it refines a ticket into those fields instead of the
ticket's description. At the end, refining a ticket fills in your
fields, and the description holds your text and whatever has no field.
If your tickets have no such field, skip this section: nothing changes.

[Refining a ticket](skills.md#factory-refine), with `/factory-refine N`,
writes four parts after your own text, each under its own heading. These
are the factory's fields for a refined ticket:

| Factory field       | What it holds                                              |
| ------------------- | ---------------------------------------------------------- |
| Decisions           | The questions refinement settled, and what was chosen      |
| Spec                | What a change your users will notice must do, line by line |
| Acceptance criteria | What must be true for any other ticket to be done          |
| For the builder     | How to build it, as a design and a list of tasks           |

A ticket has a Spec or Acceptance criteria, never both: refinement writes
a Spec when the change is one
[your users will notice](workflow.md#a-change-your-users-will-see), and
Acceptance criteria otherwise.

This page calls a field of yours that is set on the ticket itself a
ticket field. On GitHub, a ticket field is an
[issue field](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization),
shown beside the issue, which you create in your account's or
organization's settings, under Issue fields. A field you add to your
board, which shows as a column of the board's table, can't hold a
factory field: GitHub limits it to 1,024 characters, and a Spec is often
several thousand. Create the issue field before you run init, since init
offers only ticket fields that exist.

When you run `factory init`, step 2 of the
[quick start](quick-start.md#2-set-it-up), it finds your text ticket
fields and asks your coding agent, Claude Code, which of them should hold
each factory field. If you already ran init, run it again after creating
the field: it keeps what your settings say and asks only about ticket
fields. As for your board's columns, this is one short request with no
tools, and it sends your ticket fields' names and descriptions and
nothing else. Init shows you the answer before it writes anything. On a
repository whose tickets have the text fields Acceptance criteria,
Design notes, and Customer, init shows:

```text
acme/shop's tickets have the text fields Acceptance criteria, Design notes, and Customer.
Asking Claude Code which of them should hold each of the factory's fields...

  Factory field         Ticket field
  Decisions             the description
  Spec                  Acceptance criteria
  Acceptance criteria   Acceptance criteria
  For the builder       Design notes

Your own text stays in the description.
GitHub Issues shows a field's text as typed, without Markdown formatting.

? Use these ticket fields? (Use arrow keys)
❯ Yes
  Change some
  No: keep everything in the description
```

A factory field goes in the description unless a ticket field clearly
fits it, so here Decisions stays there, and nothing goes in Customer.
Spec and Acceptance criteria share a ticket field here, since a ticket
has only one of them.

- **Yes** saves the table in your settings, `.claude/factory.yaml`, one
  line for each factory field, with `none` for one that stays in the
  description:

  ```yaml
  tickets:
    fields:
      decisions: none
      spec: Acceptance criteria
      acceptance-criteria: Acceptance criteria
      for-the-builder: Design notes
  ```

- **Change some** lets you pick the factory fields to change from a list,
  then, for each, pick one of your ticket fields or the description.
- **No** saves all four as `none`, so everything stays in the
  description, as it would with no ticket fields.

When your tickets have no text field, init doesn't ask, writes nothing
about them, and prints no check for them.

**It worked when** the checks init prints last include:

```text
Checks
  ✓ acme/shop's tickets have every field the settings name
```

Then refine a ticket and open it on GitHub. Here, its Spec or
Acceptance criteria shows in the Acceptance criteria field beside the
issue, and its design and tasks in Design notes. GitHub shows a field's
text as typed, so a list reads as written, with its numbers and dashes,
and a table shows its `|` marks. You and your coding agent see no other
difference: the agent still reads the whole ticket, fields included.

**When init can't get an answer, it asks you instead.** That happens
when Claude Code isn't signed in, or when its answer can't be used, such
as a ticket field your tickets don't have. Init prints Claude Code's own
reason and what each factory field holds, then asks where each one goes,
offering the description, which is selected, and your ticket fields. It
shows you the table to confirm as above:

```text
Claude Code's answer could not be used: it failed: Failed to authenticate: OAuth session expired and could not be refreshed.
Choose where each of the factory's fields goes yourself.
```

To have Claude Code suggest them instead, press Ctrl-C, sign in by
running `claude` once, and run `factory init` again. To be asked nothing,
write the four lines above in `.claude/factory.yaml` yourself before you
run `factory init`, as
[`tickets.fields`](configuration.md#ticketsfields) describes.

**Running init again** keeps what the four lines say, and doesn't ask
again. To be asked again, for example after creating another ticket
field, delete the four lines and run `factory init`.

**If you change a line later,** a ticket refined before keeps its
factory fields where they were written, and a ticket field it no longer
uses keeps its text until you clear it. For a ticket not yet built, run
`/factory-refine N` again: it rewrites the four parts where the settings
now say, and leaves your own text as it is.

A heading of your own, such as one your own refiner writes, can go in a
ticket field too: see [`tickets.fields`](configuration.md#ticketsfields).

## You already have agent instructions, settings, or CI workflows

- **Your agent's instructions file:** one line is added at the end,
  importing the factory's rules. Nothing else in it changes. Your own rules
  win where the two disagree.
- **Your agent's settings:** a few hooks are added, and the agent's
  attribution lines are turned off, so a session's commits and pull
  requests carry no line naming an AI: they are yours. A cloud build's
  commits name the agent as their author instead
  ([Builds in the cloud](builds.md)). If your settings already
  say how to attribute, that stays. Your existing hooks, permissions, and
  settings stay as they are.
- **Your skills and agents:** untouched. Everything the factory adds is
  named `factory-...`, so nothing collides.
- **Your CI workflows:** untouched. The factory's are two files,
  `factory.yml` and `factory-review.yml`.
- **`factory init` says what it will write** before it writes, as three
  rows of its plan, `settings`, `files`, and `workflows`, and changes
  nothing if you say no. The pull request it opens shows every file.

On GitHub with Claude Code, [the reference](github/reference.md#what-setup-adds)
names each file.

## A team

- **Each person signs in as themselves.** A teammate who clones the
  repository needs their own logins, and, with a ticket system of its own
  ([planned](developing.md#what-is-built), such as Jira), runs
  `factory init` once for their own token.
  [Where your tokens are kept](credentials.md) says what to do.
- **A person's own session acts as that person.** A commit made by a
  teammate's session goes out under that teammate's account. On your own
  account, a cloud build acts as the one account that owns its token:
  yours, or an account you create for the team's builds
  ([Secrets](github/by-hand.md#secrets)). In an organization whose
  owner has run `factory init --org`, a cloud build acts as the
  organization's own GitHub App
  ([Where your tokens are kept](credentials.md#on-github)).
- **Anyone who can write to the repository is obeyed.** A session takes
  instructions from a review or a comment by an account with write
  access, and from nobody else. There is nothing to list: give a
  teammate write access, and their reviews are answered.
- **Each person installs the factory once,** on their own machine, as
  [the quick start](quick-start.md#1-install) shows. A machine without it
  is told so when a session starts.
- **One version for everyone.** The repository names the version, in
  `.claude/factory.lock`, and each person's `factory` command runs that
  one. After an update merges, each person pulls, and nobody installs
  the factory again: the command downloads the new version the first
  time it runs.
- **One session per ticket.** A session claims a ticket before it starts,
  and a second one is told who holds it.
- **Only labeled tickets are the factory's.** A teammate who works a
  ticket by hand removes the factory label first, and the factory leaves
  its card where they put it
  ([Which tickets are the factory's](workflow.md#which-tickets-are-the-factorys)).
- **One person merges updates.** An update changes the instructions
  everyone's sessions follow, so it always waits for a person.
  [Updating](updating.md) describes it.
- **Check your coding agent's plan.** Read its terms to see that it
  covers the way your team would use the factory, including builds that
  run without anyone watching: nobody has tested that it does
  ([What nobody has tested](limitations.md#what-nobody-has-tested)).

## What it does to your repository, in short

[What it changes](removing.md) says what kinds of things the factory adds,
and how to undo each. The short version:

- Files it owns, all named `factory-...`, and its rules.
- One line in your agent's instructions file, and a few hooks in your
  agent's settings.
- Hooks that stop a session committing on your default branch or force
  pushing, and that run your
  [`commands.before-commit`](configuration.md#commandsbefore-commit)
  commands. They apply to agent sessions on a machine, not to your own
  terminal, and not in the cloud.
- Two CI workflow files, `factory.yml` and `factory-review.yml`. Their
  jobs check that the factory's files are in step, run sessions in the
  cloud, open the factory's updates as pull requests, and run each
  optional part you turn on. A job whose part is off is skipped.
- Comments on tickets it works, and a ticket for each
  [follow-up](workflow.md#follow-ups) you tick in a pull request.
