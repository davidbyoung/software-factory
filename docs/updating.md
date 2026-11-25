# Updating

**When a new version is released, a pull request appears in your
repository. You read it and merge it.** That is all you have to do, and
nobody installs anything afterward.

Four releases ask more of you. One changes how the factory is installed:
[Moving to one install on your machine](#moving-to-one-install-on-your-machine).
The others need lines in your settings file that it doesn't have:
[Moving to settings version 2](#moving-to-settings-version-2) and
[Naming build branches](#naming-build-branches), for every repository, and
[Naming every column](#naming-every-column), for a repository whose
settings have a [`tickets.board`](configuration.md#tickets). Four more,
[Labeling your open tickets](#labeling-your-open-tickets),
[A spec for every visible change](#a-spec-for-every-visible-change),
[Tickets across repositories](#tickets-across-repositories), and
[Follow-ups in the pull request](#follow-ups-in-the-pull-request), ask
nothing of most repositories, but are worth reading. One more,
[Cloud runs in three jobs](#cloud-runs-in-three-jobs), asks you to pass one
pull request's verdict by hand.

A repository coming from an old release takes them in order. Move to one
install first. If `factory update` then stops with a settings error, the
section for that error says what to add, and then you run
`factory update` again.

## What happens

Your repository names one exact version of the factory, in three files
the factory writes and you commit: `.claude/factory.lock`, which also
holds every setting in effect, and the two workflow files,
`.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`.
Every `factory` command run there, on any machine and in the cloud, runs
that version.

1. The factory's update job runs in your repository three times a day, at
   01:00, 13:00, and 19:00 UTC. It asks the factory's own repository for
   its newest release, and when your repository names an older one, it
   opens one pull request.
2. That pull request raises the version and holds every file the new
   version's [`factory sync`](cli.md#setting-up) wrote, the command that
   writes the factory's files into your repository.
3. You read it and merge it. It never merges itself, whatever your
   [`auto-merge`](configuration.md#auto-merge) settings allow.
4. The next time anyone runs `factory` in the repository, it downloads
   that version, once, and says so:

   ```text
   Downloading the factory 0.3.0, which this repository names. This happens once.
   ```

The job needs [builds in the cloud](github/setup.md), since it pushes a
branch and opens a pull request with the build's token, or, in an
organization that is set up, with a token made from the organization's
App. Without them, [do it yourself](#doing-it-yourself).

## What the pull request holds

- **The new version**, in `.claude/factory.lock`,
  `.github/workflows/factory.yml`, and
  `.github/workflows/factory-review.yml`. The lock also holds every
  setting in effect, so a release that changes a default shows in its
  diff.
- **The factory's files, rewritten.** Its skills, agents, and rules live
  in your repository, so the diff shows exactly which instruction
  changed.
- **A description** that names the two versions, lists the other files
  the sync changed, and links the release's notes, which say first
  anything to do by hand:

  ```text
  The factory 0.2.0 → 0.3.0

  Changes here:
  - .claude/skills/factory-build/SKILL.md, rewritten
  - .claude/factory/rules.md, rewritten
  - .github/workflows/factory.yml, rewritten
  - .github/workflows/factory-review.yml, rewritten

  Release notes: https://github.com/davidbyoung/software-factory/releases/tag/v0.3.0
  ```

An update changes the instructions your sessions follow and the code that
runs with your tokens. Read it as carefully as you would read code.

A change to a [preset](presets.md) arrives the same way, as a pull
request of its own:
[When a preset changes](presets.md#when-a-preset-changes).

## Doing it yourself

To update now instead of waiting for the job, or in a repository without
builds in the cloud:

```bash
factory update
```

It raises the repository to the newest release of the factory and moves
each preset to its newest commit, then syncs:

```text
The factory 0.2.0 → 0.3.0
acme/factory-config 3f2a91c → 8d04e7b
acme/factory-config//node is at its newest commit, 3f2a91c.
✓ Wrote 9 files. Commit them on a branch and open a pull request.
```

With nothing to do, it changes nothing:

```text
✓ Nothing to update: the factory is 0.3.0, the newest release, and both presets are at their newest commits.
```

To see whether you are behind without changing anything, run
`factory doctor`. When you are, its line for the factory reads:

```text
? The factory 0.2.0. 0.3.0 is released: merge its pull request, or run factory update
```

## Staying on a version, or going back

- **To stay where you are,** close the update's pull request. The job
  does not open it again, and opens a new one for the next release.
- **To go back,** revert the update's pull request. The version and the
  files go back together, and `factory` runs the older version again.
  The job does not open that version again either. It opens a pull
  request for the next release, and `factory update` takes you to the
  newest whenever you choose.

## The `factory` command on your machine

The command you installed once, in the [quick start](quick-start.md#1-install),
only starts the version each repository names
([Which version runs](cli.md#which-version-runs)), so it rarely needs
updating itself. It keeps each version it downloads in
`~/.cache/software-factory/`, or under `$XDG_CACHE_HOME` when that is
set, and the folder is safe to delete. Update it when you set a new
repository up, since `factory init` sets a repository up with the
version installed:

```bash
npm install -g @davidbyoung/software-factory@latest
```

## Moving to one install on your machine

This is for a repository whose `package.json` lists
`@davidbyoung/software-factory`. Each such repository installed the
factory for itself and holds about ten workflow files. Now the factory
is installed once on a machine, and a repository holds two. The update
job does not make this move: close the pull request Dependabot opens for
this release, and do these steps in the repository's checkout.

1. **Install the factory on your machine,** and take it out of the
   repository:

   ```bash
   npm install -g @davidbyoung/software-factory@latest
   npm uninstall @davidbyoung/software-factory
   ```

2. **If you follow a preset,** it was an npm package and is now a
   repository. Create that repository on your code host, put what the
   package held, its `factory-preset.yaml`, `agents/`, and `skills/`, at
   its root, and push it
   ([Writing a preset](presets.md#writing-a-preset)). Then
   `npm uninstall` the package, and delete its name from
   [`presets`](configuration.md#presets) in `.claude/factory.yaml`. If
   the update in step 3 then stops on a setting the preset supplied,
   write that setting in `.claude/factory.yaml` until step 4 adds the
   preset again.
3. **Update:**

   ```bash
   factory update
   ```

   ```text
   The factory 0.1.15 → 0.3.0
   ✓ Wrote 21 files and deleted 12. Commit them on a branch and open a pull request.
   ```

   It writes `.github/workflows/factory.yml` and
   `.github/workflows/factory-review.yml`, deletes the workflow files
   they replace, and rewrites the factory's other files.

   If it stops instead, the line it prints names what your settings
   lack. Follow the section for that line, and then run `factory update`
   again: [Moving to settings version 2](#moving-to-settings-version-2)
   for a line that says `version: must be 2`,
   [Naming every column](#naming-every-column) for one that says
   [`tickets.columns`](configuration.md#ticketscolumns) is required, and
   [Naming build branches](#naming-build-branches) for one that says
   [`code-host.branch-name`](configuration.md#code-host) is required.

4. **Add the preset again,** by its repository's name, with
   [`factory preset add`](presets.md#adding-a-preset).
5. **Tidy what the old install left:**
   - If `package.json` lists no dependencies and nothing else of yours,
     delete it, with `package-lock.json` and the `node_modules/` line in
     `.gitignore`.
   - If `.github/dependabot.yml` has a group for the factory or for a
     preset, delete the group, and its name from any other group's
     `exclude-patterns`. Dependabot no longer sees either.
     [Dependency bots](github/reference.md#dependency-bots) has the
     `ignore` entry to add to the `github-actions` update when
     Dependabot updates your workflow files.
6. **Commit all of it on a branch,** and open a pull request. Three of its
   checks behave differently on this one pull request, since your
   default branch still holds the old workflows:
   - "Review verdict" stays waiting where the automated review is on,
     because the old workflow that posts it listens for a review workflow
     this pull request deletes. Read the review yourself, then add the
     [`verdict-override`](configuration.md#code-hostlabels) label to
     merge.
   - "Factory files in step" is now named
     `review / Factory files in step`. If a rule of your repository
     requires it by name, change the name there
     ([Workflows](github/reference.md#workflows)).
   - A review you submit on it starts a run, "Answer the review", that
     fails. It runs the new workflow with the old version of the factory,
     which your default branch still names. No rule requires it, and it
     passes once this pull request has merged.

**It worked when** every other check on the pull request passes, and
`factory doctor` shows the version the repository names:

```text
✓ The factory 0.3.0, the newest release
```

## Moving to settings version 2

One release changes the shape of `.claude/factory.yaml`, from version 1 to
version 2, and no command converts the file: you move it by hand, once.
Until you do, every command that reads the settings stops with:

```text
.claude/factory.yaml: version: must be 2: this file is version 1, see "Moving to settings version 2" in docs/updating.md
```

So `factory update` cannot sync to that release until the file is moved.
From step 1 until step 4, no other `factory` command works in the
repository, since the version the lock still names refuses a version 2
file. On a branch:

1. Edit `.claude/factory.yaml` as the table and the example below show.
   A row applies only when your file has that key.
2. Add [`commands.gate`](configuration.md#commandsgate), which is new and
   which a build cannot finish without. Put in it the commands your
   `CLAUDE.md` names as the check before a task is done, usually what CI
   runs, such as `npm run check`.
3. Once `commands.gate` holds the gate, change the gate's prose in your
   `CLAUDE.md` to point at `factory gate`, so the two cannot differ.
4. Run `factory update`, then `factory config check`, and commit what
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

The `code-host` block is not in the table, since nothing moved into it:
`code-host.branch-name` is new, from
[Naming build branches](#naming-build-branches).

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

So the update to that release cannot sync: `factory update`
([Doing it yourself](#doing-it-yourself)) stops with the same line. On
your default branch, from your repository's root, run `factory init` at
the new release:

```bash
FACTORY_VERSION=$(npm view @davidbyoung/software-factory version) factory init
```

A plain `factory init` would run the release you are leaving, which the
lock still names. `npm view` prints the newest release, and
`FACTORY_VERSION` runs this one command at the release it names
([Which version runs](cli.md#which-version-runs)).

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

Init then lists what it will do and asks "Go ahead?". Once you type
`y`, it syncs at the new release, which rewrites the factory's files
for it, runs your gate, and opens a pull request titled "Change the
software factory's settings" from a new branch, `set-up-factory`, or
`set-up-factory-2` when that name is taken. It holds `.claude/factory.yaml` and every file the new
release wrote, so it is the update: merge it as you would the update
job's.

You can add the lines by hand instead. For each state your block leaves
out, the factory used the name in the table in
[`tickets.columns`](configuration.md#ticketscolumns), so write that name
to keep things as they were. If your board has no column of that name,
write one of your columns, or `none`. Then run `factory update` again,
which rewrites the factory's files for the new version, commit what
changed on a branch, `.claude/factory.yaml` included, and open a pull
request.

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

So the update to that release cannot sync: `factory update` stops with
the same line. On your default branch, from your repository's root, run
`factory init` at the new release:

```bash
FACTORY_VERSION=$(npm view @davidbyoung/software-factory version) factory init
```

A plain `factory init` would run the release you are leaving, which the
lock still names. `npm view` prints the newest release, and
`FACTORY_VERSION` runs this one command at the release it names
([Which version runs](cli.md#which-version-runs)).

Init keeps everything your settings already say, so it asks again only
what they lack: how a build names its branch, offering `{ticket}`. Press
Enter to keep it, or type your team's pattern, such as
`feature/{user}/{ticket}`; [`code-host`](configuration.md#code-host)
lists what a pattern can hold. If the update also needs [Naming every
column](#naming-every-column), the same run fills in both. When a
[preset](presets.md) you follow sets the pattern, init asks nothing.
Then it opens the update's pull request itself, as
[Naming every column](#naming-every-column) says.

You can add the lines by hand instead:

```yaml
code-host:
  type: github
  branch-name: "{ticket}"
```

Keep the quotes: without them, YAML reads `{ticket}` as a map rather
than as text. After adding them by hand, run `factory update` again,
commit what changed on a branch, `.claude/factory.yaml` included, and
open a pull request.

**It worked when** `factory config check` prints
`✓ The settings are valid.`, and `factory ticket branch 12` prints the
branch a build of ticket 12 would push.

**In an organization,** `factory init --org` now asks for the pattern
and writes it in the preset. If yours was set up before that, add the
lines above to `factory-preset.yaml` in your `factory-config`. The next
`factory init` in a new repository then lists the pattern as
`Branch names`, and does not ask. A repository that has its own
`branch-name` keeps it: delete that line to follow the preset's.

## Labeling your open tickets

From this release the factory works only on tickets with its label
([Which tickets are the factory's](workflow.md#which-tickets-are-the-factorys)).
Before it, every open ticket was the factory's, so you label each open
ticket once, before you merge the update, and no card changes column.
Run this on the update's branch, after `factory update` or the
`factory init` that opened the update's pull request:

```console
$ factory ticket adopt --all-open
labeled #4, #31, #35, #40, #41, #44, #47, #50, #51, #53, #54, #57, #61, #63
✓ 14 open tickets carry factory
```

Running it again labels nothing, and says
`✓ 14 open tickets carry factory; none needed it`.

Read the list. For a ticket the factory shouldn't touch, remove the
label in your ticket system, before or after you merge: the factory then
leaves it where it is.

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

## Cloud runs in three jobs

From this release on, each run that uses your coding agent is
[three jobs](builds.md#what-a-cloud-run-is), so the agent and a sign-in to
your code host are never in the same one. Nothing in your settings has to
change. Four things differ:

- **The pull request that updates to it gets no automated review,** where
  the review is on, because your default branch's workflow does not run one
  yet and the new one is not merged. Its "Review verdict" stays waiting. Read
  it yourself, then add the
  [`verdict-override`](configuration.md#code-hostlabels) label.
- **A review you submit on that pull request starts a run that fails,** in
  "Answer / Prepare". It runs the new workflow with the old version of the
  factory. No rule requires it, and it passes once the update has merged.
- **A build's commits are not signed,** where they were. A rule that requires
  signed commits stops its pull requests from merging.
- **A session reaches only the npm registry** unless you list more under
  [`builds.hosts`](configuration.md#builds), and neither Docker nor Git LFS works in it
  ([What a session can use](builds.md#what-a-session-can-use)).

**It worked when** the next pull request you mark ready gets a review.

## Tickets across repositories

From this release on, a ticket can name
[several repositories](across-repositories.md). Nothing in your settings has
to change. Two things can ask something of you:

- **A repository renamed since it was set up** still has its old name in its
  [`repository`](configuration.md#repository) line. Its next pull request
  fails the check "Factory files in step", with both names. Change the line,
  run `factory sync`, and commit what it writes.
- **A heading of your own named Repositories,** under `repositories` in
  [`tickets.fields`](configuration.md#ticketsfields), now holds the
  factory's. Give yours another name.

The pull request that updates to it also adds one folder to
`.claude/settings.json`: the one other repositories are cloned into, so a
session can edit there.

## Follow-ups in the pull request

From this release on, what a session noticed and did not fix is listed in
its pull request, for you to [decide about](workflow.md#follow-ups). There is
no follow-ups ticket anymore, and the factory no longer knows its label.

1. Before the update, delete the line `follow-up:` under
   [`tickets.labels`](configuration.md#ticketslabels), if your settings or a
   [preset](presets.md) of yours has one. Until you do, no pull request opens
   for the release, and the job "Open the updates' pull requests" fails with:

   ```text
   .claude/factory.yaml: tickets.labels.follow-up: unknown key
   ```

2. After it, if a "Follow-ups" ticket is open, write a ticket in your ticket
   system for each line you still want, and close it. Nothing builds it
   anymore, since it has no criteria.
3. If you [host the poller](builds.md#hosting-the-poller-own-server), take
   `FACTORY_FOLLOW_UP_LABEL` out of its environment, if you set it there.

**It worked when** `factory config check` prints `✓ The settings are valid.`
after the update, and no open ticket is titled "Follow-ups".

## The commands

| Command          | When                                                           |
| ---------------- | -------------------------------------------------------------- |
| `factory update` | To move to the newest release now, without waiting for the job |
| `factory sync`   | After you edit `.claude/factory.yaml`, to apply the change     |
| `factory doctor` | To see whether you are behind, or why something is off         |

`factory sync` rewrites the factory's files to match your settings and
the version your repository names. It never changes that version:
`factory update` does.

## On a team

Decide who merges updates, and tell them these pull requests are theirs.
An update changes how everyone's sessions behave, so one person should
read each one. After it merges, everyone pulls, and the next `factory`
command each person runs downloads the new version, once. Nobody
installs anything, and nobody can be left on an older version than the
repository names.

## When something goes wrong

| What you see                                                                                   | What happened                                                                                     | What to do                                                                               |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| CI fails with "of the factory's files don't match the settings"                                | A factory file was edited by hand, or settings changed without a sync                             | Run `factory sync` and commit the result                                                 |
| A command stops with `This repository names the factory 0.3.0, and it could not be downloaded` | npm could not fetch that version, and the line ends with npm's reason                             | Fix what npm names, such as the network or a registry setting, and run the command again |
| A command stops with `.claude/factory.lock names the factory ..., which is not a release`      | The lock's `version` line holds something other than a released version, as after an edit by hand | Run `factory update`                                                                     |
| A session's commands stop with `The factory is not installed on this machine`                  | This machine has no `factory` command                                                             | Install it once, as the line says: `npm install -g @davidbyoung/software-factory`        |
| A command stops with `version: must be 2`                                                      | The update changed the shape of the settings file                                                 | [Move the file](#moving-to-settings-version-2)                                           |
| A command stops with `tickets.columns: is required` or `have no column`                        | The update needs a column named for every state                                                   | [Name every column](#naming-every-column)                                                |
| A command stops with `code-host.branch-name: is required`                                      | The update needs the pattern a build names its branch by                                          | [Name build branches](#naming-build-branches)                                            |
| A command stops with `.claude/factory.lock is from an earlier version of the factory`          | The update's sync has not run on this checkout                                                    | Run `factory sync` and commit the result                                                 |
| A command stops with `.claude/factory.yaml changed since the last sync`                        | The settings changed without a sync                                                               | Run `factory sync` and commit the result                                                 |
| The update pull request conflicts with your default branch                                     | Something else changed the same file                                                              | Close it, and run `factory update` on a new branch                                       |
| `factory status` leaves out a ticket you expected                                              | It doesn't carry the factory label                                                                | Add the label, or run `factory ticket adopt N`                                           |

## Never edit a factory file

Every file named `factory-...`, and the factory's rules, are written by
the factory. An edit made to one would be lost on the next update, so CI
fails when one differs from what the version your repository names would
write.

To change what the factory does:

- **For your repository only:** say so in your own instructions for the
  agent, which win over the factory's rules, change a number under
  [`rules`](configuration.md#rules) in your settings, or put a skill or
  an agent of your own in a [plugin role](plugins.md).
- **For everyone:** change it in the factory, and it reaches you as an
  update.

[Why it works this way](design.md) explains why the files are copied in
and what the three version numbers are.
