# Proposal

From [davidbyoung/software-factory#34](https://github.com/davidbyoung/software-factory/issues/34).

## Why

Today `factory-refine` writes everything it settles into the ticket's description: Decisions, a Spec or Acceptance criteria, Mockups, and For the builder. A team whose tickets already have their own fields, such as an "Acceptance criteria" field filled in by hand, wants those parts written there. As in #33, `factory init` asks the coding agent which of the tickets' fields fits each part, shows the answer, and lets the developer accept, change, or refuse it, with the description as the default.

The owner's question, how to handle trackers with several field configurations per ticket type, is answered by the field's name, with no setting per issue type: a ticket that can't hold a field keeps that part in its description.

## What Changes

- `factory init` stops before its first question when the coding agent's command isn't installed.
- `factory init`, when the tickets have text fields and the settings name none of the four ticket-side keys, asks the coding agent which ticket field should hold Decisions, Spec, Acceptance criteria, and For the builder, and shows the answer: `Yes` saves it, `Change some` edits factory fields one by one, and `No` keeps everything in the description.
- `tickets.fields` gains the keys `decisions`, `spec`, `acceptance-criteria`, `for-the-builder`, and a key per heading of the repository's own, valid without a board.
- `factory ticket view` joins a ticket's description and ticket fields into one document, and `factory ticket edit` splits it, so skills and agents see the body they see today.
- The ticket system gains an optional `fields` group; GitHub's are issue fields of the text type.
- `factory doctor` and init's checks report a ticket field the tickets don't have, or one that doesn't hold text.
- `factory config explain` prints the ticket-side keys without a board.
- `docs/existing-repo.md`, `docs/configuration.md`, `docs/github/setup.md`, `docs/quick-start.md`, `docs/skills.md`, `docs/design.md`, and `docs/developing.md` describe it.

## Decisions

if there are any.

- **Acceptance criteria:** the numbered Spec lines, or the criteria list,
  without the `## Spec` heading, since the field's name says what it is.
- **Design notes:** the design and tasks, without the `## For the
builder` heading.

#### What a session sees

Skills and agents read and write a ticket as one document, as they do
today, so none of them changes. `factory ticket view` puts the fields
back under their headings, in the usual order:

```text
$ factory ticket view 12
#12 Let a customer save a cart for later
state: open
labels: enhancement, spec

(your text)

## Decisions
...

## Spec
...        ← from Acceptance criteria

## For the builder
...        ← from Design notes
```

`factory ticket edit 12 --body-file body.md` splits the document the
same way and writes each factory field where it goes. On GitHub every
issue can hold every ticket field, and the test found no length limit a
factory field would reach, so each always goes where the settings say.

_Planned, on Jira:_ when a factory field can't go in its ticket field, it stays in the
description, and `edit` says why on its own line:

```text
$ factory ticket edit PROJ-12 --body-file body.md
For the builder went in the description: issue type Task has no Design notes field.
edited
```

```text
$ factory ticket edit PROJ-12 --body-file body.md
Spec went in the description: it is 41,200 characters, and Acceptance criteria holds 32,767.
edited
```

#### Changing your mind later

Edit the lines under `tickets.fields`. To be asked again, delete the
four lines for the factory's ticket-side fields and run `factory init`.

#### Checking the settings

`factory config check` reads only the file:

```text
$ factory config check
.claude/factory.yaml: tickets.fields.decisions: names the same field as for-the-builder
```

A field your tickets don't have needs the ticket system, so
`factory doctor` and init's own checks report it:

```text
Checks
  ✗ acme/shop's tickets have no field called Acceptance critera, which tickets.fields.spec names
```

```text
Checks
  ✓ acme/shop's tickets have every field the settings name
```

#### Planned: other ticket systems

Not built in this ticket, and recorded in `docs/design.md`:

- **Jira** has custom fields, and a multi-line text field holds up to
  32,767 characters and shows formatting. A field is the same field
  across projects and issue types; a type's field configuration decides
  whether a ticket of that type can hold it.
- **Linear** has no custom text fields, so init asks nothing there.

#### For contributors

All of it is written to interfaces, as #33's column step is. Three
pieces, and only the first is per ticket system:

**1. The ticket system: an optional `fields` group** in
`src/tickets/types.mts`, beside `board` and `blockers`.
`factory ticket supports fields` says whether an adapter has it.

```ts
export type TextField = {
  name: string;
  /** The field's own description, for the agent; null when it has none. */
  description: string | null;
};

export type FieldOps = {
  /** Whether a field shows its text as typed, without formatting, so
   * init says so above its table: true on GitHub. */
  plainText: boolean;
  /** The text fields tickets can have, in the system's order. */
  list(): Promise<TextField[]>;
  /** Whether the ticket can hold the field, and how much: GitHub always
   * can, with no limit; Jira checks the ticket's issue type. */
  holds(
    ticket: number,
    field: string,
  ): Promise<{ max: number | null } | { reason: string }>;
  /** The ticket's text field values, by field name. */
  read(ticket: number): Promise<Record<string, string>>;
};
```

Its fourth member, `write(ticket, values)`, sets each field by name, a
null value clearing it, and resolves with nothing, as `BoardOps.set`
does.

GitHub's adapter implements it with the `repo` scope it already has.
Jira's adapter, when it is built, implements the same four. Its
`holds` reads the issue type's field configuration, and it converts
Markdown to Jira's rich text.

**2. The coding agent:** #33's `answer` method, unchanged. Codex adds
one `answer` and is used by both steps.

**3. The logic, in one module that names neither,** beside
`columns-suggest.mts`:

- the prompt, the answer's schema, its checks, and the table;
- splitting a ticket's document into description and fields, and
  joining them back, which `factory ticket view` and `edit` call.

Nothing else changes for skills, agents, or `factory ticket refined`'s
check, since they see one document.

### The docs page: `docs/existing-repo.md`, "Your tickets already have fields"

A new section, after "You already have a board". The rest of the page is unchanged but for the lines under "The other pages that change".

#### Your tickets already have fields

When you refine a ticket with `/factory-refine N`, the factory writes the
result into the ticket's description, after your own text, under four
headings. These are the factory's fields for a refined ticket:

| Factory field       | What it holds                                              | Its key in the settings |
| ------------------- | ---------------------------------------------------------- | ----------------------- |
| Decisions           | The questions refinement settled, and what was chosen      | `decisions`             |
| Spec                | What a change your users will notice must do, line by line | `spec`                  |
| Acceptance criteria | What must be true for any other ticket to be done          | `acceptance-criteria`   |
| For the builder     | How to build it, as a design and a list of tasks           | `for-the-builder`       |

A ticket has a Spec or Acceptance criteria, never both: refinement writes
a Spec when the change is one
[your users will notice](workflow.md#a-change-your-users-will-see), and
Acceptance criteria otherwise.

If your tickets already have a text field for one of these, such as an
"Acceptance criteria" field your team fills in by hand, the factory can
write that factory field there instead. This page calls a field of yours
on the ticket a ticket field. On GitHub, a ticket field is an
[issue field](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization):
a field set on the issue itself and shown beside it, which you create in
your account's or organization's settings, under Issue fields. A field
you add to your board, which shows as a column of the board's table,
can't hold a factory field: GitHub limits it to 1,024 characters, and a
Spec is often several thousand. Create the issue field before you run
init, since init offers only ticket fields that exist.

When you run `factory init`, step 2 of the
[quick start](quick-start.md#2-set-it-up), it finds your text ticket
fields and asks your coding agent, Claude Code, which of them should hold
each factory field. As for your board's columns, this is one short
request with no tools, and it sends your ticket fields' names and
descriptions and nothing else. Init shows you the answer before it writes
anything. On a repository whose tickets have the text fields Acceptance
criteria, Design notes, and Customer, init shows:

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
Spec and Acceptance criteria can share a ticket field, since a ticket has
only one of them.

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
  then, for each, pick one of your ticket fields or the description. Two
  factory fields can't share a ticket field, except Spec and Acceptance
  criteria.
- **No** saves all four as `none`, so everything stays in the
  description, as it would with no ticket fields.

When your tickets have no text field, init doesn't ask, writes nothing
about them, and prints no check for them.

**It worked when** the checks init prints last include:

```text
Checks
  ✓ acme/shop's tickets have every field the settings name
```

The next ticket you refine, with `/factory-refine N`, has its factory
fields in those ticket fields. GitHub shows a field's text as typed, so a
list reads as written, with its numbers and dashes, and a table shows its
`|` marks. Your coding agent still reads the ticket as one document, so
refining and building work the same with ticket fields as without.

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
again. To be asked again, for example after creating a ticket field,
delete the four lines and run `factory init`.

**If you change a line later,** a ticket refined before keeps its factory
fields where they were written, and a ticket field it no longer uses
keeps its text until you clear it. For a ticket not yet built, run
`/factory-refine N` again to write each factory field where the settings
now say, or move the text by hand.

**A heading of your own** can go in a ticket field too, though init
doesn't suggest one. If your instructions to the agent, or
[a refiner of your own](plugins.md#refiner), add a heading such as
`## Proposed docs`, its key is the heading in lowercase, with hyphens
for spaces:

```yaml
tickets:
  fields:
    proposed-docs: Docs draft
```

### The other pages that change

Each page below shows only the lines that change.

#### `docs/configuration.md`, `tickets.fields`

This replaces the section of the same name.

###### `tickets.fields`

The factory fills in fields of its own: on your board, to show what is
happening to a ticket, and on the ticket itself, to hold what refining
it wrote. This block maps each of these factory fields to the field of
yours that holds it. `factory init` sets up both halves, so most
repositories write nothing here by hand.

```yaml
tickets:
  board: 7
  fields:
    # Factory fields on the board
    session: Agent # fill in your existing "Agent" field instead
    cost: none # never fill in a cost
    # Factory fields on the ticket
    decisions: none
    spec: Acceptance criteria
    acceptance-criteria: Acceptance criteria
    for-the-builder: Design notes
```

**On the board,** besides moving a ticket between columns, the
[board sync](workflow.md#the-board) fills in three factory fields so you
can see at a glance what is happening to a ticket:

- **`session`:** which session is working on the ticket, or "Waiting on
  you".
- **`runs-in`:** whether that session is on someone's machine or in the
  cloud.
- **`cost`:** roughly what refining and building the ticket has cost so
  far.

`factory init` adds board fields called Session, Runs in, and Cost. Name
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

**On the ticket,** refining a ticket writes four factory fields into its
description, each under its own heading. Each can go instead in a ticket
field: a text field set on the ticket itself, which on GitHub is an
[issue field](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization)
you create in your account's or organization's settings. A board field
can't hold one: GitHub limits it to 1,024 characters.

| Key                   | What the factory field holds                                           |
| --------------------- | ---------------------------------------------------------------------- |
| `decisions`           | Decisions: the questions refinement settled, and what was chosen       |
| `spec`                | Spec: what a change your users will notice must do, line by line       |
| `acceptance-criteria` | Acceptance criteria: what must be true for any other ticket to be done |
| `for-the-builder`     | For the builder: how to build it, as a design and a list of tasks      |

`factory init` asks your coding agent to suggest the ticket fields, and
you confirm them: see
[Your tickets already have fields](existing-repo.md#your-tickets-already-have-fields).

- **`none` keeps the factory field in the description,** and so does
  leaving its key out. Unlike the board's three, a factory field never
  goes in a ticket field just because the names match.
- **These keys don't need a board,** since the ticket field belongs to
  the ticket.
- **The ticket field must hold text.** One that doesn't, such as a
  single select, fails `factory doctor` and init's checks, and
  `factory ticket edit` stops, naming it, and writes nothing. On GitHub,
  a ticket field shows its text as typed, without Markdown formatting.
- **Two factory fields can't name the same ticket field,** except `spec`
  and `acceptance-criteria`, since a ticket has only one of them.
- **A heading of your own** can go in a ticket field too: write it in
  lowercase, with hyphens for spaces, so `## Proposed docs` is
  `proposed-docs`.
- **Changing a line** affects tickets refined afterwards. A ticket
  refined before keeps its factory fields where they were written.

`factory config check` stops when two factory fields name the same
ticket field, other than `spec` and `acceptance-criteria`.
`factory doctor` and the checks `factory init` prints last report a
ticket field your tickets don't have.

#### `docs/existing-repo.md`, "You already have a board"

The paragraph on when init stops loses "isn't installed", since init now
stops at its start without Claude Code:

> **Init stops, and changes nothing, when it can't get an answer:** when
> Claude Code isn't signed in, or when its answer can't be used, such as
> one column for two states. It prints why. Then do one of these, and run
> `factory init` again:
>
> - sign in to Claude Code, by running `claude` once;

The rest of the list is unchanged.

#### `docs/github/setup.md`, "What you need"

After the table:

> `factory init` stops before its first question when Claude Code isn't
> installed, and changes nothing. It needs Claude Code to set up the
> coding agent's token, and to suggest your board's columns and your
> tickets' fields.

#### `docs/quick-start.md`, "You need"

> - A supported coding agent, signed in. `factory init` stops without one.

#### `docs/skills.md`, `factory-refine`, "What it writes"

> - The ticket's body: your text first, untouched, then Decisions and
>   Acceptance criteria, or a Spec when the change is visible and not
>   small. Each of these goes in a ticket field of yours instead, when
>   [`tickets.fields`](configuration.md#ticketsfields) names one.

#### `docs/design.md`, after "A state can already take a list of column names."

> Refinement writes each factory field into a ticket field of yours, or
> into the description, by the ticket field's name, with no setting for
> each kind of ticket. A ticket whose kind can't hold the ticket field
> keeps that factory field in its description.
> [_Planned_](developing.md#what-is-built): on Jira, where a kind of
> ticket can leave a field out, a factory field could name a list of
> ticket fields,
> `spec: [Acceptance criteria, AC]`, and go in the first the ticket can
> hold, as a state does with columns. A `fields-by-type` setting would
> hold only the exceptions, if one were ever needed.

#### `docs/developing.md`

**"What is built"** gains a row:

> | Refinement's factory fields in your ticket fields, suggested by `init` | Working |

**"Adding a ticket system"**, the groups table, gains a row:

> | `fields` | `fields` | List the ticket fields that hold text, with their descriptions; say whether a ticket can hold one, and how much; read a ticket's field values; set or clear them |

and after the table:

> The GitHub adapter's `fields` are issue fields, which it reads and
> writes with the `repo` scope. With no fields group, every factory
> field of a refined ticket stays in its description. `factory ticket view` and
> `edit` join and split a ticket's document above the interface, so no
> skill or agent knows whether a ticket has fields.

**"Setting a tool up"** gains:

> `factory init` stops before its first question when the coding agent's
> command isn't installed, by the agent's `installed` method.

## Decisions

- **Where a factory field can go on GitHub:** a text [issue field](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization), never a board field. A test on this repository wrote values into both. A board text field refused anything over 1,024 characters. A text issue field accepted 256 KB and stored it whole, returned 12 KB of #33's Decisions and Spec exactly, apart from GitHub dropping the final newline, and took a value while pinned to no issue type. The `repo` scope lists a repository's issue fields and their pins and sets values; only creating a field needs `user` or `admin:org`.
- **Build it for GitHub now, with Jira _Planned_,** as #33 did. GitHub shows an issue field's text as typed, without Markdown formatting, and init says so above its table. Keeping the factory field in a comment, with only its link in the ticket field, was turned down: it adds a comment the factory has to keep track of, only to work around how GitHub shows fields.
- **The words:** what refinement writes under a heading (Decisions, Spec, Acceptance criteria, For the builder) is a factory field; a field of yours on the ticket that holds one is a ticket field. Init's table is headed `Factory field` and `Ticket field`, and its question is `Use these ticket fields?`.
- **The setting is `tickets.fields`,** which already maps Session, Runs in, and Cost to board fields. It gains `decisions`, `spec`, `acceptance-criteria`, and `for-the-builder`, each a ticket field's name or `none`, which keeps the factory field in the description, as does leaving the key out. These keys don't need `tickets.board`, and none is filled in by a ticket field's name alone. A heading of the repository's own, such as `## Proposed docs`, can be added by hand, as its words in lowercase joined by hyphens (`proposed-docs`); init never suggests one, nor Mockups.
- **Where the suggestion comes from:** the coding agent's `answer` method from #33, given the ticket fields that hold text, with their names and descriptions, and what each factory field holds. It is told to answer the description when no ticket field clearly fits. When the tickets have no text field, init asks nothing and doesn't call the agent.
- **What init writes:** one line for each of the four factory fields, `none` for one that stays in the description, so a later run sees it has asked. `No: keep everything in the description` writes all four as `none`. Init asks only when the settings name none of the four.
- **Init requires the coding agent (the owner's call while drafting):** it stops before its first question, exits 1, and changes nothing when the agent's command isn't installed. This drops the "not installed" text under Found and init's API-key fallback, changes `tool-setup`'s "Init is unchanged with today's tools", and changes #33's Decision "No agent, or an answer that can't be used" for its no-agent half: the column step no longer meets a missing agent. Whether the agent is signed in is found when it is first asked, as now.
- **An answer that can't be used stops init** with exit 1 before the plan, as #33's column step does, with #33's reasons reworded for fields.
- **Sharing a ticket field:** two factory fields can't name the same one, except Spec and Acceptance criteria, since a ticket has only one of them. A ticket field holds its factory field's text without the heading; `factory ticket view` adds the heading back, and reads a ticket field that Spec and Acceptance criteria share as Spec when the ticket has the `spec` label when read, and as Acceptance criteria otherwise, as `factory ticket refined` reads the label. A file with both sections for a shared field is refused rather than one being lost.
- **Skills and agents don't change:** `factory ticket view` joins the description and the ticket fields into one document, and `factory ticket edit` splits it, so `factory-refine`, `factory-build`, `factory-ticket-readiness`, and `factory ticket refined`'s check see the body they see today.
- **Several field configurations per ticket type (the open question):** by the ticket field's name, with no setting per issue type, as #33 answered several workflows. What varies by type is whether a ticket can hold a field: on GitHub every issue can hold every field, and on Jira a factory field that a ticket's type can't hold stays in its description, with a line from `edit` saying why. A list of ticket fields for one factory field, and a `fields-by-type` key holding only exceptions, are recorded in `docs/design.md` as _Planned_.
- **Changing the setting later:** a ticket refined before keeps its factory fields where they were written, and nothing tracks where they used to be. The docs say to refine the ticket again or move the text by hand.
- **The interface:** an optional `fields` group on the ticket system, `FieldOps` in Proposed docs' "For contributors", with `factory ticket supports fields`. The prompt, the checks, the table, and the split and join live in one module that names no agent and no ticket system.
- **Failures are said, not hidden:** reading the ticket fields failing stops init, as reading a board's columns does; settings that name a ticket field with a ticket system that has no fields group make `view` and `edit` exit 1 naming the group, rather than fall back to the description quietly.
- **Blockers:** none. #33 is merged, as #38. #37 (no spec tool) also touches what refinement writes, but neither has to be built first; a conflict between them is a merge conflict.

## Capabilities

### New Capabilities

- `field-suggestion`: init's field step.
- `ticket-fields`: what `tickets.fields`' ticket-side keys mean, and the join and split.

### Modified Capabilities

- `tool-setup`: init requires the coding agent, and its unchanged-output requirement names the field step as an exception.
- `column-suggestion`: the column step's own not-installed stop goes.
- `config-explain`: the ticket-side keys print without a board.

## Impact

`src/init.mts`, a new `src/ticket-fields.mts`, `src/columns-suggest.mts`, `src/agent/claude-code.mts`, `src/tickets/types.mts`, `src/tickets/github.mts`, `src/tickets/index.mts`, `src/tickets/github-setup.mts`, `src/ticket.mts`, `src/config.mts`, `src/explain.mts`, `settings.schema.json`, `tests/memory-tickets.ts`, and the docs above.
