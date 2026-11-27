# Presets

This page is for a team that sets the factory up the same way in several
repositories. A preset is a folder in a repository on your code host. It
holds the settings those repositories share, along with any agents and
skills of your own that the settings name.

It has two readers:

- **If you look after a repository,** [Using a preset](#using-a-preset)
  ends with your repository following the shared settings, and a pull
  request whenever they change.
- **If you maintain the shared settings,** [Writing a preset](#writing-a-preset)
  ends with a preset that every repository can add.

## The idea

Without a preset, every repository's
[`.claude/factory.yaml`](configuration.md) repeats the same lines, such as
the board's number in [`tickets.board`](configuration.md#tickets), the
size limit in [`rules.small-change-lines`](configuration.md#rules), the
way your team names branches in
[`code-host.branch-name`](configuration.md#code-host), and the same
[reviewer plugins](plugins.md#reviewer), your own agents that read every
change. Changing one of them means a pull request in every
repository, and nothing shows which ones have fallen behind.

With a preset, a repository names it under
[`presets`](configuration.md#presets) and keeps only what is its own:

```yaml
version: 2
repository: acme/billing
presets:
  - acme/factory-config # what every Acme repository shares
  - acme/factory-config//node # extra settings for Acme's Node repositories
commands:
  gate:
    - npm run check # this repository's own
```

A preset's name is the repository that holds it, written `OWNER/NAME`.
One kept in a folder of that repository adds `//` and the folder:
`acme/factory-config//node` is the folder `node` in `acme/factory-config`.
The repository is always on the same code host as yours.

`factory sync`, the command that writes the factory's files into your
repository, combines the factory's defaults, each preset in the order
listed, and your own settings. It writes the result into
`.claude/factory.lock`, which you commit and never edit. The lock also
pins each preset to one commit of its repository, so a preset changes
here only when a pull request moves that pin. Every command reads its
settings from the lock, so it has to be up to date: after you change a
setting, a command stops until you sync, and tells you so:

```text
.claude/factory.yaml changed since the last sync. Run: factory sync
```

## Using a preset

### Adding a preset

You need the factory already set up in the repository, which it is when
`.claude/factory.yaml` exists ([Quick start](quick-start.md)), and to be
able to read the preset's repository:
[Who can read a preset](#who-can-read-a-preset) says what that takes.

A repository that is not set up yet needs none of this section:
`factory init` adds its presets as it sets the repository up
([Run `factory init`](github/setup.md#run-factory-init)). It takes them
from the first of these that applies:

- the presets you name, with `factory init --preset NAME`, once for
  each;
- the presets you check in a list init shows, when the same owner has a
  repository named `factory-config`;
- the presets your machine last followed for that owner, which init
  offers.

For each one, init prints the summary shown below and pins the preset,
as `preset add` does.

In this example the repository already follows `acme/factory-config` and
adds the Node one. Run:

```bash
factory preset add acme/factory-config//node
```

Before it changes anything, it shows what the preset would change in this
repository:

```text
acme/factory-config//node at 3f9c2e1, from November 20, would change these settings here:

  added
    plugins.build.reviewers    + node-deps-reviewer
    auto-merge.deny            + package-lock.json
  replaces the default
    rules.review-rounds        2 → 3
  disagrees with acme/factory-config
    rules.small-change-lines   acme/factory-config: 40   this preset: 30
  replaced by your .claude/factory.yaml
    commands.gate              yours: npm run check   this preset's: npm test

  writes .claude/agents/node-deps-reviewer.md

Choose:
  rules.small-change-lines: 30 from this preset, or 40 from acme/factory-config? [30/40] 30
  commands.gate: keep yours, or drop it and use this preset's? [keep/drop] keep

Apply? [y/N] y
✓ Added acme/factory-config//node to .claude/factory.yaml, pinned at 3f9c2e1 in .claude/factory.lock.
✓ Wrote .claude/factory.choices.yaml.
✓ Wrote .claude/agents/node-deps-reviewer.md.
```

The first line names the commit the preset is pinned to, the newest on its
repository's default branch, and the day it was made. The summary groups
each change by what happens to it:

- **Added** is a plugin or a value the preset adds to a list. It needs no
  answer.
- **Replaces the default** is a setting nothing else sets. The preset's
  value applies, with no answer needed.
- **Disagrees with** is a setting another of your presets sets
  differently. You choose which one this repository follows, and
  [Your choices](#your-choices) says how that answer is kept.
- **Replaced by your `.claude/factory.yaml`** is a setting your own file
  sets. Answering `keep` changes nothing. Answering `drop` deletes that
  line from your `factory.yaml`, so the preset's value applies.
- **Writes** is an agent or a skill the preset ships, copied into your
  repository.
- **Runs** is a command the preset would have the factory run here, and
  when, such as "at the gate". A command your own settings replace is not
  listed, since it never runs.

Answering `N` at `Apply?` leaves everything as it was. Answering `y` puts
the preset at the end of `presets`, so it applies over the ones before
it. To change the order, edit the list and run `factory sync`.

The questions appear only when you run the command in a terminal. A
[session](glossary.md) or a CI job gets the summary and nothing changes,
unless it adds `--yes`. With `--yes` nothing is asked: where presets
disagree the later one in your list applies, and your own settings always
stay. To see the summary without changing anything, add `--dry-run`.

**It worked when**
[`factory config explain`](cli.md), which prints every
setting in effect, marks the preset's values with its name. Two of its
lines:

```yaml
rules:
  small-change-lines: 30 # acme/factory-config//node, chosen over acme/factory-config
  review-rounds: 3 # acme/factory-config//node
```

Commit what the command changed: `.claude/factory.yaml`,
`.claude/factory.lock`, `.claude/factory.choices.yaml` if you made a
choice ([Your choices](#your-choices) says what it holds), and the
agents and skills the summary listed under "writes".

A name you write into `presets` by hand is not pinned to a commit, so the
next sync stops and names the command that pins it:

```text
✗ presets: acme/factory-config//node is not pinned yet. Run: factory preset add acme/factory-config//node
```

**In a monorepo,** a preset written for one package, such as a company's
Python preset, can be applied to some folders only. Add `--in` with the
folders, where a `*` stands for each folder under one:

```bash
factory preset add acme/factory-config//python --in 'services/*'
```

Each command it gives then runs in each of those folders, and is added
after your own rather than replacing them. The summary it prints before
asking names the folders on each command it runs, such as
`pytest -q, at the gate, in services/*`.
[How presets combine](#how-presets-combine) has the rest.

### Your choices

Each answer you give where two presets disagree is kept in
`.claude/factory.choices.yaml`. The `preset` commands create and write it,
so you commit it but don't edit it by hand. Each line is a setting, or a
file two presets both ship, and the preset this repository follows for it:

```yaml
rules.small-change-lines: acme/factory-config//node
.claude/agents/security-reviewer.md: acme/factory-config
```

A choice names the preset, not its value. When
`acme/factory-config//node` later changes 30 to 25, the repository gets 25
and you aren't asked again. You're asked only when something about the
choice itself changes:

| What happens                                                  | What you see                                                                                             |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| You add a preset                                              | A question for each setting it disagrees with another preset on                                          |
| You remove a preset                                           | A question for each setting that would go back to a preset you chose against                             |
| A preset update makes two presets disagree for the first time | A line in [the update's pull request](#when-a-preset-changes). The later preset applies until you choose |
| The preset you chose stops setting a value                    | A line in the update's pull request saying which value applies now                                       |
| A preset you chose against changes its value                  | A line under "Doesn't apply here" in the update's pull request, and nothing to answer                    |

To see every choice and change any of them, run:

```bash
factory preset choices
```

It lists each setting two presets disagree on, what each preset would set,
and which applies now, then asks which to follow. Outside a terminal it
prints the list without asking. To record one choice without questions,
from a session or a script:

```bash
factory preset choose rules.review-rounds acme/factory-config//node
```

**It worked when** `factory config explain` marks the setting
`chosen over` the other preset.

### When a preset changes

A change to a preset is whatever someone merges into the default branch
of its repository. It reaches each repository that follows the preset as
a pull request, the way a new version of the factory does
([Updating](updating.md#what-happens)):

1. The factory's [update job](updating.md#what-happens) compares the
   commit each preset is pinned to with the newest one. Where one of
   that preset's files changed, it opens a pull request that moves the
   pin and holds what `factory sync` then wrote. A change to another
   folder of the same repository opens nothing here.
2. The pull request's description says what changes in this repository:

   ```text
   acme/factory-config 3f2a91c → 8d04e7b

   Changes here:
   - plugins.build.reviewers: + acme-a11y-reviewer,
     which wrote .claude/agents/acme-a11y-reviewer.md
   - .claude/skills/acme-refine/SKILL.md, rewritten

   Needs a choice:
   - rules.review-rounds: acme/factory-config now sets 2, and
     acme/factory-config//node sets 3. 3 applies, from the later
     preset, until you choose.

   Doesn't apply here:
   - rules.small-change-lines: 40 → 35, but you chose
     acme/factory-config//node's 30
   - commands.gate, which your .claude/factory.yaml sets
   ```

3. Anything under "Needs a choice" is safe to merge as it stands: the
   value it names is the one in effect. To choose differently, check out
   the pull request's branch, run `factory preset choices`,
   and push the `.claude/factory.choices.yaml` and `.claude/factory.lock`
   it wrote. **It worked when** the pull request's checks pass and
   `factory config explain` shows the value you chose.
4. Read the pull request and merge it. A preset update never merges
   itself, whatever your [`auto-merge`](configuration.md#auto-merge)
   settings allow.

A commit with a [problem in its preset](#checking-and-releasing) opens no
pull request: the update job fails with the line that says what is wrong,
and `factory update` prints it and changes nothing. Whoever maintains the
preset fixes it, or you stop following it with `factory preset remove`.

The diff of `.claude/factory.lock` in that pull request is the whole
change to this repository, setting by setting. Until you merge it, your
repository keeps the preset as it was, and keeps working. To stay on the
commit you have, close the pull request: the job opens another only when
the preset changes again.

The job needs [builds in the cloud](github/setup.md). Without them, or to
update now, run [`factory update`](updating.md#doing-it-yourself)
yourself.

### Removing a preset

```bash
factory preset remove acme/factory-config//node
```

It shows a summary first, as `preset add` does, and asks about any
setting that would go back to the value of a preset you chose against:

```text
Removing acme/factory-config//node would change these settings here:

  removed
    plugins.build.reviewers    − node-deps-reviewer
  back to the default
    rules.review-rounds        3 → 2
  back to a value you chose against
    rules.small-change-lines   30 → 40, from acme/factory-config

  deletes .claude/agents/node-deps-reviewer.md

Choose:
  rules.small-change-lines: use 40 from acme/factory-config, or keep 30 in your .claude/factory.yaml? [40/30]

Apply? [y/N] y
✓ Removed acme/factory-config//node from .claude/factory.yaml and .claude/factory.lock.
✓ Removed 1 choice from .claude/factory.choices.yaml.
✓ Deleted .claude/agents/node-deps-reviewer.md.
```

Keeping 30 writes `small-change-lines: 30` into your `factory.yaml`, since
no preset provides it anymore:

```yaml
rules:
  small-change-lines: 30
```

Then the command takes the preset out of `presets` and out of the lock,
drops each choice that named it, deletes the agents and skills the
preset shipped, and syncs. A file your repository wrote itself is never
deleted. The command reads nothing but your own repository, so it works
even when the preset's repository is gone.

**It worked when** `factory config explain` no longer names the preset.

### How presets combine

The factory's defaults come first, then each preset in the order
`presets` lists them, then your own `factory.yaml`. When more than one of
them sets the same thing, what applies depends on its kind:

| Kind of setting                                      | Examples                                                                                                                                   | What applies when more than one sets it                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| A single value                                       | [`rules.small-change-lines`](configuration.md#rules)                                                                                       | The later preset's value, unless you [chose](#your-choices) another. Your own `factory.yaml` wins over every preset          |
| A list of commands run in order                      | [`commands.gate`](configuration.md#commandsgate)                                                                                           | One whole list, the same way as a single value, since running two lists would run steps twice                                |
| A list of plugins                                    | [`plugins.build.reviewers`](configuration.md#pluginsbuild)                                                                                 | Every plugin from every list. A plugin named in two lists is treated as a single value                                       |
| A list of approval policies                          | [`approval-policies`](configuration.md#approval-policies)                                                                                  | Every policy from every list. A policy named in two lists is treated as a single value                                       |
| A list of values                                     | [`auto-merge.deny`](configuration.md#auto-merge)                                                                                           | Every value from every list, each once                                                                                       |
| A preset for some folders, added with `--in`         | Its [`commands`](configuration.md#commands), [`site`](configuration.md#site), [`plugins`](configuration.md#plugins), and approval policies | Added to the rest, not chosen over it, as the next section says                                                              |
| A setting that names its tool with `type`            | [`tickets`](configuration.md#tickets), [`specs`](configuration.md#specs)                                                                   | The whole setting from one place, when two places name different tools, so a Jira setup never inherits a GitHub board number |
| An agent or skill file a preset ships                | `.claude/agents/security-reviewer.md`                                                                                                      | The later preset's file, unless you chose another. A file your repository wrote itself always stays                          |
| A file in an approval policy's folder a preset ships | `.claude/approval-policies/licenses/check.mjs`                                                                                             | The same as an agent's or a skill's file                                                                                     |

A preset added with `--in` is for those folders only:

- **Each of its commands and sites runs in each of its folders,** and
  its paths are read from each: `files: [src/**]` in it means
  `services/*/src/**`.
- **Its commands come after the ones that apply without it,** your own
  or another preset's, rather than replacing them.
- **Its `relock` adds to the default,** `npm install`, which a
  repository without a `relock` of its own runs. Only your own `relock`
  replaces the default.
- **Its reviewers read only changes in its folders,** and so do its
  approval policies, whose `files` are read from each.
- **It can set nothing else:** `factory config check` fails on any other
  setting in it.

To leave out one plugin, or one approval policy, a preset adds, name it
in your own `factory.yaml` with `off: true`:

```yaml
plugins:
  build:
    reviewers:
      - agent: acme-security-reviewer
        off: true
```

Then run `factory sync`, as for any change to your settings, and commit
`.claude/factory.yaml` and `.claude/factory.lock`. **It worked when** [`factory plugins`](plugins.md) no
longer lists it.

A value a preset adds to a list of values, such as a pattern in
`auto-merge.deny`, can't be left out by one repository. Ask whoever
maintains the preset.

### Who can read a preset

A preset's repository is read in three places only: when you add the
preset, when the update job or `factory update` looks for a newer
commit, and when a pull request moves a preset's pin, where the
factory's check on that pull request reads the commit to see that the
lock matches it. Every other command, a build included, reads the lock
and the copies in your own repository. So a preset's repository that is
deleted, renamed, or made private breaks nothing that is already set up.
It stops only updates to that preset, and adding it elsewhere.

| Who owns the preset's repository                                                | How your machine reads it                         | How a run in the cloud reads it                                                                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The same person or organization as your repository, whether it is public or not | With your sign-in to the code host, as `git` does | Prepare reads it, with the [build token](credentials.md), which has to be able to. In an organization that is set up, Prepare reads it with the token it makes from the organization's App, which covers the preset's repository when the App is installed on it. The check of a pull request reads only a public one, and the automated review's run checks a private one whose pin moved |
| Someone else, and it is public                                                  | With no sign-in                                   | With no sign-in                                                                                                                                                                                                                                                                                                                                                                            |
| Someone else, and it is private                                                 | It is refused                                     | It is refused                                                                                                                                                                                                                                                                                                                                                                              |

### A preset from someone else

Any public repository that holds a `factory-preset.yaml` is a preset.
Nothing is published and nobody registers anything: you add it by its
address.

```text
$ factory preset add foo/presets//bar
foo/presets//bar is public, and foo is not this repository's owner.
foo/presets//bar at 3f9c2e1, from November 20, would change these settings here:

  added
    plugins.build.reviewers    + bar-reviewer
    auto-merge.deny            + package-lock.json
  replaces the default
    rules.review-rounds        2 → 3

  writes .claude/agents/bar-reviewer.md

Apply? [y/N] y
✓ Added foo/presets//bar to .claude/factory.yaml, pinned at 3f9c2e1 in .claude/factory.lock.
✓ Wrote .claude/agents/bar-reviewer.md.
```

Read it before you answer. A preset brings commands the factory runs, on
your machines and in CI, and agent and skill files your sessions follow.
What stands between another owner's preset and your repository:

- **It is pinned to a commit,** never to a tag or a branch, so nothing
  its owner does later changes what you have.
- **Only a person at a terminal adds one.** `--yes` is refused for
  another owner's preset:

  ```text
  ✗ foo/presets//bar belongs to another owner, so a person adds it, at a terminal. Run it without --yes.
  ```

- **Every update is a pull request** that shows the change, setting by
  setting, and never merges itself.
- **[What a preset can't set](#what-a-preset-cant-set)** holds for it
  too.

A private preset of another owner can't be followed, since a run in your
repository has no way to read it:

```text
$ factory preset add foo/private-presets
✗ foo/private-presets: not found, or private. A preset of another owner has to be public. To follow a private one, keep a copy under acme and add the copy.
```

Neither can a preset on another code host: a name is always read on the
code host of the repository that follows it. A copy is a repository of
your own that holds the preset's folder. It follows nothing, so you
bring the original's later changes into it yourself.

## Writing a preset

### Making the repository

1. **Create a repository** on your code host, or use one you have. It can
   have any name, and hold other things too. If you name it
   `factory-config`, `factory init` finds it without being told, in
   every repository of the same owner. For an organization,
   [`factory init --org`](github/setup.md#set-an-organization-up-once)
   creates `factory-config` with a first preset in it.
2. **Write `factory-preset.yaml` at its root.** It takes the
   same settings as `.claude/factory.yaml` ([Configuration](configuration.md#every-setting)),
   except [three](#what-a-preset-cant-set), so a line moves between the
   two unchanged:

   ```yaml
   version: 2 # the settings version, as in .claude/factory.yaml
   tickets:
     type: github
     board: 7
     columns:
       backlog: Backlog
       refining: In refinement
       ready: Ready
       building: In progress
       review: In review
       done: Done
   code-host:
     type: github
     branch-name: "feature/{user}/{ticket}"
   rules:
     small-change-lines: 40
   plugins:
     build:
       reviewers:
         - agent: acme-security-reviewer
           files:
             - src/**
   ```

   When the file's first line is a comment, as in
   `# The preset for every acme repository.`, `factory init` shows that
   line beside the preset's name in the list it offers.

3. **Add the agents and skills its settings name** in `agents/` and
   `skills/`, beside `factory-preset.yaml`, written the way your coding
   agent expects them ([Plugins](plugins.md)), and each approval policy's
   files in `approval-policies/NAME/`
   ([Approval policies](approval-policies.md#ship-a-policy-in-a-preset)).
   `factory sync` copies them into each repository that follows the
   preset.
4. **For a second preset in the same repository,** such as one for Node
   repositories, add a folder with its own `factory-preset.yaml`, and its
   own `agents/` and `skills/` if it needs them. Its name is the
   repository's, `//`, and the folder: `acme/factory-config//node`.

   ```text
   acme/factory-config
   ├── factory-preset.yaml       # the preset acme/factory-config
   ├── agents/
   │   └── acme-security-reviewer.md
   ├── skills/
   │   └── acme-refine/SKILL.md
   └── node/
       └── factory-preset.yaml   # the preset acme/factory-config//node
   ```

A preset has no version of its own, and says nowhere which versions of
the factory it works with. A factory refuses a settings file with a key
it does not know, and names the key, so a preset written for a newer
factory stops `factory preset add` and `factory update`, with that key's
name.

### The ticket system is set through a company preset

A company, or any organization, whose repositories share one ticket
system and one board puts [`tickets`](configuration.md#tickets) in its
preset, as the file above does: the system, the board's number, and its
columns. Every repository that follows the preset then has its tickets
on that board, `factory init` asks
none of them about tickets or a board, and one poller starts the builds
of all of them ([The poller](builds.md#the-poller)). The preset that
`factory init --org` writes for an organization is one of these.

Presets stay optional. A repository that follows none writes `tickets`
in its own `.claude/factory.yaml`.

### What a preset can't set

Three settings belong to each repository:
[`repository`](configuration.md#repository), and
[`auto-merge.allow` and `auto-merge.commands`](configuration.md#auto-merge).
Each one decides who a session takes instructions from or what merges
without a person. If a preset could set `auto-merge.allow`, one update
could let changes merge themselves in every repository at once.

A preset also can't name another preset. Each repository lists every
preset it follows, so the order is in one place, and adding one never
brings in another.

### Checking and releasing

In a checkout of the preset's repository, run:

```bash
factory preset check
```

It prints each preset it found and what it ships, so you can see a
preset in a folder was picked up:

```text
factory-preset.yaml        1 agent, 1 skill
node/factory-preset.yaml   no agents or skills
```

**It worked when** it lists every preset and nothing else. A problem gets
a line saying what to change, and the command fails. One is a setting a
preset can't set:

```text
node/factory-preset.yaml: auto-merge.allow: a preset can't set this. Remove it, and set it in each repository that wants it
```

Another is a value no repository could use, such as a pattern written
without its quotes, as `branch-name: {ticket}`. The check prints the first
of these in each file, so run it again after you fix one:

```text
factory-preset.yaml: code-host.branch-name: is a map, not a pattern. Quote it: branch-name: "{ticket}"
```

A setting the preset leaves out is not a problem, even when a setting it
does write needs it. A preset can list the reviewer
`factory-ui-reviewer`, which needs to know how to start your website, and
leave [`site`](configuration.md#site) to each repository that follows it
or to another preset.

In an organization's `factory-config`, the command also compares the
schedule of `.github/workflows/factory-poller.yml` with
[`builds.poll-minutes`](configuration.md#builds) in the preset beside
it, and fails when they differ: the poller runs on the file's schedule,
and `factory status` in each repository takes the interval from the
preset:

```text
✗ .github/workflows/factory-poller.yml runs on "*/5 * * * *", and builds.poll-minutes is 30. Write "*/30 * * * *" there.
```

A plugin that names an agent or a skill the repository doesn't ship gets
a note, not a failure, since a repository that follows the preset can
provide it:

```text
factory-preset.yaml: plugins.build.reviewers: acme-docs-reader: not shipped here, so each repository that uses this preset must provide it
```

Then merge it. A merge into the default branch is the release: each
repository that follows the preset gets a pull request at its update
job's next run, as [When a preset changes](#when-a-preset-changes)
describes. Who may merge into that repository decides what every
repository that follows it is offered.

There is no way to offer a change to one repository before the rest. To
try one first, put it in a folder of its own, such as `next/`, and
follow `acme/factory-config//next` from the repository you try it in.
