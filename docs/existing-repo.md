# Adopting it in an existing repository

Most repositories already have a toolchain, a board, instructions for a
coding agent, or a team. This page says what the factory does in each case,
and what it leaves alone.

## Try it without committing to it

Do the [quick start](quick-start.md) on a branch and do not merge it. Start
an agent session on that branch and refine and build one ticket. If you
decide against it, delete the branch. [Removing it](removing.md) covers the
case where you have already merged.

## A repository that is not JavaScript

The factory's tool runs on Node and is installed with npm, whatever your
project is written in. In a PHP, Python, or Go repository that means:

- **A `package.json` appears**, holding one development dependency and
  nothing else. Make it yourself before installing, marked private so it
  can never be published:

  ```bash
  echo '{ "private": true }' > package.json
  ```

  Without one, npm installs into the nearest folder above that has a
  `package.json`, if there is one, rather than into your repository.

- **`package-lock.json` is committed.** It is what keeps everyone on the
  same version of the factory.
- **`node_modules/` is ignored.** `factory init` adds it
  to your `.gitignore`.
- **Everyone who works on the repository needs Node 22.18 or later**, and
  runs `npm ci` once after cloning.
- **Your own CI does not change.** The factory's cloud jobs install Node
  for themselves. If you turn on the automated review, how it installs your
  project, such as `composer install`, is yours to edit.
- **Your commands stay yours.** The gate a build runs, and everything
  else under [`commands`](configuration.md#commands) in the settings, is
  whatever your project runs: `composer test`, `make check`,
  `go vet ./...`.

The factory's hooks run its own tool, so they need nothing beyond Node.
Someone who only writes code by hand, and never runs an agent session in
the repository, needs none of this.

[Configuration](configuration.md#a-project-that-isnt-javascript) has a
complete settings file for a PHP library.

## You already have a board

A ticket is always in one of six [states](workflow.md#the-six-states),
and the factory shows each state as a column of your board. Its own names
for them are Backlog, In refinement, Ready, In progress, In review, and
Done, and the settings call the states `backlog`, `refining`, `ready`,
`building`, `review`, and `done`, in that order. Capitals don't matter, so
your "In Progress" is its "In progress".

When you run `factory init`, step 2 of the
[quick start](quick-start.md#2-set-it-up), it lists your boards to choose from. If the
one you choose has all six columns, there is nothing to set up. If it
lacks any, init asks your coding agent, Claude Code, which of your
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
  refining   no column, shows in Todo
  ready      no column: builds start only when you ask
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
rather than by moving its ticket on the board. That is the factory's
default, so the settings need nothing more: init offers no column for
ready only when builds start when you ask.

- **Yes** saves the table in your settings, `.claude/factory.yaml`, with
  only the states whose column isn't the factory's own name:

  ```yaml
  tickets:
    board: 3
    columns:
      backlog: Todo
      refining: none
      ready: none
      review: Code review
  ```

- **Change some** lets you pick the states to change from a list, then,
  for each, pick one of your columns, no column, or a new column with the
  factory's name, which init adds to your board. Each state needs a column
  of its own: two states can't share one.
- **No** adds each of the factory's six columns your board lacks, here
  Backlog, In refinement, Ready, and In review, and saves nothing. Your
  Todo, In Progress, Code review, and Done columns stay. In Progress and
  Done are used, since their names match. The factory ignores the tickets
  in Todo and Code review: nothing moves or builds them until you move
  them to one of its columns.

Init ends by running its checks. When the columns are right, you see:

```text
Checks
  ✓ Board 3 has every column the settings name
```

**Init stops, and changes nothing, when it can't get an answer:** when
Claude Code isn't installed or isn't signed in, or when its answer can't
be used, such as one column for two states. It prints why. Then do one of
these, and run `factory init` again:

- install Claude Code and sign in, by running `claude` once;
- write a `columns` block like the one above in `.claude/factory.yaml`
  yourself, with your own columns, as
  [`tickets.columns`](configuration.md#ticketscolumns) describes: init
  then doesn't ask;
- add the six columns to your board yourself, so init has nothing to ask.

Running init again is safe: it keeps what your settings already say. Once
they have a `columns` block, init doesn't ask about columns again. If you
change your board's columns later, edit the block, or delete it and run
`factory init` again for a new suggestion.

Init suggests one column for each state. When two of your columns mean the
same state, such as Code review and QA, write a list in the block
yourself: see [`tickets.columns`](configuration.md#ticketscolumns).

What else to expect on a board you already use:

- **The factory never renames or deletes your columns,** and only adds the
  ones you agree to.
- **It adds three fields to your board,** Session, Runs in, and Cost, and
  overwrites them on every sync, so don't type into them. Your own fields
  are never touched. [`tickets.fields`](configuration.md#ticketsfields)
  says what each holds.
- **Your board's own automations**, such as moving a closed ticket to
  Done, have not been tested alongside the factory. Turn them off if
  tickets jump unexpectedly.

To see what the factory will do with your board at any time, run
`factory board check`. It lists each state's column, as the table above
does, and ends with any problem, such as a column your settings name that
the board lacks.

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
- **Your CI workflows:** untouched. The factory's are named `factory-...`.
- **`factory init` lists every file** it would write or
  change before it writes, and changes nothing if you say no.

On GitHub with Claude Code, [the reference](github/reference.md#what-setup-adds)
names each file.

## A team

- **A person's own session acts as that person.** A commit made by a
  teammate's session goes out under that teammate's account. A cloud build
  acts as the one account that owns its token: yours, or an account you
  create for the team's builds
  ([Secrets](github/by-hand.md#secrets)).
- **Say who approves.** By default only the repository's owner can approve
  a ticket for building or give a session instructions in a comment. List
  the others under [`approvers`](configuration.md#approvers), _[Planned](developing.md#what-is-built)_.
- **One version for everyone.** The version is pinned in
  `package-lock.json`. After an update merges, each person pulls and runs
  `npm ci`. `factory doctor` says so when the installed
  version and the repository's disagree.
- **One session per ticket.** A session claims a ticket before it starts,
  and a second one is told who holds it.
- **One person merges updates.** An update changes the instructions
  everyone's sessions follow, so it always waits for a person.
  [Updating](updating.md) describes it.
- **Check your coding agent's plan** covers the way your team would use
  this, including builds that run without anyone watching.

## What it does to your repository, in short

[What it changes](removing.md) says what kinds of things the factory adds,
and how to undo each. The short version:

- Files it owns, all named `factory-...`, and its rules.
- One line in your agent's instructions file, and a few hooks in your
  agent's settings.
- Hooks that stop a session committing on your default branch or force
  pushing, and that run your
  [`commands.before-commit`](configuration.md#commandsbefore-commit)
  commands. They apply to agent sessions, not to your own terminal.
- Its CI workflows: one that checks the factory's files are in step, the
  ones that run a session in the cloud, and one more for each optional part
  you turn on. With a Dependabot configuration, two more complete
  Dependabot's pull requests, the factory's own updates among them.
- Comments on tickets it works, and one "Follow-ups" ticket.
