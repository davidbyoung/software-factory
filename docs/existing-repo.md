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
and the factory shows each state as a column of your board. The settings
call the states `backlog`, `refining`, `ready`, `building`, `review`, and
`done`, in that order. `factory init` saves which of your columns shows
each in [`tickets.columns`](configuration.md#ticketscolumns), always all
six, and every factory command needs all six there.

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

**Init stops, and changes nothing, when it can't get an answer:** when
Claude Code isn't signed in, or when its answer can't be used, such as
one column for two states. It prints why. Then do one of these, and run
`factory init` again:

- sign in to Claude Code, by running `claude` once;
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

**Init stops, and changes nothing, when it can't use the answer,** such
as when Claude Code isn't signed in, or names a ticket field your tickets
don't have. It prints why. Then do one of these, and run `factory init`
again:

- if it says Claude Code isn't signed in, sign in by running `claude`
  once;
- otherwise, write the four lines above yourself, as
  [`tickets.fields`](configuration.md#ticketsfields) describes: init
  then doesn't ask.

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
