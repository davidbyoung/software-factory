# Updating

**When a new version is released, a pull request appears in your
repository. You read it and merge it.** That is all you have to do.

Three releases ask more of you, because they need lines in your
settings file that it doesn't have: [Moving to settings version
2](#moving-to-settings-version-2) and [Naming build
branches](#naming-build-branches), for every repository, and [Naming
every column](#naming-every-column), for a repository whose settings
have a [`tickets.board`](configuration.md#tickets). A fourth,
[Labeling your open tickets](#labeling-your-open-tickets), asks nothing
of most repositories, but is worth reading.

## What happens

1. Dependabot's weekly run finds the new version and opens one pull
   request for it, as it does for any package. Its group for the factory
   ([on GitHub](github/reference.md#dependency-bots)) keeps the pull
   request to the factory alone.
2. `factory-deps`, which already looks after Dependabot's pull requests,
   runs `factory sync` on its branch and adds what it wrote as a second
   commit. Until it has, CI's `factory sync --check` fails.
3. You read it and merge it. It never merges itself, whatever your
   [`auto-merge`](configuration.md#auto-merge) settings allow.
4. Everyone working on the repository, you included, pulls and runs
   `npm ci`, as after any dependency change.

## What the pull request holds

- **The new version**, in `package.json`, the lockfile, and
  `.claude/factory.lock`. The lock also holds every setting in effect, so
  a release that changes a default shows in its diff.
- **The factory's files, rewritten.** Its skills, agents, rules, and CI
  workflows live in your repository, so the diff shows exactly which
  instruction changed.
- **A comment from `factory-deps`** listing the files the sync changed,
  and anything the release notes say to do by hand, first.

An update changes the instructions your sessions follow and the code that
runs with your tokens. Read it as carefully as you would read code.

A new version of a [preset](presets.md) arrives the same way, with a
comment saying what it changes in this repository:
[When a preset changes](presets.md#when-a-preset-changes).

## Doing it yourself

To update now instead of waiting for Dependabot:

```bash
npm install --save-dev @davidbyoung/software-factory@latest
factory sync
```

Commit both on a branch and open a pull request. To see whether you are
behind without changing anything:

```bash
factory doctor
```

## Staying on a version, or going back

- **To stay where you are,** close the update pull request. Dependabot
  opens a new one for the next release.
- **To go back,** revert the update's pull request. The version and the
  files go back together.

## Without Dependabot

Update by hand as above. `factory-deps` and its workflows are written only
once `.github/dependabot.yml` exists.

## Moving to settings version 2

One release changes the shape of `.claude/factory.yaml`, from version 1 to
version 2, and no command converts the file: you move it by hand, once.
Until you do, every command that reads the settings stops with:

```text
.claude/factory.yaml: version: must be 2: this file is version 1, see "Moving to settings version 2" in docs/updating.md
```

So `factory-deps` cannot run `factory sync` on that release's pull request,
and its checks fail until the file is moved. On the pull request's branch:

1. Edit `.claude/factory.yaml` as the table and the example below show.
   A row applies only when your file has that key.
2. Add [`commands.gate`](configuration.md#commandsgate), which is new and
   which a build cannot finish without. Put in it the commands your
   `CLAUDE.md` names as the check before a task is done, usually what CI
   runs, such as `npm run check`.
3. Once `commands.gate` holds the gate, change the gate's prose in your
   `CLAUDE.md` to point at `npx --no-install factory gate`, so the two
   cannot differ.
4. Run `factory config check`, then `factory sync`, and commit what
   changed.

**It worked when** `factory config check` prints
`✓ The settings are valid.`, and `factory sync --check` passes.

### Each key that moved or changed shape

| Version 1                                                                | Version 2                                                                                      |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `version: 1`                                                             | `version: 2`                                                                                   |
| `before-commit`, at the top of the file                                  | [`commands.before-commit`](configuration.md#commandsbefore-commit)                             |
| `build-setup`, at the top of the file                                    | [`commands.build-setup`](configuration.md#commandsbuild-setup)                                 |
| [`plugins`](configuration.md#plugins), one list, each item with a `role` | `plugins`, grouped by phase, each plugin listed under its role's key instead of a `role` field |
| A plugin with `role: mockups`                                            | The one block [`plugins.refine.mockups`](configuration.md#pluginsrefine)                       |
| A plugin with `role: builder`                                            | An item of the list [`plugins.build.builders`](configuration.md#pluginsbuild)                  |
| A plugin with `role: reviewer`                                           | An item of the list `plugins.build.reviewers`                                                  |
| `ci-review`                                                              | [`pr-review`](configuration.md#pr-review), the same block under a new name                     |
| [`specs`](configuration.md#specs), one word                              | Still one word. It is now also a block, with `type` and [`check`](configuration.md#specscheck) |

Every other key keeps its name, its place, and its meaning.

`factory-test-reviewer` still runs by default, with nothing to write. Once
you write [`plugins.test.reviewers`](configuration.md#pluginstest), that
list is the whole list, so `factory-test-reviewer` runs only when you list
it there.

Before:

```yaml
version: 1
repository: your-name/your-repo

specs: openspec

before-commit:
  - npm run -s format:check
  - npx tsc --noEmit

build-setup:
  - npx playwright install --with-deps chromium

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

After:

```yaml
version: 2
repository: your-name/your-repo

code-host:
  type: github
  branch-name: "{ticket}"

specs: openspec

commands:
  before-commit:
    - npm run -s format:check
    - npx tsc --noEmit
  build-setup:
    - npx playwright install --with-deps chromium
  # New, and needed: what a build runs to check its change.
  gate:
    - npm run check

plugins:
  refine:
    mockups:
      skill: design-mockups
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

A file moved only partway says which key is left:
`before-commit: moved to commands.before-commit`, or
`plugins: must be grouped by phase: refine, build, test, conflicts`.

### What version 2 adds

Nothing here was in a version 1 file, so nothing moves. The first is
needed, and the rest are worth a look while the file is open.

- **The gate.** A build used to check its change with the commands your
  agent's instructions named. It now runs `factory gate`, which runs
  `commands.gate`. Copy those commands there, or a build stops with
  `commands.gate is not set`.
- **One test alone, and one end-to-end spec alone:**
  [`commands.test-one`](configuration.md#commandstest-one) and
  [`commands.end-to-end`](configuration.md#commandsend-to-end), which the
  skills run in place of naming a test runner.
- **The checks for browser end-to-end tests moved** out of
  `factory-test-reviewer` into a second built-in agent,
  `factory-e2e-reviewer`. A repository with such tests keeps them by
  setting `commands.end-to-end` and listing both agents under
  [`plugins.test.reviewers`](configuration.md#pluginstest).
- **Coverage, and the lock file:**
  [`commands.coverage`](configuration.md#commandscoverage) and
  [`commands.relock`](configuration.md#commandsrelock).
- **Four more roles for plugins:** your own refiner, prover, test
  reviewers, and conflict resolvers ([Plugins](plugins.md#the-roles)).
- **The default branch is read, not assumed.** A repository whose default
  branch is not `main` needs no setting: `factory sync` writes the
  branch's name where the workflows need it.

## Naming every column

From this release, a repository with a board names a column for all six
states in [`tickets.columns`](configuration.md#ticketscolumns). Before
it, a state you left out used the factory's own column name, so a
repository set up earlier has no `columns` block, or one with only the
states whose column has another name. A repository with no
`tickets.board` needs nothing.

Until the block names all six, every command that reads the settings
stops with one of these, the second naming the states you left out:

```text
.claude/factory.yaml: tickets.columns: is required with tickets.board: run factory init to choose which of board 3's columns shows each state
.claude/factory.yaml: tickets.columns: building and done have no column: give each a column, a list of columns, or none, or run factory init to choose them
```

So on the factory's update pull request, `factory-deps`, which opens
and finishes it ([What happens](#what-happens)), cannot run
`factory sync`. It stops and opens an issue in your repository quoting
the line. Check out the pull request's branch, and from your
repository's root run:

```bash
gh pr checkout 123   # the update pull request's number
factory init
```

Init keeps everything your settings already say and adds only the
missing states. It shows the whole block it saves, the states you had
and the ones it added. A state whose column of the factory's name is on
your board, which is the column the factory was reading for it, is added
with no question:

```text
Your settings give no column to building or done.
Board 3 has a column of the factory's name for each:

  State      Column
  backlog    Todo
  refining   none, shows in Todo
  ready      none
  building   In Progress
  review     Code review
  done       Done
```

For a state whose column your board doesn't have, init asks which column
shows it, offering your columns, no column, or a new column with the
factory's name. When it needs Claude Code to suggest columns, it asks
as [You already have a board](existing-repo.md#you-already-have-a-board)
shows.

You can add the lines by hand instead. For each state your block leaves
out, the factory used the name in the table in
[`tickets.columns`](configuration.md#ticketscolumns), so write that name
to keep things as they were. If your board has no column of that name,
write one of your columns, or `none`.

Then run `factory sync`, which rewrites the factory's files for the new
version, commit what changed, `.claude/factory.yaml` included, and push.
The pull request's checks run again, and you close the issue
`factory-deps` opened.

**It worked when** `factory config check` prints
`✓ The settings are valid.`, and `factory sync --check` passes.

## Naming build branches

From this release, every repository says how a build names its branch,
in [`code-host.branch-name`](configuration.md#code-host). Before it, a
build named its branch `issue-` with the ticket's number and a few words
of its title, such as `issue-47-terminal-color`, and no setting said so.
So a repository set up earlier has no `branch-name`, or writes
`code-host: github` on one line, and every command that reads the
settings stops with `code-host.branch-name: is required`.

There is no pattern that keeps the old names, since they held words a
session chose. The pattern you choose names new builds only: branches
already pushed keep their names, and their pull requests carry on as
before.

So on the factory's update pull request, `factory-deps` cannot run
`factory sync`. It stops and opens an issue in your repository quoting
the line. Check out the pull request's branch, and from your
repository's root run:

```bash
gh pr checkout 123   # the update pull request's number
factory init
```

Init keeps everything your settings already say, so it asks again only
what they lack: how a build names its branch, offering `{ticket}`. Press
Enter to keep it, or type your team's pattern, such as
`feature/{user}/{ticket}`; [`code-host`](configuration.md#code-host)
lists what a pattern can hold. If the update also needs [Naming every
column](#naming-every-column), the same run fills in both. When a
[preset](presets.md) you follow sets the pattern, init asks nothing.

You can add the lines by hand instead:

```yaml
code-host:
  type: github
  branch-name: "{ticket}"
```

Keep the quotes: without them, YAML reads `{ticket}` as a map rather
than as text. Then run `factory sync`, commit what changed,
`.claude/factory.yaml` included, and push. The pull request's checks run
again, and you close the issue `factory-deps` opened.

**It worked when** `factory config check` prints
`✓ The settings are valid.`, and `factory ticket branch 12` prints the
branch a build of ticket 12 would push.

## Labeling your open tickets

From this release the factory works only on tickets with its label
([Which tickets are the factory's](workflow.md#which-tickets-are-the-factorys)).
Before it, every open ticket was the factory's, so the update labels
each open ticket, and no card changes column. With Dependabot, the
update does it for you. Without it, you run one command before you
merge, below.

`factory-deps` labels them on the update pull request, before you
merge, and says so in the comment that lists the files the sync
changed:

```text
Labeled 14 open tickets factory. From this version the factory acts
only on tickets with that label. Every open ticket had it in effect
before, so nothing moves. Remove the label from any ticket the factory
shouldn't touch: #4, #31, #35, #40, #41, #44, #47, #50, #51, #53, #54,
#57, #61, #63.
```

Read the list. For a ticket the factory shouldn't touch, remove the
label in your ticket system, before or after you merge: the factory then
leaves it where it is. Only the first update that has the label labels
anything, so a ticket you took the label off stays without it.

If you update without Dependabot, as [Without
Dependabot](#without-dependabot) describes, run this on the branch that
installs the new version, after `factory sync`, before you merge:

```console
$ factory ticket adopt --all-open
labeled #4, #31, #35, #40, #41, #44, #47, #50, #51, #53, #54, #57, #61, #63
✓ 14 open tickets carry factory
```

Running it again labels nothing, and says
`✓ 14 open tickets carry factory; none needed it`.

If you renamed the label under
[`tickets.labels`](configuration.md#ticketslabels) and host your own
[poller](builds.md#the-poller), set `FACTORY_LABEL` to the new name where
the poller's other variables are set, before you merge
([What it reads from its environment](builds.md#what-it-reads-from-its-environment)).

**It worked when** `factory status` lists the tickets it listed before
the update, less any you took the label off.

## A spec for every visible change

From this release, a change your users will see, and that isn't small,
gets the `spec` label and a [Spec, a design, and a list of
tasks](workflow.md#a-change-your-users-will-see) in its ticket, whatever
[`specs`](configuration.md#specs) says. Before it, a repository with
`specs: none`, or no `specs` line, which means the same, got only a list
of acceptance criteria. Nothing stops on the update: tickets refined
earlier build as they are, and the next one refinement writes has the
longer shape.

`factory specs change-name N` is gone. A script of yours that ran it
runs `factory specs new N` and `factory specs finish N` instead
([Your repository's commands](cli.md#your-repositorys-commands)).

The next time you run `factory init`, it asks once which spec tool you
use, and writes your answer; choosing OpenSpec installs it.

## The commands

| Command          | When                                                       |
| ---------------- | ---------------------------------------------------------- |
| `factory sync`   | After you edit `.claude/factory.yaml`, to apply the change |
| `factory doctor` | To see whether you are behind, or why something is off     |

`factory sync` rewrites the factory's files to match your
settings and the installed version.

## On a team

Decide who merges updates, and tell them these pull requests are theirs.
An update changes how everyone's sessions behave, so one person should
read each one. After it merges, everyone pulls and runs `npm ci`. Until
they do, `factory doctor` and the start of each session
tell them their installed version is behind the repository's; the
session's start also says so, naming `npm ci`, when `node_modules` does
not match `package-lock.json`.

## When something goes wrong

| What you see                                                                          | What happened                                                         | What to do                                                                 |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| CI fails with "of the factory's files don't match the settings"                       | A factory file was edited by hand, or settings changed without a sync | Run `factory sync` and commit the result                                   |
| `factory doctor` says your installed version is older than the repository's           | You pulled an update and have not installed it                        | Run `npm ci`                                                               |
| A command stops with `version: must be 2`                                             | The update changed the shape of the settings file                     | [Move the file](#moving-to-settings-version-2)                             |
| A command stops with `tickets.columns: is required` or `have no column`               | The update needs a column named for every state                       | [Name every column](#naming-every-column)                                  |
| A command stops with `code-host.branch-name: is required`                             | The update needs the pattern a build names its branch by              | [Name build branches](#naming-build-branches)                              |
| A command stops with `.claude/factory.lock is from an earlier version of the factory` | The update's sync has not run on this checkout                        | Run `factory sync` and commit the result                                   |
| A command stops with `.claude/factory.yaml changed since the last sync`               | The settings changed without a sync                                   | Run `factory sync` and commit the result                                   |
| The update pull request conflicts with your default branch                            | Something else changed the same file                                  | `factory-deps` resolves it on its next run, or close it and update by hand |
| `factory status` leaves out a ticket you expected                                     | It doesn't carry the factory label                                    | Add the label, or run `factory ticket adopt N`                             |

## Never edit a factory file

Every file named `factory-...`, and the factory's rules, are written by
the factory. An edit made to one would be lost on the next update, so CI
fails when one differs from what the installed version would write.

To change what the factory does:

- **For your repository only:** say so in your own instructions for the
  agent, which win over the factory's rules, change a number under
  [`rules`](configuration.md#rules) in your settings, or put a skill or
  an agent of your own in a [plugin role](plugins.md).
- **For everyone:** change it in the factory, and it reaches you as an
  update.

[Why it works this way](design.md) explains why the files are copied in
and what the three version numbers are.
