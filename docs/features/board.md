# The board

For someone who wants every ticket's state in one view. At the end your
board has a column for each state, and Lunamill keeps it up to date.

## What you get

A column for each of a ticket's
[six states](../workflow/README.md#the-six-states), and four fields Lunamill keeps up to date. The board sync, a workflow in your repository
that reads what each session recorded on its ticket, moves each ticket to
its column and fills in the fields
([The fields the sync writes](#the-fields-the-sync-writes)).
`lunamill status` prints the same picture in a terminal.

## What it needs

A board, and a token that can write to it, which init asks for on your
own account ([GitHub Projects](../integrations/github-projects.md)).

## Turn it on

Run `lunamill init` and check "A board". It asks which board to use: a new
one, made with Lunamill's columns, or one you already have, whose
columns it reads ([You already have a board](#you-already-have-a-board)).

**It worked when** `lunamill doctor` shows ✓ beside the board, and the
board shows your open tickets that carry Lunamill's label.

The two sections below are for a board, or tickets, you already have:
which of your columns shows each state, and which of your ticket fields
holds what refinement writes.

### You already have a board

A ticket is always in one of six [states](../workflow/README.md#the-six-states),
and Lunamill shows each state as a column of your board. The settings
call the states `backlog`, `refining`, `ready`, `building`, `review`, and
`done`, in that order. `lunamill init` saves which of your columns shows
each in [`tickets.columns`](../reference/settings/tickets.md#ticketscolumns), always all
six, and every Lunamill command needs all six there.

**In an organization,** the board is chosen once, by the owner who runs
[`lunamill init --org`](../setup/organization.md#set-an-organization-up-once).
For a board the organization already has, that command asks about its
columns exactly as this section shows `lunamill init` doing, and saves
the answer in the organization's [preset](../customize/presets.md), the file
`lunamill-preset.yaml` that its repositories share, where this section
says `.claude/lunamill.yaml`. `lunamill init` in a repository that
follows the preset takes the board from it, and asks nothing about
boards or columns.

When you run `lunamill init`, step 2 of the
[quick start](../get-started/quick-start.md#2-set-it-up), it lists your boards to choose
from. If the one you choose already has Lunamill's own columns,
Backlog, In refinement, Ready, In progress, In review, and Done, init
asks nothing and saves them. Capitals don't matter, so your
"In Progress" is its "In progress":

```text
? Which board? Use an existing one: Shop board (#3)

Board 3 has a column for each of Lunamill's six states:

  State      Column
  backlog    Backlog
  refining   In refinement
  ready      Ready
  building   In Progress
  review     In review
  done       Done
```

If it lacks any, init asks your coding agent which of your columns shows
each state, and shows you the answer before it changes anything. This is
one short request with no tools, made with the sign-in the coding agent
already has, and it sends your column names and nothing else.
On a board with the columns Todo, In Progress, Code review, and Done:

```text
? Which board? Use an existing one: Shop board (#3)

Board 3 has the columns Todo, In Progress, Code review, and Done.
Asking Claude Code which of them shows each of Lunamill's six states...

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
  No: add Lunamill's columns instead
```

A state with no column shows its tickets in the column of the state
before it, so here a ticket being refined stays in Todo. With no column
for ready, you start each build with `/lunamill-build N` in a session,
rather than by moving its ticket on the board. So init offers no column
for ready only when [`builds.trigger`](../reference/settings/builds.md#builds) is
`manual`, the setting for builds that start when you ask.

- **Yes** saves the table in your settings, `.claude/lunamill.yaml`:

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
  for each, pick one of your columns, no column, or a new column with Lunamill's name, which init adds to your board. Each state needs a column
  of its own: two states can't share one.
- **No** adds each of Lunamill's six columns your board lacks, here
  Backlog, In refinement, Ready, and In review, and saves the six
  names Lunamill gives them. Your Todo, In Progress, Code review, and Done columns
  stay. In Progress and Done are used, since their names match. Lunamill ignores the tickets in Todo and Code review: nothing moves or
  builds them until you move them to one of its columns.

Init ends by running its checks. When the columns are right, you see:

```text
Checks
  ✓ Board 3 has every column the settings name
```

**When init can't get an answer, it asks you instead.** That happens
when the coding agent isn't signed in, or when its answer can't be used,
such as one column for two states. Init prints the agent's own reason, then
asks for each state's column in turn, offering your columns, no column,
or a new column with Lunamill's name, and shows you the table to
confirm as above:

```text
Claude Code's answer could not be used: it failed: Failed to authenticate: OAuth session expired and could not be refreshed.
Choose the column for each state yourself.
? Which column shows backlog?
```

To be asked nothing about columns at all, do one of these before you
run `lunamill init`:

- write a `columns` block like the one above in `.claude/lunamill.yaml`
  yourself, with all six states, beside your `board`, as
  [`tickets.columns`](../reference/settings/tickets.md#ticketscolumns) describes. When
  `lunamill config check` ends with `✓ The settings are valid.`, init
  won't ask;
- add the six columns to your board yourself, so init has nothing to ask.

Running init again is safe: it keeps what your settings already say. If
the block leaves a state out, every Lunamill command stops and names it,
and running init asks you only for that state. If you change your
board's columns later, edit the block, or delete it and run
`lunamill init` again for a new suggestion.

Init suggests one column for each state. When two of your columns mean the
same state, such as Code review and QA, write a list in the block
yourself: see [`tickets.columns`](../reference/settings/tickets.md#ticketscolumns).

What else to expect on a board you already use:

- **Lunamill never renames or deletes your columns,** and only adds the
  ones you agree to.
- **It adds three fields to your board,** Session, Runs in, and Cost, and
  overwrites them on every sync, so don't type into them. Your own board
  fields are never touched. [`tickets.fields`](../reference/settings/tickets.md#ticketsfields)
  says what each holds.
- **Your board's own automations**, such as moving a closed ticket to
  Done, have not been tested alongside Lunamill. Turn them off if
  tickets jump unexpectedly.

To see what Lunamill will do with your board at any time, run
`lunamill board check`. It lists each state's column, as the table above
does, and each field the sync fills in, and marks a problem with ✗ on its
row, such as a column your settings name that the board lacks.

### Your tickets already have fields

If your tickets have text fields of their own, such as an "Acceptance
criteria" field your team fills in by hand, Lunamill can write what
it settles when it refines a ticket into those fields instead of the
ticket's description. At the end, refining a ticket fills in your
fields, and the description holds your text and whatever has no field.
If your tickets have no such field, skip this section: nothing changes.

[Refining a ticket](../workflow/refine.md#lunamill-refine), with `/lunamill-refine N`,
writes four parts after your own text, each under its own heading. These
are Lunamill's fields for a refined ticket:

| Lunamill field      | What it holds                                              |
| ------------------- | ---------------------------------------------------------- |
| Decisions           | The questions refinement settled, and what was chosen      |
| Spec                | What a change your users will notice must do, line by line |
| Acceptance criteria | What must be true for any other ticket to be done          |
| For the builder     | How to build it, as a design and a list of tasks           |

A ticket has a Spec or Acceptance criteria, never both: refinement writes
a Spec when the change is one
[your users will notice](specs.md#a-change-your-users-will-see), and
Acceptance criteria otherwise.

This page calls a field of yours that is set on the ticket itself a
ticket field. A field you add to your board can't hold a Lunamill field,
since a Spec is often several thousand characters, more than a board's
field holds ([GitHub Projects](../integrations/github-projects.md#limits-that-come-from-github)
gives its limit). Create the ticket field before you run init, since
init offers only ticket fields that exist
([GitHub Issues](../integrations/github-issues.md#set-it-up) says where).

When you run `lunamill init`, step 2 of the
[quick start](../get-started/quick-start.md#2-set-it-up), it finds your text ticket
fields and asks your coding agent which of them should hold
each Lunamill field. If you already ran init, run it again after creating
the field: it keeps what your settings say and asks only about ticket
fields. As for your board's columns, this is one short request with no
tools, and it sends your ticket fields' names and descriptions and
nothing else. Init shows you the answer before it writes anything. On a
repository whose tickets have the text fields Acceptance criteria,
Design notes, and Customer, init shows:

```text
acme/shop's tickets have the text fields Acceptance criteria, Design notes, and Customer.
Asking Claude Code which of them should hold each of Lunamill's fields...

  Lunamill field        Ticket field
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

A Lunamill field goes in the description unless a ticket field clearly
fits it, so here Decisions stays there, and nothing goes in Customer.
Spec and Acceptance criteria share a ticket field here, since a ticket
has only one of them.

- **Yes** saves the table in your settings, `.claude/lunamill.yaml`, one
  line for each Lunamill field, with `none` for one that stays in the
  description:

  ```yaml
  tickets:
    fields:
      decisions: none
      spec: Acceptance criteria
      acceptance-criteria: Acceptance criteria
      for-the-builder: Design notes
  ```

- **Change some** lets you pick Lunamill fields to change from a list,
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

Then refine a ticket and open it in your ticket system. Here, its Spec
or Acceptance criteria shows in the Acceptance criteria field, and its
design and tasks in Design notes.
[GitHub Issues](../integrations/github-issues.md#limits-that-come-from-github)
says how it shows a field's text. You and your coding agent see no other
difference: the agent still reads the whole ticket, fields included.

**When init can't get an answer, it asks you instead.** That happens
when the coding agent isn't signed in, or when its answer can't be used,
such as a ticket field your tickets don't have. Init prints the agent's own
reason and what each Lunamill field holds, then asks where each one goes,
offering the description, which is selected, and your ticket fields. It
shows you the table to confirm as above:

```text
Claude Code's answer could not be used: it failed: Failed to authenticate: OAuth session expired and could not be refreshed.
Choose where each of Lunamill's fields goes yourself.
```

To have the coding agent suggest them instead, press Ctrl-C, sign it in
([Claude Code](../integrations/claude-code.md#you-need) says how), and run
`lunamill init` again. To be asked nothing,
write the four lines above in `.claude/lunamill.yaml` yourself before you
run `lunamill init`, as
[`tickets.fields`](../reference/settings/tickets.md#ticketsfields) describes.

**Running init again** keeps what the four lines say, and doesn't ask
again. To be asked again, for example after creating another ticket
field, delete the four lines and run `lunamill init`.

**If you change a line later,** a ticket refined before keeps its
Lunamill fields where they were written, and a ticket field it no longer
uses keeps its text until you clear it. For a ticket not yet built, run
`/lunamill-refine N` again: it rewrites the four parts where the settings
now say, and leaves your own text as it is.

A heading of your own, such as one your own refiner writes, can go in a
ticket field too: see [`tickets.fields`](../reference/settings/tickets.md#ticketsfields).

## How it works

### The fields the sync writes

Lunamill writes four fields of the board: its Status, and three of its
own, Session, Runs in, and Cost. Anything you type into those three is
overwritten on the next sync.

| Field   | Shows                                                                                 |
| ------- | ------------------------------------------------------------------------------------- |
| Status  | The column                                                                            |
| Session | Which session is on the ticket, "actions, starting", or "Waiting on you"              |
| Runs in | Whether that session is on a machine or in the cloud                                  |
| Cost    | An estimate of what refining and building the ticket used, summed across its sessions |

Sessions never write the board directly. They record what they did on
the ticket, such as claiming it or what it cost, and then start the
**board sync**, a workflow in your repository's CI that reads what is
recorded on every labeled ticket and sets the board to match. The sync also runs when a
pull request opens, closes, or merges, and once a night to catch
anything else, such as a ticket you closed by hand. Because the record is
on the ticket, its history survives even if the board is rebuilt.

## Its settings

[`tickets.board`](../reference/settings/tickets.md#tickets) names the
board, [`tickets.columns`](../reference/settings/tickets.md#ticketscolumns)
the column that shows each state, and
[`tickets.fields`](../reference/settings/tickets.md#ticketsfields) the
ticket field that holds each Lunamill field. `lunamill init` writes all
three.

## When something goes wrong

Run `lunamill board check`: it marks a problem with ✗ on its row, such as
a column your settings name that the board lacks
([You already have a board](#you-already-have-a-board)).

## On your tools

- [GitHub Projects](../integrations/github-projects.md)
- [GitHub](../integrations/github.md)
- [GitHub organizations](../integrations/github-organizations.md)
