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
  agents, and rules into your repository, choosing which ones from this
  file, writes its two workflow files, and writes the settings in effect
  into `.claude/factory.lock`. It has nothing to do with the board sync.
- **Skill and agent:** a skill is a set of instructions a session follows,
  and an agent is a separate reviewer a session launches to read something
  and report back.

The [glossary](glossary.md) has the rest.

## How the file works

- **Three settings are required, and a fourth before any build.** Every
  file has [`version`](#version), [`repository`](#repository), and
  [`code-host.branch-name`](#code-host), which `factory init` writes for
  you, and a session can't build a ticket until you set
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
- **Every command reads the lock, not this file.** `factory sync` combines
  the factory's defaults, any [`presets`](#presets) you list, and this
  file, and writes every setting the factory will use, defaults included,
  into `.claude/factory.lock`, which you commit and never edit. Until you
  sync after a change, every command stops and says so, but the ones that
  fix or report it: `factory sync`, `factory doctor`,
  `factory config check`, and the `factory preset` commands.

  ```text
  .claude/factory.yaml changed since the last sync. Run: factory sync
  ```

  [`factory config explain`](cli.md) prints the settings in effect, each
  marked with where its value came from.

## The shortest file

These are the settings the factory needs before a session can build a
ticket. Every other setting has a default.

```yaml
version: 2
repository: your-name/your-repo
code-host:
  branch-name: "{ticket}"
commands:
  gate:
    - npm test
```

- [`version`](#version), [`repository`](#repository), and
  [`code-host.branch-name`](#code-host) are required by every command,
  and `factory init` writes all three. Without one, every command stops
  and names it. `"{ticket}"` is a pattern: ticket 12 is built on a branch
  named `12`. The code host is GitHub unless you say otherwise.
- [`commands.gate`](#commandsgate) is how a session checks a change, such
  as your tests and linter. `factory init` asks for one command and
  writes it. Left empty, it lists the gate under "Left to do", and you
  add it. Without it the factory still [refines](workflow.md) tickets,
  but a session can't build one.

With these, the factory refines a ticket when you run `/factory-refine N`
in a session, builds it when you run `/factory-build N`, nothing merges
without you, and there is no board.

**With a board,** two more settings are required. Skip this part if you
have none:
[`tickets.board`](#tickets), your GitHub Project's number, and
[`tickets.columns`](#ticketscolumns), which of its columns shows each of
the six [states](workflow.md#the-six-states) a ticket goes through.
`factory init` writes both from the board you choose:

```yaml
tickets:
  board: 1
  columns:
    backlog: Backlog
    refining: In refinement
    ready: Ready
    building: In progress
    review: In review
    done: Done
```

Every state needs a line. For a state your board has no column for,
write `none` as its column. By default nothing starts a build when a
ticket reaches Ready ([`builds.trigger`](#builds) is `manual`); if you
set it to `own-server` or `github-action`, `ready` must name a column.

`factory init` may write more, such as [`tickets.fields`](#ticketsfields)
when you confirm the ticket fields it suggests. None of it is required.

**It worked when** `factory config check` prints
`✓ The settings are valid.`

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

`factory config check` prints `✓ The settings are valid.` when the file
is valid, and names the setting when it is not. `factory sync` then rewrites the lock and the
copied files that depend on what you changed, and lists each file it
wrote. Every change needs it, one under `plugins` included, as
[How the file works](#how-the-file-works) says.

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

- **Default:** none. `factory init` writes it. It proposes the
  repository from your checkout's remotes, whatever each is called, and
  asks which one you are setting up when they name a fork or more than
  one repository. Once the line is written, nothing works it out again.
- **If it is wrong,** commands read and write another repository's
  tickets, or fail because it does not exist. A command that reads the
  default branch, such as `factory sync`, stops when no remote of your
  checkout is that repository:

  ```text
  ✗ repository: .claude/factory.yaml says acme/web, and no remote here is acme/web. origin is dev/web. Add the remote, or change the line and run factory sync.
  ```

- **In a run in the cloud too, commands take the repository from this
  line,** and not from the run. After you rename a repository, change the
  line: the "Factory files in step" check fails on each pull request until
  you do, with both names:

  ```text
  ✗ repository: .claude/factory.yaml says acme/web, and this pull request is in acme/website. Change the line and run factory sync.
  ```

It is written down rather than worked out from your checkout, because the
[poller](#builds), which watches your board from outside any checkout,
needs it too.

### `presets`

Settings shared by several repositories, each a folder in a repository
on your code host, listed in the order they apply: a later preset wins
over an earlier one, and your own settings in this file win over every
preset's.

```yaml
presets:
  - acme/factory-config # what every Acme repository shares
  - acme/factory-config//node # extra settings for its Node repositories
```

- **Default:** none.
- **A name is the repository that holds the preset,** written
  `OWNER/NAME`. A preset kept in a folder of that repository adds `//`
  and the folder: `OWNER/NAME//FOLDER`.
- **Add or remove one** with `factory preset add NAME` or
  `factory preset remove NAME`, which edit this list, pin the preset to
  one commit of its repository in `.claude/factory.lock`, or drop that
  pin, and sync. A name written here by hand is not pinned, so the next
  sync stops and names the command that pins it.
- **A repository not set up yet** names its presets as `factory init`
  sets it up: with `factory init --preset NAME`, once for each, or from
  the list init offers ([Adding a preset](presets.md#adding-a-preset)).
- **A preset can't set** `repository`, `auto-merge.allow`, or
  `auto-merge.commands`, and can't list other presets
  ([why](presets.md#what-a-preset-cant-set)).

[Presets](presets.md) says how they combine, how to choose between two
that disagree, and how to write one.

### `tickets`

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
- **`board`** is your GitHub Project's number: the last part of its
  address, such as `1` in `github.com/users/your-name/projects/1`. The
  default, `none`, means no board.
- **`columns`** says which of the board's columns shows each state, and a
  board needs it: see [`tickets.columns`](#ticketscolumns).
- **`labels`** renames the labels the factory puts on tickets: see
  [`tickets.labels`](#ticketslabels). Most repositories leave it out.

Without a board, `factory status` still shows every ticket's state, which
the factory records on the ticket. Builds then start only when
you run `/factory-build N` in a session.

One board can show tickets from several repositories. Give each
repository the same `board`. Each repository's board sync,
`factory status`, and poller only touch that repository's own tickets.

`factory board check` reads your board and says what the factory will do
with it.

#### `tickets.columns`

The board has one column for each of the six
[states](workflow.md#the-six-states) a ticket goes through. This block
says which of your board's columns shows each state, and it names all
six. `factory init` writes it for you, from the board you choose: see
[You already have a board](existing-repo.md#you-already-have-a-board).
There is no default: your board's column names may not be the
factory's, and a guess would put tickets in the wrong column without
telling you.

A new GitHub Project starts with only Todo, In Progress, and Done,
so its settings would be:

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

When init creates your board, or adds columns to one, it gives them the
factory's own names:

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
  A ticket in any of the columns is in that state. When the factory
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
  are your team's: the factory moves a merged ticket to the first column
  in the list, here Done, and never moves one out of any of them.

  ```yaml
  done: [Done, UAT, Released]
  ```

- **A ticket never stays in the ready column unless you approved it.**
  With `building: none`, a ticket being built would stay in ready's
  column, so it stays in refining's column instead. On a board with the
  factory's columns and `building: none`, it shows in In refinement.
- **With `ready: none`, nothing on the board approves a build,** so you
  need `builds.trigger: manual`, and you start each build by asking a
  session.
- **A ticket in a column no state uses is left alone.** The board sync
  doesn't move it or fill in its fields, and nothing builds it.
- **If you host your own poller,** it needs `FACTORY_READY_COLUMN` set
  to the column `ready` names: see
  [Builds](builds.md#what-it-reads-from-its-environment).

`factory config check` stops, naming the key, when `columns` has:

- no `board` beside it, or a `board` with no `columns`;
- a state left out, naming each one;
- a state it doesn't know;
- `backlog: none`;
- one column for two states;
- an empty list, or a list for `ready`;
- `ready: none` while [`builds.trigger`](#builds) isn't `manual`,
  since then a build starts only from the ready column.

Such as:

```text
.claude/factory.yaml: tickets.columns: building and done have no column: give each a column, a list of columns, or none, or run factory init to choose them
```

`factory config check` doesn't read your board. `factory board check`
does, and says which of the columns you named the board lacks.

#### `tickets.fields`

The factory fills in fields of its own in two places: on your board,
to show what is happening to a ticket, and on the ticket itself, to hold
the result of refining it. This block maps each of these factory fields
to the field of yours that holds it: a board field, or a ticket field
set on the ticket itself. `factory init` sets up both the board fields
and the ticket fields, so most repositories write nothing here by
hand.

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
field that holds text, which on GitHub is an issue field: see
[Your tickets already have fields](existing-repo.md#your-tickets-already-have-fields),
which also says why a board field can't hold one.

| Key                   | What the factory field holds                                                                                                              |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `decisions`           | Decisions: the questions refinement settled, and what was chosen                                                                          |
| `spec`                | Spec: what a change your users will notice must do, line by line                                                                          |
| `acceptance-criteria` | Acceptance criteria: what must be true for any other ticket to be done                                                                    |
| `for-the-builder`     | For the builder: how to build it, as a design and a list of tasks                                                                         |
| `repositories`        | Repositories: which repositories a ticket changes, and the order they merge in, when it names [more than its own](across-repositories.md) |

`factory init` asks your coding agent to suggest the ticket fields, and
you confirm them.

- **`none` keeps the factory field in the description,** and so does
  leaving its key out. Unlike the board's three, a factory field never
  goes in a ticket field just because the names match.
- **A ticket field is named as GitHub shows it,** capitals included.
- **These keys don't need a board,** since the ticket field belongs to
  the ticket.
- **The ticket field must exist and hold text.** One that doesn't, such
  as a single select, fails the checks [`factory doctor`](cli.md#setting-up)
  and init print, and refining a ticket stops, naming it, and writes
  nothing.
- **Two factory fields can't name the same ticket field,** except `spec`
  and `acceptance-criteria`, since a ticket has only one of them.
  `factory config check` stops on any other pair.
- **A heading of your own,** such as one
  [a refiner of your own](plugins.md#refiner) writes, can go in a ticket
  field too: write it in lowercase, with hyphens for spaces, so
  `## Proposed docs` is `proposed-docs`.
- **Changing a line** affects tickets refined afterwards. A ticket
  refined before keeps its factory fields where they were written.

#### `tickets.labels`

The names of the three labels the factory puts on tickets. Most
repositories never set them: leave the block out, and the factory uses
the default names. To rename a label on pull requests instead, see
[`code-host.labels`](#code-hostlabels).

Each label has a key and a name. The key is what you write on the left,
and never changes. The name is what your ticket system shows, and is
what you set:

```yaml
tickets:
  labels:
    spec: needs-spec # refinement adds needs-spec, not spec
    follow-up: follow-ups # the follow-ups ticket carries follow-ups
```

| Key         | Default name | What the label marks                                                                                                  |
| ----------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `spec`      | `spec`       | A change your users will see, so [refinement writes a Spec](workflow.md#a-change-your-users-will-see) into the ticket |
| `follow-up` | `follow-up`  | The one [follow-ups ticket](workflow.md#follow-ups)                                                                   |
| `factory`   | `factory`    | A ticket the factory works on: [Which tickets are the factory's](workflow.md#which-tickets-are-the-factorys)          |

- **Write only the keys you change.** A key you leave out keeps its
  default name. `factory init` doesn't ask about labels, and doesn't write
  this block.
- **You don't create the label.** The factory creates it on GitHub the
  first time it adds it to a ticket.
- **Two labels can't share a name,** and capitals don't make two names
  different, so `Spec` and `spec` are one label. On GitHub, a name here
  can't match one under `code-host.labels` either, since one
  repository's labels serve its tickets and its pull requests.
- **Quote a name with `: ` in it,** such as `spec: "kind: spec"`.
  Without the quotes, YAML can't read the file.

To rename a label:

1. Write the new name under `tickets.labels` in `.claude/factory.yaml`.
2. If tickets already carry the label, rename it on GitHub to the same
   name, under Issues, Labels, Edit. That moves every ticket that has
   it. The factory finds tickets only by the name in your settings and
   never renames a label, so until you do, it doesn't see them: a
   follow-ups ticket still labeled `follow-up` is ignored, and the next
   follow-up a session records opens a new one. Renaming `factory` hides
   every ticket that carries the old name until you rename the label on
   GitHub too. If you
   host the poller, also set `FACTORY_LABEL` to the new name
   ([Builds](builds.md#what-it-reads-from-its-environment)).
3. Check the file and sync, as for every setting:

   ```console
   $ factory config check
   ✓ The settings are valid.
   $ factory sync
   wrote .claude/factory.lock
   ```

4. Commit `.claude/factory.yaml` and `.claude/factory.lock`.

`factory config check` names a label it refuses, and why:

```text
.claude/factory.yaml: tickets.labels.spec: must not be empty
.claude/factory.yaml: tickets.labels.spec: "follow-up" is already tickets.labels.follow-up. Give each label its own name
```

**It worked when** `factory config explain` shows your names under
`tickets.labels`, without `# default` after them, and
`factory ticket view N` on a ticket with the label shows it with its
key, such as `labels: needs-spec (spec)`.

### `code-host`

Where your repository and its pull requests live. It also sets what
every [build](#words-this-page-uses) names the branch it pushes, in a
session on your machine and in the cloud alike, and what the labels on
pull requests are called.

```yaml
code-host:
  type: github
  branch-name: "feature/{user}/{ticket}"
```

- **`type`** is the code host. GitHub is the only one so far, and it is
  the default.
- **`branch-name`** is the pattern for the branch's name. It has no
  default: [`factory init`](github/setup.md) asks for it and offers
  `{ticket}`, so ticket 12 is built on a branch named `12`. A
  [preset](#presets) can set it for every repository that follows it,
  and in an organization `factory init --org` asks for it once and
  writes it in the preset.
- **`labels`** renames the labels on pull requests: see
  [`code-host.labels`](#code-hostlabels). Most repositories leave it out.

Without `branch-name`, `factory config check` stops:

```text
.claude/factory.yaml: code-host.branch-name: is required. Run factory init to set it, or add it, such as branch-name: "{ticket}"
```

A pattern uses these placeholders. It must have `{ticket}`; `{user}` is
for a convention that names who did the work, and a pattern can leave
it out:

| Placeholder | What it becomes                      | For ticket 12 |
| ----------- | ------------------------------------ | ------------- |
| `{ticket}`  | The ticket's key, without `#`        | `12`          |
| `{user}`    | The GitHub account the build runs as | `octocat`     |

In a session, `{user}` is the account the GitHub CLI, `gh`, is signed in
as, exactly as GitHub spells it, so the same ticket built by two people
gets two branches. In GitHub Actions, it is the owner of
the [token the build runs with](github/reference.md#workflows), not
whoever approved the ticket, so with a shared bot account every branch
built in Actions carries the bot's name. Where a build acts as an
organization's App, `{user}` is the App's name as GitHub writes it in
an address, such as `software-factory-for-acme`.

Keep the quotes, as in the examples. YAML reads an unquoted
`branch-name: {ticket}` as a map rather than as text, and
`factory config check` stops and says to quote it.

`{ticket}` gives each ticket its own branch, and the same branch every
time. So a ticket built a second time, such as the
[follow-ups ticket](workflow.md#follow-ups), a reopened ticket, or one whose first
build stopped, finds its earlier branch still on GitHub, unless GitHub
deleted it when its pull request merged. What the build does depends on
that branch's newest pull request:

- **Merged, with nothing pushed to the branch since:** the build deletes
  the old branch and starts fresh, since its work is already merged.
- **Open:** the build stops before it starts and names the pull request.
  Work that one instead, with `/factory-address-review N` for pull
  request N.
- **Anything else:** closed without merging, no pull request at all, or
  merged with commits pushed since. The build stops before it starts, so
  no work is lost:

  ```text
  Branch 12 is already on origin, with work no pull request merged. Open a pull request from it to keep that work, or delete it with: git push origin --delete 12
  ```

  A build that stopped partway pushes its branch so its work is kept. To
  keep it, open a pull request from the branch on GitHub. Otherwise
  delete the branch, and build the ticket again with `/factory-build 12`.

Once you change the pattern, run `factory config check`, then
`factory sync` (every setting needs it, as
[How the file works](#how-the-file-works) says), then see what the
pattern gives one ticket:

```console
$ factory config check
✓ The settings are valid.
$ factory ticket branch 12
feature/octocat/12
```

`factory config check` stops on a placeholder it doesn't know, a pattern
without `{ticket}`, and a pattern git can't use as a branch name. Git
refuses a name that:

- has a space, a control character, `..`, `//`, or `@{`
- has any of `~`, `^`, `:`, `?`, `*`, `[`, or `\`
- starts with `-` or `/`, or ends with `/`, `.`, or `.lock`
- has a part between slashes that starts with `.` or ends with `.lock`

Anything else is fine, `#` and `_` included. The check names the first
fault it finds:

```text
.claude/factory.yaml: code-host.branch-name: feature//{ticket} can't be a git branch name: it has //
```

Commit `.claude/factory.yaml` and `.claude/factory.lock`. The next build
uses the new pattern; branches already pushed keep their names.

#### `code-host.labels`

The names of the three labels on pull requests. They stay on your code
host whatever ticket system you use. Most repositories never set them:
leave the block out, and each label's name is its key.

```yaml
code-host:
  branch-name: "{ticket}"
  labels:
    merge-automatic: auto-merge
    merge-manual: needs-owner
    verdict-override: owner-pass
```

| Key                | What the label marks                                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `merge-automatic`  | The pull request [merges itself](workflow.md#who-merges) once every check passes                                                              |
| `merge-manual`     | The pull request [waits for a person](workflow.md#who-merges) to merge it                                                                     |
| `verdict-override` | A person passed the automated review's verdict on the newest commit, its ruling on whether it is ready. Sessions never add it, under any name |

- **The two merge labels appear only if you use
  [`auto-merge`](#auto-merge)**, with a pattern under `auto-merge.allow`.
  Otherwise no pull request gets either, whatever you name them.
- **The override matters only with [`pr-review`](#pr-review) on**, since
  that review gives the verdict.
- **You don't create these labels either.** The factory creates each merge
  label the first time it adds it, and `verdict-override` the first time
  it posts "Review verdict" on a pull request. Only a person adds
  `verdict-override` to one.
- **Naming a label doesn't turn on `auto-merge` or `pr-review`.**
- **New names take effect once they are on your default branch**, the
  one pull requests merge into, since the workflows that add and read
  these labels run from its copy. On a branch of its own, a rename
  changes nothing yet, and pull requests keep getting the old names.

The rules under [`tickets.labels`](#ticketslabels) hold here too: write
only the keys you change, give each label its own name, quote a name
with `: ` in it, and rename the label you have on GitHub yourself. Do
that before the new name merges: after it, the factory creates a label of
that name, and GitHub won't give a second one the same name. Then check
the file and sync:

```console
$ factory config check
✓ The settings are valid.
$ factory sync
wrote .claude/factory.lock
wrote .github/workflows/factory.yml
```

The second `wrote` line appears only when you rename `verdict-override`:
that workflow file names the label, so the sync rewrites it.
Commit `.claude/factory.yaml`, the lock, and any workflow `factory sync`
wrote, and merge them.

**It worked when** `factory config explain` shows your names under
`code-host.labels`, without `# default` after them, and once merged, the
next pull request the merge policy labels gets your name.

### `builds`

What starts a build when you approve a ticket, and where the build runs.

```yaml
builds:
  trigger: own-server
```

| Setting        | What it sets                                                  | Choices                                 | Default          |
| -------------- | ------------------------------------------------------------- | --------------------------------------- | ---------------- |
| `trigger`      | What notices you moved a ticket to Ready on the board         | `manual`, `own-server`, `github-action` | `manual`         |
| `runner`       | Where a build in the cloud runs                               | `github-actions`                        | `github-actions` |
| `poll-minutes` | With `github-action`, how often it checks the board           | 5, 10, 15, 30, or 60                    | 5                |
| `max-per-hour` | How many builds the poller starts in any one hour             | A whole number, 1 or more               | 20               |
| `hosts`        | The hosts a cloud session may reach, besides the npm registry | A list of host names                    | None             |

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
  `factory sync` writes its schedule into
  `.github/workflows/factory.yml`, with one exception: a repository that
  follows a [preset](presets.md) whose repository runs the poller, as an
  organization's `factory-config` does, gets no schedule of its own. The
  one schedule is then that repository's
  `.github/workflows/factory-poller.yml`, and `poll-minutes` in the
  preset must match that file's `cron` line, which `factory preset check`
  compares ([Checking and releasing](presets.md#checking-and-releasing)).

Watch the spelling: the trigger is `github-action`, singular, and the
runner is `github-actions`, plural.

Whatever starts it, a cloud build runs on the cloud runner.
[Builds](builds.md) explains each trigger. **It worked when** a ticket you
move to Ready shows as In progress on the board within a few minutes. If
nothing is watching the board, a ticket you move to Ready just sits there, and `factory status`
marks it "not started": after 5 minutes with `own-server`, and after
`poll-minutes` plus 15 minutes with `github-action`.

`factory config check` stops on `poll-minutes` with any trigger but
`github-action`, and on any value but the five above. It stops on a
`max-per-hour` that isn't a whole number of 1 or more.

A [session in the cloud](builds.md#what-a-session-can-use) reaches the npm
registry and no other host, unless you list it. List a host under `hosts`
when a command the session runs downloads from it, such as your package
manager's registry:

```yaml
builds:
  hosts:
    - repo.packagist.org
    - "*.example.com" # every host under example.com
```

It worked when that command succeeds in your next build. Each host is also
one a [hijacked session](credentials.md#what-a-hijacked-session-could-still-do)
could send what it was handed to, so list few. What
[`commands.build-setup`](#commandsbuild-setup) downloads needs no entry,
since it runs before the session, outside its sandbox.

Write a name that starts with `*.` in quotes, since YAML reads a bare `*`
as something else. Write the name alone: `factory config check` stops on
one with `https://`, a path, or a port, and on an IP address. It also stops
on `github.com`, `githubusercontent.com`, any host under either, and `*.com`:

```text
.claude/factory.yaml: builds.hosts can't name GitHub: a build has no GitHub access
```

A [preset](presets.md#how-presets-combine)'s hosts and your own add up.

### `specs`

Which spec tool your project uses, if any. Either way, refinement writes
a [Spec, a design, and a list of tasks](workflow.md#a-change-your-users-will-see)
into the ticket of each change your users will see. A spec tool also
keeps the Spec in your repository.

```yaml
# The default: refinement writes the Spec into the ticket, and nothing is
# kept in your repository. Leaving the line out means the same.
specs: none
```

```yaml
# Each build also writes the ticket's Spec into openspec/specs/.
specs: openspec
```

- **`none`,** the default: the ticket is the only place the Spec is
  written down.
- **`openspec`:** each build also writes the ticket's Spec into
  `openspec/specs/`, using [OpenSpec](https://github.com/Fission-AI/OpenSpec),
  so that folder always describes what your project does, readable
  without opening a ticket.

**`factory init` asks, and writes the answer here.** It asks "Which spec
tool do you use?" when `.claude/factory.yaml` has no `specs` line and no
[preset](presets.md) sets one. With `openspec`, init installs OpenSpec as
a development dependency, `npm install --save-dev @fission-ai/openspec`,
whenever your `package.json` doesn't list it, and prints
`Installed @fission-ai/openspec.` In a repository with no
`package.json`, it writes a small private one first, and adds
`node_modules/` to your `.gitignore`. It worked when that line prints and
`package.json` lists the package. So to turn OpenSpec on later, write
`specs: openspec` and run `factory init` again. A re-run is safe: it
keeps every setting you have, asks again only which parts you want,
with yours already checked, and shows everything it will do before it
does it.

**Without OpenSpec installed,** a build stops at its first spec step and
says to run `factory init`.

`factory specs list` prints the specs your repository keeps, one per
line with its file, which is what to read before changing what a spec
describes. The build runs `factory specs new`, `check`, and `finish`
itself; [Your repository's commands](cli.md#your-repositorys-commands)
says what each prints.

#### `specs.check`

The command that checks your written specs are well formed, such as
that every requirement has a scenario. To set it, write `specs` as a
block: its `type` is the tool the one-line form names, so
`specs: openspec` and the block below make the same choice.
`factory specs check` runs it, and so does a build each time it writes a
spec. It belongs only with `type: openspec`.

```yaml
specs:
  type: openspec
  # Optional: this is the default.
  check: npx --no-install openspec validate --all --strict --no-interactive
```

- **Default:** the command above, so most repositories leave `check`
  out and write only `specs: openspec`.
- **It runs with `DO_NOT_TRACK=1` set,** so OpenSpec collects no usage
  statistics.
- **With `specs: none`** there is nothing to check, and a `check` line
  fails `factory config check`: delete it when you switch to `none`.

It worked when `factory specs check` ends with `✓ The specs check passed.`

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
| `build-setup`   | Before a session in the cloud starts work                        | none                       |
| `before-commit` | Before every commit a session on your machine makes              | none                       |
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

Commands that run before a session in the cloud starts work, in your default
branch's copy, to install what the session will need. When your repository's
root has a `package-lock.json`, your npm dependencies are already installed
by then, with `npm ci`. Nothing else is.

```yaml
commands:
  build-setup:
    - npx playwright install --with-deps chromium # a browser for end-to-end tests
```

Install here what the machine lacks, such as a language or a tool. Your
project's own dependencies are another matter: what is installed here is
for your default branch's copy, and the session works in a copy of its
own branch, beside it. It installs that copy's dependencies itself, as
your `CLAUDE.md` or the project's files say, so list the registry they
come from under [`builds.hosts`](#builds), such as `pypi.org` and
`files.pythonhosted.org` for pip.

A package that GitHub itself serves, as it does most of Composer's, can't
be downloaded by a session, since GitHub is never reachable there. Run
`composer install` here, and have your `CLAUDE.md` say to copy what it
installed into the branch's copy, with `cp -R vendor ../work/`.

- **Default:** none.
- **If one fails,** the run stops before the session starts, and its log
  shows that command's output.
- **It runs as your default branch has it,** so a pull request that changes
  it is built with the old commands until it merges.

#### `commands.before-commit`

Quick checks that run before every commit a session on your machine makes.
If one fails, the commit is blocked and the session sees why. No hook runs
in a [session in the cloud](builds.md#what-a-session-can-use), so these do
not either: put a check a build has to pass in
[`commands.gate`](#commandsgate) too.

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
would pass every change. `factory init` asks for one gate command, and
lists the gate under "Left to do" when you leave that question empty.

When a command fails, `factory gate` prints `✗ The gate failed on:` and
the command, and runs none after it. The session fixes the cause and runs the
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

| Setting        | Limits the session that is                                  | Default |
| -------------- | ----------------------------------------------------------- | ------- |
| `build`        | Building a ticket                                           | `230`   |
| `conflicts`    | Fixing a pull request's conflicts with the default branch   | `110`   |
| `review`       | Reviewing a pull request, or answering its review or its CI | `50`    |
| `dependencies` | Working through dependency updates                          | `50`    |

- **Each is a whole number above zero.**
- **Run `factory sync` after changing one,** since it writes them into
  `.github/workflows/factory.yml`. `factory config check` fails until
  you do.
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
- **A plugin can come from a [preset](#presets),** which ships its agent
  or skill too. To leave out one that a preset adds to a list, name it
  here with `off: true`:

  ```yaml
  plugins:
    build:
      reviewers:
        - agent: acme-security-reviewer
          off: true
  ```

- **`factory config check`** stops on an agent in a role that takes a
  skill, or the other way round; on `files` or `labels` in a role that
  doesn't take them; on a builder with no `labels`; on a build reviewer or
  resolver with no `files`; on a skill or agent whose file doesn't
  exist and no preset ships; and on `off: true` for a plugin no preset
  names, where the fix is to delete that entry. It warns on a `files`
  pattern that matches no file.

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
pr-review: {}
```

- **Default:** off. Writing `pr-review` turns it on, even with nothing
  under it (`pr-review: {}`), and `factory sync` then turns the review's
  run on in `.github/workflows/factory.yml`. While it is off,
  each pull request's "Review verdict" status passes, reading "The
  automated review is off". `factory config get pr-review` prints `on`
  or `off`.
  [Setting up on GitHub](github/setup.md) has what it needs there.
- **The reviewer may run the pull request's own code** to confirm something
  it suspects, such as one test. It does so in
  [the session's sandbox](builds.md#what-a-cloud-run-is), with no sign-in
  to your code host. It doesn't run your tests on every pull request: your
  CI does that.
- **`commands` does nothing today, so leave it out.** It once listed what
  the reviewer could run. The sandbox now confines it instead, and it may
  run any command there. A list already in your settings is still checked:
  a command in it can't contain a comma, a parenthesis, or a quote.
- **To turn it off,** delete `pr-review` and run `factory sync`, which
  turns the run off again.

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
| `review-rounds`      | How many rounds of review comments are answered, on your machine and in the cloud, before what is left is handed to you                                                           | `2`     |

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

A first line like this one is optional. It points your editor at the
schema, in the factory's own repository:

```yaml
# $schema: https://raw.githubusercontent.com/davidbyoung/software-factory/main/settings.schema.json
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
# $schema: https://raw.githubusercontent.com/davidbyoung/software-factory/main/settings.schema.json
version: 2
repository: harbor-goods/storefront

tickets:
  board: 1
  columns:
    backlog: Backlog
    refining: In refinement
    ready: Ready
    building: In progress
    review: In review
    done: Done

code-host:
  type: github
  branch-name: "{ticket}"

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

pr-review: {}
```

### A small website

A marketing site with a board and nothing else changed. Builds start when
someone asks a session, since `builds.trigger` defaults to `manual`.

```yaml
# $schema: https://raw.githubusercontent.com/davidbyoung/software-factory/main/settings.schema.json
version: 2
repository: riverbend-studio/site

tickets:
  board: 4
  columns:
    backlog: Backlog
    refining: In refinement
    ready: Ready
    building: In progress
    review: In review
    done: Done

code-host:
  type: github
  branch-name: "{ticket}"

commands:
  before-commit:
    - npm run lint
  gate:
    - npm run lint
    - npm run typecheck
    - npm test
```

### A project that isn't JavaScript

A PHP library. Its commands are Composer's and PHPUnit's, and a session in
the cloud copies the dependencies installed before it started, as its
`CLAUDE.md` says. Docs merge unread, and one reviewer of its own reads
changes to its public API.

```yaml
# $schema: https://raw.githubusercontent.com/davidbyoung/software-factory/main/settings.schema.json
version: 2
repository: northwind-php/ledger

tickets:
  board: 2
  columns:
    backlog: Backlog
    refining: In refinement
    ready: Ready
    building: In progress
    review: In review
    done: Done

code-host:
  type: github
  branch-name: "{ticket}"

builds:
  hosts:
    - repo.packagist.org

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
