# Upgrade notes

The steps by hand that a release asked for, one heading per change,
newest first. An update's pull request names the ones it needs, so read
these only when it does. A repository coming from an old release takes
them oldest first, from the bottom of the page up, as
[Updating](updating.md) says.

## Moving to lunamill

For a repository that uses the software factory, `@davidbyoung/software-factory`,
whose owner wants it on lunamill, the same product under its new name. At the
end the repository runs `lunamill`, its files and checks carry the new name,
and its updates come again.

The old package gets no more releases, and nothing moves a repository
over by itself. Until you take these steps, the job that opens your
update pull requests fails on every run. You see it on your repository's
Actions tab, in the job "Open the updates' pull requests":

```text
✗ This repository names the factory 0.2.0, and it could not be downloaded: npm error 404 Not Found
```

Take the steps once in each repository, starting on your default branch
with nothing uncommitted. Take them in a terminal, not in a session with
your coding agent: the session's hooks run the old command, and step 4
deletes them.

1. Install the new command:

   ```bash
   npm install -g @lunamill-ai/lunamill
   ```

   **It worked when** `lunamill`, run in any folder, prints the list of its
   commands.

2. Make a branch, and rename the two settings files lunamill reads: your
   settings, and the lock, which names the version your repository runs.

   ```bash
   git switch -c move-to-lunamill
   git mv .claude/factory.yaml .claude/lunamill.yaml
   git mv .claude/factory.lock .claude/lunamill.lock
   ```

   If `.claude/factory.choices.yaml` is there too, which holds your
   answers to a [preset's](../customize/presets.md) questions, rename it the same way:

   ```bash
   git mv .claude/factory.choices.yaml .claude/lunamill.choices.yaml
   ```

   **It worked when** `git status` lists each file as renamed.

3. In `.claude/lunamill.yaml`, change the first line, `version: 2`, to
   `version: 1`: lunamill counts its settings versions from 1 again, and the
   shape is the same. Until you do, every `lunamill` command that reads the
   settings stops with:

   ```text
   .claude/lunamill.yaml: version: must be 1: this file is version 2, see https://github.com/lunamill-ai/lunamill/blob/v0.2.0/docs/maintain/upgrade-notes.md#moving-to-lunamill
   ```

   If it names your ticket label under
   [`tickets.labels`](../reference/settings/tickets.md#ticketslabels), rename the key
   `factory` to `lunamill`, and leave its value as it is:

   ```yaml
   tickets:
     labels:
       lunamill: factory # was `factory: factory`
   ```

4. In `.claude/settings.json`, delete what the old command wrote, since
   lunamill does not recognize it as its own, and keep every entry of your
   own. The update in the next step writes the new ones.
   - Under `hooks`, each entry whose `command` runs `factory`, such as
     `factory session-start`, `factory guard`, or
     `factory reviewers start`.
   - Under `permissions`, `~/.local/share/software-factory/work` in
     `additionalDirectories`.

   Left in place, an old guard stops every command a session runs once
   the old command is uninstalled, with
   `The factory is not installed on this machine.`

   **It worked when** no line of `.claude/settings.json` names `factory`
   or `software-factory`.

5. Run the update. It runs the version installed on your machine, so it
   works while the lock still names the old one:

   ```bash
   lunamill update
   ```

   ```text
   lunamill 0.1.21 → 0.2.0
   ✓ Wrote 24 files. Commit them on a branch and open a pull request.
   ```

   It deletes every file the old version wrote, such as
   `.claude/skills/factory-build/` and `.github/workflows/factory.yml`,
   and writes the new ones, such as `.claude/skills/lunamill-build/` and
   `.github/workflows/lunamill.yml`.

6. In `CLAUDE.md`, delete the line `@.claude/factory/rules.md`. The update
   added `@.claude/lunamill/rules.md` beside it. Then commit, push, and open
   the pull request:

   ```bash
   git add -A
   git commit -m "Move to lunamill"
   git push -u origin move-to-lunamill
   gh pr create --fill
   ```

7. Before you merge it, on GitHub:
   - **The label.** If your settings name it under `tickets.labels`,
     which step 3 kept, leave the label alone. Otherwise lunamill now looks
     for the label `lunamill`, so rename yours, which keeps it on every
     ticket: `gh label edit factory --name lunamill`.
   - **Secrets and variables.** List the ones you have:
     `gh secret list` and `gh variable list`. Create each one whose name
     starts `FACTORY_` again with `LUNAMILL_` in its place, such as
     `gh secret set LUNAMILL_BOARD_TOKEN`, which asks for the value. GitHub
     cannot rename a secret or show its value, so you paste each one again,
     from wherever you keep it. `CLAUDE_CODE_OAUTH_TOKEN` and
     `ANTHROPIC_API_KEY` keep their names.
   - **A rule you made yourself.** The ruleset lunamill makes requires
     "Review verdict", whose name stays the same. A rule of your own may
     require one of the old checks by name. Under Settings, Rules,
     change `review / Factory files in step` to
     `review / lunamill files in step`, and a name that starts `factory /`,
     such as `factory / Pull request / Record the verdict`, to the same
     name starting `lunamill /`.
   - **A poller you host.** If you [host the poller](../features/hosting-the-poller.md#hosting-the-poller-own-server),
     run the image `ghcr.io/lunamill-ai/lunamill-poller` of the version in
     `.claude/lunamill.lock`, and rename its `FACTORY_REPOSITORY` and
     `FACTORY_BOARD_TOKEN` to `LUNAMILL_REPOSITORY` and `LUNAMILL_BOARD_TOKEN`.

8. Merge the pull request. Then delete each `FACTORY_` secret and
   variable, such as with `gh secret delete FACTORY_BOARD_TOKEN`, and
   uninstall the old command:

   ```bash
   npm uninstall -g @davidbyoung/software-factory
   ```

9. On each machine you used it on, move its folders. If you keep a Jira
   token or other credentials in its credentials file, move the file:

   ```bash
   mkdir -p ~/.config/lunamill
   mv ~/.config/software-factory/credentials.yaml ~/.config/lunamill/
   ```

   The two other folders hold nothing you keep: downloaded versions, and
   copies of other repositories a session clones to read. Once no session
   is running on the machine, delete them, and the old folder:

   ```bash
   rm -rf ~/.cache/software-factory ~/.local/share/software-factory ~/.config/software-factory
   ```

   Where `XDG_CONFIG_HOME` is set, the credentials file and
   `software-factory` folder are under it in place of `~/.config`, and
   where `XDG_CACHE_HOME` is set, the downloaded versions are under it in
   place of `~/.cache`.

Your own instructions may also name the old skills, such as
`/factory-build` in your `CLAUDE.md` or in a [plugin](../customize/plugins.md) of
yours: change each to its new name, such as `/lunamill-build`.

This covers a repository. No organization was set up with the old
package's `factory init --org`, so there is nothing of an organization's
to move: set one up with `lunamill init --org`, as
[Setting up an organization](../setup/organization.md) says.

**It worked when** [`lunamill doctor`](../reference/cli.md), which checks the whole
setup, passes in the repository, and each pull request opened after the merge
lists the new checks, such as `review / lunamill files in step`.

## Grouped checks

From this release on, a pull request's list of checks shows most of the
factory's jobs in three groups, Pull request, Tickets, and Default
branch, so a group with nothing to do shows as one skipped row, not a
row for each of its jobs. Nothing in your settings has to change. The
rules the factory makes require statuses, such as "Review verdict",
whose names stay the same.

A rule you made yourself may require one of the factory's jobs by its
row's name. Look in your repository's Settings, under Rules and
Branches, at each rule's list of required checks. A name such as
`factory / Record the verdict` no longer appears, so a pull request
waits for it forever. Change it to the job's new name, which adds the
group, such as `factory / Pull request / Record the verdict`.
[Workflows](../integrations/github-actions.md#workflows) lists each group's jobs. The
rows of Review and Answer, such as `factory / Review / Session`, and
`review / Factory files in step`, keep their names.

**It worked when** a pull request opened after the update no longer
shows a required check as "Expected — Waiting for status to be
reported".

## The poller reads your settings

From this release, a [poller you host](../features/hosting-the-poller.md#hosting-the-poller-own-server)
reads [`tickets.board`](../reference/settings/tickets.md#tickets),
[`tickets.columns`](../reference/settings/tickets.md#ticketscolumns),
[`tickets.labels`](../reference/settings/tickets.md#ticketslabels), and
[`builds`](../reference/settings/builds.md#builds) from your settings on your default
branch, so its environment needs only `FACTORY_REPOSITORY` and
`FACTORY_BOARD_TOKEN`. A scheduled poller, yours or your organization's,
already read them, and nothing changes for it.

1. Merge the pull request that updates the factory.
2. Run the poller's image of the version on the `version:` line of
   `.claude/factory.lock`, as
   [Hosting the poller](../features/hosting-the-poller.md#hosting-the-poller-own-server) shows.
3. Take the variables it no longer reads out of its environment:
   [What it reads](../features/builds-from-the-board.md#what-it-reads) lists them. Until you do, it
   ignores them, and names each one in its log when it starts.

**It worked when** the poller's log, wherever your host keeps a
container's output, shows the settings it read, such as:

```text
settings from .claude/factory.lock on main: board 1, ready column "Ready", label "factory", 20 builds an hour
```

## Follow-ups in the pull request

From this release on, what a session noticed and did not fix is listed in
its pull request, for you to [decide about](../workflow/follow-ups.md). There is
no follow-ups ticket anymore, and the factory no longer knows its label.

1. Before the update, delete the line `follow-up:` under
   [`tickets.labels`](../reference/settings/tickets.md#ticketslabels), if your settings or a
   [preset](../customize/presets.md) of yours has one. Until you do, no pull request opens
   for the release, and the job "Open the updates' pull requests" fails with:

   ```text
   .claude/factory.yaml: tickets.labels.follow-up: unknown key
   ```

2. After it, if a "Follow-ups" ticket is open, write a ticket in your ticket
   system for each line you still want, and close it. Nothing builds it
   anymore, since it has no criteria.
3. Take any step about the follow-ups ticket out of your own instructions for
   the coding agent, such as `CLAUDE.md`, which win over the factory's rules,
   and out of a [plugin](../customize/plugins.md) of your own. `factory follow-up` takes a
   title and a text now, not a file and a line.
4. If you [host the poller](../features/hosting-the-poller.md#hosting-the-poller-own-server), take
   `FACTORY_FOLLOW_UP_LABEL` out of its environment, if you set it there.

**It worked when** `factory config check` prints `✓ The settings are valid.`
after the update, and no open ticket is titled "Follow-ups".

## Tickets across repositories

From this release on, a ticket can name
[several repositories](../workflow/across-repositories.md). Nothing in your settings has
to change. Two things can ask something of you:

- **A repository renamed since it was set up** still has its old name in its
  [`repository`](../reference/settings/README.md#repository) line. Its next pull request
  fails the check "Factory files in step", with both names. Change the line,
  run `factory sync`, and commit what it writes.
- **A heading of your own named Repositories,** under `repositories` in
  [`tickets.fields`](../reference/settings/tickets.md#ticketsfields), now holds the
  factory's. Give yours another name.

The pull request that updates to it also adds one folder to
`.claude/settings.json`: the one other repositories are cloned into, so a
session can edit there.

## Cloud runs in three jobs

From this release on, each run that uses your coding agent is
[three jobs](../security/cloud-runs.md#what-a-cloud-run-is), so the agent and a sign-in to
your code host are never in the same one. Nothing in your settings has to
change. Four things differ:

- **The pull request that updates to it gets no automated review,** where
  the review is on, because your default branch's workflow does not run one
  yet and the new one is not merged. Its "Review verdict" stays waiting. Read
  it yourself, then add the
  [`verdict-override`](../reference/settings/code-host.md#code-hostlabels) label.
- **A review you submit on that pull request starts a run that fails,** in
  "Answer / Prepare". It runs the new workflow with the old version of the
  factory. No rule requires it, and it passes once the update has merged.
- **A build's commits are not signed,** where they were. A rule that requires
  signed commits stops its pull requests from merging.
- **A session reaches only the npm registry** unless you list more under
  [`builds.hosts`](../reference/settings/builds.md#builds), and neither Docker nor Git LFS works in it
  ([What a session can use](../features/cloud-builds.md#what-a-session-can-use)).

**It worked when** the next pull request you mark ready gets a review.

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
   ([Write a preset](../customize/writing-a-preset.md)). Then
   `npm uninstall` the package, and delete its name from
   [`presets`](../reference/settings/presets.md#presets) in `.claude/factory.yaml`. If
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
   [`tickets.columns`](../reference/settings/tickets.md#ticketscolumns) is required, and
   [Naming build branches](#naming-build-branches) for one that says
   [`code-host.branch-name`](../reference/settings/code-host.md#code-host) is required.

4. **Add the preset again,** by its repository's name, with
   [`factory preset add`](../customize/presets.md#adding-a-preset).
5. **Tidy what the old install left:**
   - If `package.json` lists no dependencies and nothing else of yours,
     delete it, with `package-lock.json` and the `node_modules/` line in
     `.gitignore`.
   - If `.github/dependabot.yml` has a group for the factory or for a
     preset, delete the group, and its name from any other group's
     `exclude-patterns`. Dependabot no longer sees either.
     [Dependency bots](../features/dependency-updates.md#dependency-bots) has the
     `ignore` entry to add to the `github-actions` update when
     Dependabot updates your workflow files.
6. **Commit all of it on a branch,** and open a pull request. Three of its
   checks behave differently on this one pull request, since your
   default branch still holds the old workflows:
   - "Review verdict" stays waiting where the automated review is on,
     because the old workflow that posts it listens for a review workflow
     this pull request deletes. Read the review yourself, then add the
     [`verdict-override`](../reference/settings/code-host.md#code-hostlabels) label to
     merge.
   - "Factory files in step" is now named
     `review / Factory files in step`. If a rule of your repository
     requires it by name, change the name there
     ([Workflows](../integrations/github-actions.md#workflows)).
   - A review you submit on it starts a run, "Answer the review", that
     fails. It runs the new workflow with the old version of the factory,
     which your default branch still names. No rule requires it, and it
     passes once this pull request has merged.

**It worked when** every other check on the pull request passes, and
`factory doctor` shows the version the repository names:

```text
✓ The factory 0.3.0, the newest release
```

## Labeling your open tickets

From this release the factory works only on tickets with its label
([Which tickets are the factory's](../workflow/tickets.md#which-tickets-are-lunamills)).
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
[`tickets.labels`](../reference/settings/tickets.md#ticketslabels) and host your own
[poller](../features/builds-from-the-board.md#the-poller), update the poller too, as
[The poller reads your settings](#the-poller-reads-your-settings) says:
it then reads the new name from your settings.

**It worked when** `factory status` lists the tickets it listed before
the update, less any you took the label off.

## A spec for every visible change

From this release, a change your users will see, and that isn't small,
gets the `spec` label and a [Spec, a design, and a list of
tasks](../features/specs.md#a-change-your-users-will-see) in its ticket, whatever
[`specs`](../reference/settings/specs.md#specs) says. Before it, a repository with
`specs: none`, or no `specs` line, which means the same, got only a list
of acceptance criteria. Nothing stops on the update: tickets refined
earlier build as they are, and the next one refinement writes has the
longer shape.

`factory specs change-name N` is gone. A script of yours that ran it
runs `factory specs new N` and `factory specs finish N` instead
([Your repository's commands](../reference/cli.md#your-repositorys-commands)).

The next time you run `factory init`, it asks once which spec tool you
use, and writes your answer; choosing OpenSpec installs it.

## Naming build branches

From this release, every repository says how a build names its branch,
in [`code-host.branch-name`](../reference/settings/code-host.md#code-host). Before it, a
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
([Which version runs](../get-started/install.md#which-version-runs)).

Init keeps everything your settings already say, so it asks again only
what they lack: how a build names its branch, offering `{ticket}`. Press
Enter to keep it, or type your team's pattern, such as
`feature/{user}/{ticket}`; [`code-host`](../reference/settings/code-host.md#code-host)
lists what a pattern can hold. If the update also needs [Naming every
column](#naming-every-column), the same run fills in both. When a
[preset](../customize/presets.md) you follow sets the pattern, init asks nothing.
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

## Naming every column

From this release, a repository with a board names a column for all six
states in [`tickets.columns`](../reference/settings/tickets.md#ticketscolumns). Before
it, a state you left out used the factory's own column name, so a
repository set up earlier has no `columns` block, or one with only the
states whose column has another name. A repository with no
[`tickets.board`](../reference/settings/tickets.md#tickets) needs nothing.

Until the block names all six, every command that reads the settings
stops with one of these, the second naming the states you left out:

```text
.claude/factory.yaml: tickets.columns: is required with tickets.board: run factory init to choose which of board 3's columns shows each state
.claude/factory.yaml: tickets.columns: building and done have no column: give each a column, a list of columns, or none, or run factory init to choose them
```

So the update to that release cannot sync: `factory update`
([Doing it yourself](updating.md#doing-it-yourself)) stops with the same line. On
your default branch, from your repository's root, run `factory init` at
the new release:

```bash
FACTORY_VERSION=$(npm view @davidbyoung/software-factory version) factory init
```

A plain `factory init` would run the release you are leaving, which the
lock still names. `npm view` prints the newest release, and
`FACTORY_VERSION` runs this one command at the release it names
([Which version runs](../get-started/install.md#which-version-runs)).

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
as [You already have a board](../features/board.md#you-already-have-a-board)
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
[`tickets.columns`](../reference/settings/tickets.md#ticketscolumns), so write that name
to keep things as they were. If your board has no column of that name,
write one of your columns, or `none`. Then run `factory update` again,
which rewrites the factory's files for the new version, commit what
changed on a branch, `.claude/factory.yaml` included, and open a pull
request.

**It worked when** `factory config check` prints
`✓ The settings are valid.`, and `factory sync --check` passes.

## Moving to settings version 2

One release changes the shape of `.claude/factory.yaml`, from version 1 to
version 2, and no command converts the file: you move it by hand, once.
Until you do, every command that reads the settings stops with:

```text
.claude/factory.yaml: version: must be 2: this file is version 1, see "Moving to settings version 2" in docs/updating.md
```

So `factory update` cannot sync to that release until the file is moved.
A release since this page moved prints this section's address in place of
`docs/updating.md`.
From step 1 until step 4, no other `factory` command works in the
repository, since the version the lock still names refuses a version 2
file. On a branch:

1. Edit `.claude/factory.yaml` as the table and the example below show.
   A row applies only when your file has that key.
2. Add [`commands.gate`](../reference/settings/commands.md#commandsgate), which is new and
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

| Version 1                                                                                | Version 2                                                                                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `version: 1`                                                                             | `version: 2`                                                                                                 |
| `before-commit`, at the top of the file                                                  | [`commands.before-commit`](../reference/settings/commands.md#commandsbefore-commit)                          |
| `build-setup`, at the top of the file                                                    | [`commands.build-setup`](../reference/settings/commands.md#commandsbuild-setup)                              |
| [`plugins`](../reference/settings/plugins.md#plugins), one list, each item with a `role` | `plugins`, grouped by phase, each plugin listed under its role's key instead of a `role` field               |
| A plugin with `role: mockups`                                                            | The one block [`plugins.refine.mockups`](../reference/settings/plugins.md#pluginsrefine)                     |
| A plugin with `role: builder`                                                            | An item of the list [`plugins.build.builders`](../reference/settings/plugins.md#pluginsbuild)                |
| A plugin with `role: reviewer`                                                           | An item of the list `plugins.build.reviewers`                                                                |
| `ci-review`                                                                              | [`pr-review: true`](../reference/settings/pr-review.md#pr-review), in place of the block                     |
| [`specs`](../reference/settings/specs.md#specs), one word                                | Still one word. It is now also a block, with `type` and [`check`](../reference/settings/specs.md#specscheck) |

Every other key keeps its name, its place, and its meaning.

`factory-test-reviewer` still runs by default, with nothing to write. Once
you write [`plugins.test.reviewers`](../reference/settings/plugins.md#pluginstest), that
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
  [`commands.test-one`](../reference/settings/commands.md#commandstest-one) and
  [`commands.end-to-end`](../reference/settings/commands.md#commandsend-to-end), which the
  skills run in place of naming a test runner.
- **The checks for browser end-to-end tests moved** out of
  `factory-test-reviewer` into a second built-in agent,
  `factory-e2e-reviewer`. A repository with such tests keeps them by
  setting `commands.end-to-end` and listing both agents under
  [`plugins.test.reviewers`](../reference/settings/plugins.md#pluginstest).
- **Coverage, and the lock file:**
  [`commands.coverage`](../reference/settings/commands.md#commandscoverage) and
  [`commands.relock`](../reference/settings/commands.md#commandsrelock).
- **Four more roles for plugins:** your own refiner, prover, test
  reviewers, and conflict resolvers ([Your own skills and agents](../customize/plugins.md#the-roles)).
- **The default branch is read, not assumed.** A repository whose default
  branch is not `main` needs no setting: `factory sync` writes the
  branch's name where the workflows need it.
