# Use a preset

This page is for a team that sets lunamill up the same way in several
repositories. A preset is a folder in a repository on your code host. It
holds the settings those repositories share, along with any agents and
skills of your own that the settings name.

It has two readers:

- **If you look after a repository,** [Using a preset](#using-a-preset)
  ends with your repository following the shared settings, and a pull
  request whenever they change.
- **If you maintain the shared settings,** [Write a preset](writing-a-preset.md)
  ends with a preset that every repository can add.

## The idea

Without a preset, every repository's
[`.claude/lunamill.yaml`](../reference/settings/README.md) repeats the same lines, such as
the board's number in [`tickets.board`](../reference/settings/tickets.md#tickets), the
size limit in [`rules.small-change-lines`](../reference/settings/rules.md#rules), the
way your team names branches in
[`code-host.branch-name`](../reference/settings/code-host.md#code-host), and the same
[reviewer plugins](plugins.md#reviewer), your own agents that read every
change. Changing one of them means a pull request in every
repository, and nothing shows which ones have fallen behind.

With a preset, a repository names it under
[`presets`](../reference/settings/presets.md#presets) and keeps only what is its own:

```yaml
version: 1
repository: acme/billing
presets:
  - acme/lunamill-config # what every Acme repository shares
  - acme/lunamill-config//node # extra settings for Acme's Node repositories
commands:
  gate:
    - npm run check # this repository's own
```

A preset's name is the repository that holds it, written `OWNER/NAME`.
One kept in a folder of that repository adds `//` and the folder:
`acme/lunamill-config//node` is the folder `node` in `acme/lunamill-config`.
The repository is always on the same code host as yours.

`lunamill sync`, the command that writes lunamill's files into your
repository, combines lunamill's defaults, each preset in the order
listed, and your own settings. It writes the result into
`.claude/lunamill.lock`, which you commit and never edit. The lock also
pins each preset to one commit of its repository, so a preset changes
here only when a pull request moves that pin. Every command reads its
settings from the lock, so it has to be up to date: after you change a
setting, a command stops until you sync, and tells you so:

```text
.claude/lunamill.yaml changed since the last sync. Run: lunamill sync
```

## Using a preset

### Adding a preset

You need lunamill already set up in the repository, which it is when
`.claude/lunamill.yaml` exists ([Quick start](../get-started/quick-start.md)), and to be
able to read the preset's repository:
[Who can read a preset](#who-can-read-a-preset) says what that takes.

A repository that is not set up yet needs none of this section:
`lunamill init` adds its presets as it sets the repository up
([Run `lunamill init`](../setup/repository.md#run-lunamill-init)). It takes them
from the first of these that applies:

- the presets you name, with `lunamill init --preset NAME`, once for
  each;
- the presets you check in a list init shows, when the same owner has a
  repository named `lunamill-config`;
- the presets your machine last followed for that owner, which init
  offers.

For each one, init prints the summary shown below and pins the preset,
as `preset add` does.

In this example the repository already follows `acme/lunamill-config` and
adds the Node one. Run:

```bash
lunamill preset add acme/lunamill-config//node
```

Before it changes anything, it shows what the preset would change in this
repository:

```text
acme/lunamill-config//node at 3f9c2e1, from November 20, would change these settings here:

  added
    plugins.build.reviewers    + node-deps-reviewer
    auto-merge.deny            + package-lock.json
  replaces the default
    rules.review-rounds        2 → 3
  disagrees with acme/lunamill-config
    rules.small-change-lines   acme/lunamill-config: 40   this preset: 30
  replaced by your .claude/lunamill.yaml
    commands.gate              yours: npm run check   this preset's: npm test

  writes .claude/agents/node-deps-reviewer.md

Choose:
  rules.small-change-lines: 30 from this preset, or 40 from acme/lunamill-config? [30/40] 30
  commands.gate: keep yours, or drop it and use this preset's? [keep/drop] keep

Apply? [y/N] y
✓ Added acme/lunamill-config//node to .claude/lunamill.yaml, pinned at 3f9c2e1 in .claude/lunamill.lock.
✓ Wrote .claude/lunamill.choices.yaml.
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
- **Replaced by your `.claude/lunamill.yaml`** is a setting your own file
  sets. Answering `keep` changes nothing. Answering `drop` deletes that
  line from your `lunamill.yaml`, so the preset's value applies.
- **Writes** is an agent or a skill the preset ships, copied into your
  repository.
- **Runs** is a command the preset would have lunamill run here, and
  when, such as "at the gate". A command your own settings replace is not
  listed, since it never runs.

Answering `N` at `Apply?` leaves everything as it was. Answering `y` puts
the preset at the end of `presets`, so it applies over the ones before
it. To change the order, edit the list and run `lunamill sync`.

The questions appear only when you run the command in a terminal. A
[session](../reference/glossary.md) or a CI job gets the summary and nothing changes,
unless it adds `--yes`. With `--yes` nothing is asked: where presets
disagree the later one in your list applies, and your own settings always
stay. To see the summary without changing anything, add `--dry-run`.

**It worked when**
[`lunamill config explain`](../reference/cli.md), which prints every
setting in effect, marks the preset's values with its name. Two of its
lines:

```yaml
rules:
  small-change-lines: 30 # acme/lunamill-config//node, chosen over acme/lunamill-config
  review-rounds: 3 # acme/lunamill-config//node
```

Commit what the command changed: `.claude/lunamill.yaml`,
`.claude/lunamill.lock`, `.claude/lunamill.choices.yaml` if you made a
choice ([Your choices](#your-choices) says what it holds), and the
agents and skills the summary listed under "writes".

A name you write into `presets` by hand is not pinned to a commit, so the
next sync stops and names the command that pins it:

```text
✗ presets: acme/lunamill-config//node is not pinned yet. Run: lunamill preset add acme/lunamill-config//node
```

**In a monorepo,** a preset written for one package, such as a company's
Python preset, can be applied to some folders only. Add `--in` with the
folders, where a `*` stands for each folder under one:

```bash
lunamill preset add acme/lunamill-config//python --in 'services/*'
```

Each command it gives then runs in each of those folders, and is added
after your own rather than replacing them. The summary it prints before
asking names the folders on each command it runs, such as
`pytest -q, at the gate, in services/*`.
[How presets combine](#how-presets-combine) has the rest.

### Your choices

Each answer you give where two presets disagree is kept in
`.claude/lunamill.choices.yaml`. The `preset` commands create and write it,
so you commit it but don't edit it by hand. Each line is a setting, or a
file two presets both ship, and the preset this repository follows for it:

```yaml
rules.small-change-lines: acme/lunamill-config//node
.claude/agents/security-reviewer.md: acme/lunamill-config
```

A choice names the preset, not its value. When
`acme/lunamill-config//node` later changes 30 to 25, the repository gets 25
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
lunamill preset choices
```

It lists each setting two presets disagree on, what each preset would set,
and which applies now, then asks which to follow. Outside a terminal it
prints the list without asking. To record one choice without questions,
from a session or a script:

```bash
lunamill preset choose rules.review-rounds acme/lunamill-config//node
```

**It worked when** `lunamill config explain` marks the setting
`chosen over` the other preset.

### When a preset changes

A change to a preset is whatever someone merges into the default branch
of its repository. It reaches each repository that follows the preset as
a pull request, the way a new version of lunamill does
([Updating](../maintain/updating.md#what-happens)):

1. lunamill's [update job](../maintain/updating.md#what-happens) compares the
   commit each preset is pinned to with the newest one. Where one of
   that preset's files changed, it opens a pull request that moves the
   pin and holds what `lunamill sync` then wrote. A change to another
   folder of the same repository opens nothing here.
2. The pull request's description says what changes in this repository:

   ```text
   acme/lunamill-config 3f2a91c → 8d04e7b

   Changes here:
   - plugins.build.reviewers: + acme-a11y-reviewer,
     which wrote .claude/agents/acme-a11y-reviewer.md
   - .claude/skills/acme-refine/SKILL.md, rewritten

   Needs a choice:
   - rules.review-rounds: acme/lunamill-config now sets 2, and
     acme/lunamill-config//node sets 3. 3 applies, from the later
     preset, until you choose.

   Doesn't apply here:
   - rules.small-change-lines: 40 → 35, but you chose
     acme/lunamill-config//node's 30
   - commands.gate, which your .claude/lunamill.yaml sets
   ```

3. Anything under "Needs a choice" is safe to merge as it stands: the
   value it names is the one in effect. To choose differently, check out
   the pull request's branch, run `lunamill preset choices`,
   and push the `.claude/lunamill.choices.yaml` and `.claude/lunamill.lock`
   it wrote. **It worked when** the pull request's checks pass and
   `lunamill config explain` shows the value you chose.
4. Read the pull request and merge it. A preset update never merges
   itself, whatever your [`auto-merge`](../reference/settings/auto-merge.md#auto-merge)
   settings allow.

A commit with a [problem in its preset](writing-a-preset.md#checking-and-releasing) opens no
pull request: the update job fails with the line that says what is wrong,
and `lunamill update` prints it and changes nothing. Whoever maintains the
preset fixes it, or you stop following it with `lunamill preset remove`.

The diff of `.claude/lunamill.lock` in that pull request is the whole
change to this repository, setting by setting. Until you merge it, your
repository keeps the preset as it was, and keeps working. To stay on the
commit you have, close the pull request: the job opens another only when
the preset changes again.

The job needs [builds in the cloud](../features/cloud-builds.md). Without them, or to
update now, run [`lunamill update`](../maintain/updating.md#doing-it-yourself)
yourself.

### Removing a preset

```bash
lunamill preset remove acme/lunamill-config//node
```

It shows a summary first, as `preset add` does, and asks about any
setting that would go back to the value of a preset you chose against:

```text
Removing acme/lunamill-config//node would change these settings here:

  removed
    plugins.build.reviewers    − node-deps-reviewer
  back to the default
    rules.review-rounds        3 → 2
  back to a value you chose against
    rules.small-change-lines   30 → 40, from acme/lunamill-config

  deletes .claude/agents/node-deps-reviewer.md

Choose:
  rules.small-change-lines: use 40 from acme/lunamill-config, or keep 30 in your .claude/lunamill.yaml? [40/30]

Apply? [y/N] y
✓ Removed acme/lunamill-config//node from .claude/lunamill.yaml and .claude/lunamill.lock.
✓ Removed 1 choice from .claude/lunamill.choices.yaml.
✓ Deleted .claude/agents/node-deps-reviewer.md.
```

Keeping 30 writes `small-change-lines: 30` into your `lunamill.yaml`, since
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

**It worked when** `lunamill config explain` no longer names the preset.

### How presets combine

lunamill's defaults come first, then each preset in the order
`presets` lists them, then your own `lunamill.yaml`. When more than one of
them sets the same thing, what applies depends on its kind:

| Kind of setting                                      | Examples                                                                                                                                                                                 | What applies when more than one sets it                                                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| A single value                                       | [`rules.small-change-lines`](../reference/settings/rules.md#rules)                                                                                                                       | The later preset's value, unless you [chose](presets.md#your-choices) another. Your own `lunamill.yaml` wins over every preset                |
| A list of commands run in order                      | [`commands.gate`](../reference/settings/commands.md#commandsgate)                                                                                                                        | One whole list, the same way as a single value, since running two lists would run steps twice                                                 |
| A list of plugins                                    | [`plugins.build.reviewers`](../reference/settings/plugins.md#pluginsbuild)                                                                                                               | Every plugin from every list. A plugin named in two lists is treated as a single value                                                        |
| A list of approval policies                          | [`approval-policies`](../reference/settings/approval-policies.md#approval-policies)                                                                                                      | Every policy from every list. A policy named in two lists is treated as a single value                                                        |
| A list of values                                     | [`auto-merge.deny`](../reference/settings/auto-merge.md#auto-merge)                                                                                                                      | Every value from every list, each once                                                                                                        |
| A preset for some folders, added with `--in`         | Its [`commands`](../reference/settings/commands.md#commands), [`site`](../reference/settings/site.md#site), [`plugins`](../reference/settings/plugins.md#plugins), and approval policies | Added to the rest, not chosen over it, as the next section says                                                                               |
| A setting that names its tool with `type`            | [`tickets`](../reference/settings/tickets.md#tickets), [`specs`](../reference/settings/specs.md#specs)                                                                                   | The whole setting from one place, when two places name different tools, so a setup on one ticket system never inherits another's board number |
| An agent or skill file a preset ships                | `.claude/agents/security-reviewer.md`                                                                                                                                                    | The later preset's file, unless you chose another. A file your repository wrote itself always stays                                           |
| A file in an approval policy's folder a preset ships | `.claude/approval-policies/licenses/check.mjs`                                                                                                                                           | The same as an agent's or a skill's file                                                                                                      |

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
- **It can set nothing else:** `lunamill config check` fails on any other
  setting in it.

To leave out one plugin, or one approval policy, a preset adds, name it
in your own `lunamill.yaml` with `off: true`:

```yaml
plugins:
  build:
    reviewers:
      - agent: acme-security-reviewer
        off: true
```

Then run `lunamill sync`, as for any change to your settings, and commit
`.claude/lunamill.yaml` and `.claude/lunamill.lock`. **It worked when** [`lunamill plugins`](plugins.md) no
longer lists it.

A value a preset adds to a list of values, such as a pattern in
`auto-merge.deny`, can't be left out by one repository. Ask whoever
maintains the preset.

### Who can read a preset

A preset's repository is read in three places only: when you add the
preset, when the update job or `lunamill update` looks for a newer
commit, and when a pull request moves a preset's pin, where lunamill's check on that pull request reads the commit to see that the
lock matches it. Every other command, a build included, reads the lock
and the copies in your own repository. So a preset's repository that is
deleted, renamed, or made private breaks nothing that is already set up.
It stops only updates to that preset, and adding it elsewhere.

| Who owns the preset's repository                                                | How your machine reads it                         | How a run in the cloud reads it                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The same person or organization as your repository, whether it is public or not | With your sign-in to the code host, as `git` does | Prepare reads it, with the [build token](../security/credentials.md), which has to be able to. In an organization that is set up, Prepare reads it with the token it makes from the organization's App, which covers the preset's repository when the App is installed on it. The check of a pull request reads only a public one, and the automated review's run checks a private one whose pin moved |
| Someone else, and it is public                                                  | With no sign-in                                   | With no sign-in                                                                                                                                                                                                                                                                                                                                                                                        |
| Someone else, and it is private                                                 | It is refused                                     | It is refused                                                                                                                                                                                                                                                                                                                                                                                          |

### A preset from someone else

Any public repository that holds a `lunamill-preset.yaml` is a preset.
Nothing is published and nobody registers anything: you add it by its
address.

```console
$ lunamill preset add foo/presets//bar
foo/presets//bar is public, and foo is not this repository's owner.
foo/presets//bar at 3f9c2e1, from November 20, would change these settings here:

  added
    plugins.build.reviewers    + bar-reviewer
    auto-merge.deny            + package-lock.json
  replaces the default
    rules.review-rounds        2 → 3

  writes .claude/agents/bar-reviewer.md

Apply? [y/N] y
✓ Added foo/presets//bar to .claude/lunamill.yaml, pinned at 3f9c2e1 in .claude/lunamill.lock.
✓ Wrote .claude/agents/bar-reviewer.md.
```

Read it before you answer. A preset brings commands lunamill runs, on
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
- **[What a preset can't set](writing-a-preset.md#what-a-preset-cant-set)** holds for it
  too.

A private preset of another owner can't be followed, since a run in your
repository has no way to read it:

```console
$ lunamill preset add foo/private-presets
✗ foo/private-presets: not found, or private. A preset of another owner has to be public. To follow a private one, keep a copy under acme and add the copy.
```

Neither can a preset on another code host: a name is always read on the
code host of the repository that follows it. A copy is a repository of
your own that holds the preset's folder. It follows nothing, so you
bring the original's later changes into it yourself.
