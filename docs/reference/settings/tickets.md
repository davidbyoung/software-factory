# `tickets`

Where your tickets live, and which board shows them.

```yaml
tickets:
  type: github
  board: 1
  columns:
    backlog: Backlog
    refining: In refinement
    ready: Ready
    building: In progress
    review: In review
    done: Done
```

- **`type`** is the ticket system. Only `github` is built, and it is the
  default.
- **`board`** is your board's number. On
  [GitHub Projects](../../integrations/github-projects.md#what-lunamill-uses-it-for)
  it is the last part of its address, such as `1` in
  `github.com/users/your-name/projects/1`. The
  default, `none`, means no board.
- **`columns`** says which of the board's columns shows each state, and a
  board needs it: see [`tickets.columns`](#ticketscolumns).
- **`labels`** renames the labels lunamill puts on tickets: see
  [`tickets.labels`](#ticketslabels). Most repositories leave it out.

Without a board, `lunamill status` still shows every ticket's state, which
lunamill records on the ticket. Builds then start only when
you run `/lunamill-build N` in a session.

One board can show tickets from several repositories. Give each
repository the same `board`. Each repository's board sync,
`lunamill status`, and poller only touch that repository's own tickets.

`lunamill board check` reads your board and says what lunamill will do
with it.

## `tickets.columns`

The board has one column for each of the six
[states](../../workflow/README.md#the-six-states) a ticket goes through. This block
says which of your board's columns shows each state, and it names all
six. `lunamill init` writes it for you, from the board you choose: see
[You already have a board](../../features/board.md#you-already-have-a-board).
There is no default: your board's column names may not be lunamill's, and a guess would put tickets in the wrong column without
telling you.

A new board on [GitHub Projects](../../integrations/github-projects.md#a-board)
starts with only Todo, In Progress, and Done, so its settings would be:

```yaml
tickets:
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

When init creates your board, or adds columns to one, it gives them lunamill's own names:

| Key        | Name of the column init creates |
| ---------- | ------------------------------- |
| `backlog`  | Backlog                         |
| `refining` | In refinement                   |
| `ready`    | Ready                           |
| `building` | In progress                     |
| `review`   | In review                       |
| `done`     | Done                            |

- **Capitals don't matter,** so "In progress" finds your "In Progress".
- **`none` means your board has no column for that state.** A ticket in
  that state stays in the column of the state before it. With
  `review: none`, a ticket whose pull request is in review stays in In
  Progress. Every state can be `none` except `backlog`.
- **A state can take a list of columns,** when more than one of yours
  means it. Init never writes a list, so add one to the block yourself.
  A ticket in any of the columns is in that state. When lunamill
  moves a ticket into the state, it uses the first, and a ticket already
  in any of them stays where it is:

  ```yaml
  tickets:
    board: 7
    columns:
      backlog: Todo
      refining: none
      ready: none
      building: In Progress
      # When a pull request opens, its ticket moves to Code review.
      # One you moved to QA stays there.
      review: [Code review, QA]
      done: Done
  ```

  `ready` takes one column, since only a ticket you approved goes there.

  A list for `done` keeps the columns that come after the merge, which
  are your team's: lunamill moves a merged ticket to the first column
  in the list, here Done, and never moves one out of any of them.

  ```yaml
  done: [Done, UAT, Released]
  ```

- **A ticket never stays in the ready column unless you approved it.**
  With `building: none`, a ticket being built would stay in ready's
  column, so it stays in refining's column instead. On a board with lunamill's columns and `building: none`, it shows in In refinement.
- **With `ready: none`, nothing on the board approves a build,** so you
  need `builds.trigger: manual`, and you start each build by asking a
  session.
- **A ticket in a column no state uses is left alone.** The board sync
  doesn't move it or fill in its fields, and nothing builds it.

`lunamill config check` stops, naming the key, when `columns` has:

- no `board` beside it, or a `board` with no `columns`;
- a state left out, naming each one;
- a state it doesn't know;
- `backlog: none`;
- one column for two states;
- an empty list, or a list for `ready`;
- `ready: none` while [`builds.trigger`](builds.md#builds) isn't `manual`,
  since then a build starts only from the ready column.

Such as:

```text
.claude/lunamill.yaml: tickets.columns: building and done have no column: give each a column, a list of columns, or none, or run lunamill init to choose them
```

`lunamill config check` doesn't read your board. `lunamill board check`
does, and says which of the columns you named the board lacks.

## `tickets.fields`

lunamill fills in fields of its own in two places: on your board,
to show what is happening to a ticket, and on the ticket itself, to hold
the result of refining it. This block maps each of these lunamill fields
to the field of yours that holds it: a board field, or a ticket field
set on the ticket itself. `lunamill init` sets up both the board fields
and the ticket fields, so most repositories write nothing here by
hand.

```yaml
tickets:
  board: 7
  fields:
    # lunamill fields on the board
    session: Agent # fill in your existing "Agent" field instead
    cost: none # never fill in a cost
    # lunamill fields on the ticket
    decisions: none
    spec: Acceptance criteria
    acceptance-criteria: Acceptance criteria
    for-the-builder: Design notes
```

**On the board,** besides moving a ticket between columns, the
[board sync](../../features/board.md) fills in three lunamill fields so you
can see at a glance what is happening to a ticket:

- **`session`:** which session is working on the ticket, or "Waiting on
  you".
- **`runs-in`:** whether that session is on someone's machine or in the
  cloud.
- **`cost`:** roughly what refining and building the ticket has cost so
  far.

`lunamill init` adds board fields called Session, Runs in, and Cost. Name
a board field here only when your board already has one you want used
instead, or write `none` to stop the board sync filling one in.

- **These three need [`board`](#tickets).**
- **A board field you name must exist,** holding the right kind of
  value: text for `session`, a single select with the options Local and
  Actions for `runs-in`, and a number for `cost`. If it doesn't, the
  board sync stops and says which field is wrong.
- **When you name nothing,** the board sync looks for board fields
  called Session, Runs in, and Cost, fills in those it finds, and skips
  the rest with a note.
- **It never overwrites a field of yours.** If your board has a field
  called Cost that holds text, the board sync stops rather than write
  over it, and asks you to name another field or write `cost: none`.
- **The column itself is the board's own Status field,** which has to be
  a single select with an option for each column in
  [`tickets.columns`](#ticketscolumns).

**On the ticket,** refining a ticket writes four lunamill fields into its
description, each under its own heading. Each can go instead in a ticket
field that holds text, which on
[GitHub Issues](../../integrations/github-issues.md) is an issue field: see
[Your tickets already have fields](../../features/board.md#your-tickets-already-have-fields),
which also says why a board field can't hold one.

| Key                   | What lunamill field holds                                                                                                                                |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `decisions`           | Decisions: the questions refinement settled, and what was chosen                                                                                         |
| `spec`                | Spec: what a change your users will notice must do, line by line                                                                                         |
| `acceptance-criteria` | Acceptance criteria: what must be true for any other ticket to be done                                                                                   |
| `for-the-builder`     | For the builder: how to build it, as a design and a list of tasks                                                                                        |
| `repositories`        | Repositories: which repositories a ticket changes, and the order they merge in, when it names [more than its own](../../workflow/across-repositories.md) |

`lunamill init` asks your coding agent to suggest the ticket fields, and
you confirm them.

- **`none` keeps lunamill field in the description,** and so does
  leaving its key out. Unlike the board's three, a lunamill field never
  goes in a ticket field just because the names match.
- **A ticket field is named as the ticket system shows it,** capitals
  included.
- **These keys don't need a board,** since the ticket field belongs to
  the ticket.
- **The ticket field must exist and hold text.** One that doesn't, such
  as a single select, fails the checks [`lunamill doctor`](../cli.md#setting-up)
  and init print, and refining a ticket stops, naming it, and writes
  nothing.
- **Two lunamill fields can't name the same ticket field,** except `spec`
  and `acceptance-criteria`, since a ticket has only one of them.
  `lunamill config check` stops on any other pair.
- **A heading of your own,** such as one
  [a refiner of your own](../../customize/plugins.md#refiner) writes, can go in a ticket
  field too: write it in lowercase, with hyphens for spaces, so
  `## Proposed docs` is `proposed-docs`.
- **Changing a line** affects tickets refined afterwards. A ticket
  refined before keeps its lunamill fields where they were written.

## `tickets.labels`

The names of the three labels lunamill puts on tickets. Most
repositories never set them: leave the block out, and lunamill uses
the default names. To rename a label on pull requests instead, see
[`code-host.labels`](code-host.md#code-hostlabels).

Each label has a key and a name. The key is what you write on the left,
and never changes. The name is what your ticket system shows, and is
what you set:

```yaml
tickets:
  labels:
    spec: needs-spec # refinement adds needs-spec, not spec
```

| Key        | Default name | What the label marks                                                                                                              |
| ---------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `spec`     | `spec`       | A change your users will see, so [refinement writes a Spec](../../features/specs.md#a-change-your-users-will-see) into the ticket |
| `lunamill` | `lunamill`   | A ticket lunamill works on: [Which tickets are lunamill's](../../workflow/tickets.md#which-tickets-are-lunamills)                 |

- **Write only the keys you change.** A key you leave out keeps its
  default name. `lunamill init` doesn't ask about labels, and doesn't write
  this block.
- **You don't create the label.** lunamill creates it in the ticket
  system the first time it adds it to a ticket.
- **Two labels can't share a name,** and capitals don't make two names
  different, so `Spec` and `spec` are one label. Where the ticket system
  keeps its labels with the code host's, as
  [GitHub Issues](../../integrations/github-issues.md#what-lunamill-can-and-cannot-do-there)
  does, a name here can't match one under `code-host.labels` either,
  since one repository's labels serve its tickets and its pull requests.
- **Quote a name with `: ` in it,** such as `spec: "kind: spec"`.
  Without the quotes, YAML can't read the file.

To rename a label:

1. Write the new name under `tickets.labels` in `.claude/lunamill.yaml`.
2. If tickets already carry the label, rename it in the ticket system to
   the same name
   ([GitHub Issues](../../integrations/github-issues.md#by-hand) says
   where). That moves every ticket that has it. lunamill finds tickets only by the name in your settings and
   never renames a label, so until you do, it doesn't see them: a
   ticket still labeled `spec` is built without its Spec. Renaming `lunamill`
   hides every ticket that carries the old name until you rename the label in
   the ticket system too.
3. Check the file and sync, as for every setting:

   ```console
   $ lunamill config check
   ✓ The settings are valid.
   $ lunamill sync
   wrote .claude/lunamill.lock
   ```

4. Commit `.claude/lunamill.yaml` and `.claude/lunamill.lock`.

`lunamill config check` names a label it refuses, and why:

```text
.claude/lunamill.yaml: tickets.labels.spec: must not be empty
.claude/lunamill.yaml: tickets.labels.spec: "lunamill" is already tickets.labels.lunamill. Give each label its own name
```

**It worked when** `lunamill config explain` shows your names under
`tickets.labels`, without `# default` after them, and
`lunamill ticket view N` on a ticket with the label shows it with its
key, such as `labels: needs-spec (spec)`.
