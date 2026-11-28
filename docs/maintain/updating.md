# Updating

**When a new version is released, a pull request appears in your
repository. You read it and merge it.** That is all you have to do, and
nobody installs anything afterward.

Four releases ask more of you. One changes how Lunamill is installed:
[Moving to one install on your machine](upgrade-notes.md#moving-to-one-install-on-your-machine).
The others need lines in your settings file that it doesn't have:
[Moving to settings version 2](upgrade-notes.md#moving-to-settings-version-2) and
[Naming build branches](upgrade-notes.md#naming-build-branches), for every repository, and
[Naming every column](upgrade-notes.md#naming-every-column), for a repository whose
settings have a [`tickets.board`](../reference/settings/tickets.md#tickets). Six more,
[Labeling your open tickets](upgrade-notes.md#labeling-your-open-tickets),
[A spec for every visible change](upgrade-notes.md#a-spec-for-every-visible-change),
[Tickets across repositories](upgrade-notes.md#tickets-across-repositories),
[Follow-ups in the pull request](upgrade-notes.md#follow-ups-in-the-pull-request),
[The poller reads your settings](upgrade-notes.md#the-poller-reads-your-settings), and
[Grouped checks](upgrade-notes.md#grouped-checks), ask nothing of most repositories, but
are worth reading. One more,
[Cloud runs in three jobs](upgrade-notes.md#cloud-runs-in-three-jobs), asks you to pass one
pull request's verdict by hand.

A repository coming from an old release moves to one install first.
Then it takes the rest oldest first, from the bottom of the upgrade notes
up. If `lunamill update` then stops with a settings error, the section for
that error says what to add, and then you run `lunamill update` again.

## What happens

Your repository names one exact version of Lunamill, in three files
Lunamill writes and you commit: `.claude/lunamill.lock`, which also
holds every setting in effect, and the two workflow files,
`.github/workflows/lunamill.yml` and `.github/workflows/lunamill-review.yml`.
Every `lunamill` command run there, on any machine and in the cloud, runs
that version.

1. Lunamill's update job runs in your repository three times a day, at
   01:00, 13:00, and 19:00 UTC. It asks Lunamill's own repository for
   its newest release, and when your repository names an older one, it
   opens one pull request.
2. That pull request raises the version and holds every file the new
   version's [`lunamill sync`](../reference/cli.md#setting-up) wrote, the command that
   writes Lunamill's files into your repository.
3. You read it and merge it. It never merges itself, whatever your
   [`auto-merge`](../reference/settings/auto-merge.md#auto-merge) settings allow.
4. The next time anyone runs `lunamill` in the repository, it downloads
   that version, once, and says so:

   ```text
   Downloading Lunamill 0.3.0, which this repository names. This happens once.
   ```

The job needs [builds in the cloud](../features/cloud-builds.md), since it pushes a
branch and opens a pull request with the build's token, or, in an
organization that is set up, with a token made from the organization's
App. Without them, [do it yourself](#doing-it-yourself).

## What the pull request holds

- **The new version**, in `.claude/lunamill.lock`,
  `.github/workflows/lunamill.yml`, and
  `.github/workflows/lunamill-review.yml`. The lock also holds every
  setting in effect, so a release that changes a default shows in its
  diff.
- **Lunamill's files, rewritten.** Its skills, agents, and rules live
  in your repository, so the diff shows exactly which instruction
  changed.
- **A description** that names the two versions, lists the other files
  the sync changed, and links the release's notes, which say first
  anything to do by hand:

  ```text
  Lunamill 0.2.0 → 0.3.0

  Changes here:
  - .claude/skills/lunamill-build/SKILL.md, rewritten
  - .claude/lunamill/rules.md, rewritten
  - .github/workflows/lunamill.yml, rewritten
  - .github/workflows/lunamill-review.yml, rewritten

  Release notes: https://github.com/lunamill-ai/lunamill/releases/tag/v0.3.0
  ```

An update changes the instructions your sessions follow and the code that
runs with your tokens. Read it as carefully as you would read code.

A change to a [preset](../customize/presets.md) arrives the same way, as a pull
request of its own:
[When a preset changes](../customize/presets.md#when-a-preset-changes).

## Doing it yourself

To update now instead of waiting for the job, or in a repository without
builds in the cloud:

```bash
lunamill update
```

It raises the repository to the newest release of Lunamill and moves
each preset to its newest commit, then syncs:

```text
Lunamill 0.2.0 → 0.3.0
acme/lunamill-config 3f2a91c → 8d04e7b
acme/lunamill-config//node is at its newest commit, 3f2a91c.
✓ Wrote 9 files. Commit them on a branch and open a pull request.
```

With nothing to do, it changes nothing:

```text
✓ Nothing to update: Lunamill is 0.3.0, the newest release, and both presets are at their newest commits.
```

To see whether you are behind without changing anything, run
`lunamill doctor`. When you are, its line for Lunamill reads:

```text
? Lunamill 0.2.0. 0.3.0 is released: merge its pull request, or run lunamill update
```

## Staying on a version, or going back

- **To stay where you are,** close the update's pull request. The job
  does not open it again, and opens a new one for the next release.
- **To go back,** revert the update's pull request. The version and the
  files go back together, and `lunamill` runs the older version again.
  The job does not open that version again either. It opens a pull
  request for the next release, and `lunamill update` takes you to the
  newest whenever you choose.

## The commands

| Command           | When                                                           |
| ----------------- | -------------------------------------------------------------- |
| `lunamill update` | To move to the newest release now, without waiting for the job |
| `lunamill sync`   | After you edit `.claude/lunamill.yaml`, to apply the change    |
| `lunamill doctor` | To see whether you are behind, or why something is off         |

`lunamill sync` rewrites Lunamill's files to match your settings and
the version your repository names. It never changes that version:
`lunamill update` does.

## On a team

Decide who merges updates, and tell them these pull requests are theirs.
An update changes how everyone's sessions behave, so one person should
read each one. After it merges, everyone pulls, and the next `lunamill`
command each person runs downloads the new version, once. Nobody
installs anything, and nobody can be left on an older version than the
repository names.

## When something goes wrong

| What you see                                                                                                               | What happened                                                                                     | What to do                                                                               |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| CI fails with "of Lunamill's files don't match the settings"                                                               | A Lunamill file was edited by hand, or settings changed without a sync                            | Run `lunamill sync` and commit the result                                                |
| A command stops with `This repository names Lunamill 0.3.0, and it could not be downloaded`                                | npm could not fetch that version, and the line ends with npm's reason                             | Fix what npm names, such as the network or a registry setting, and run the command again |
| A command stops with `.claude/lunamill.lock names Lunamill ..., which is not a release`                                    | The lock's `version` line holds something other than a released version, as after an edit by hand | Run `lunamill update`                                                                    |
| A session's commands stop with `lunamill is not installed on this machine`                                                 | This machine has no `lunamill` command                                                            | Install it once, as the line says: `npm install -g @lunamill-ai/lunamill`                |
| A command stops with `version: must be 2`                                                                                  | The update changed the shape of the settings file                                                 | [Move the file](upgrade-notes.md#moving-to-settings-version-2)                           |
| A command stops with [`tickets.columns: is required`](../reference/settings/tickets.md#ticketscolumns) or `have no column` | The update needs a column named for every state                                                   | [Name every column](upgrade-notes.md#naming-every-column)                                |
| A command stops with [`code-host.branch-name: is required`](../reference/settings/code-host.md#code-host)                  | The update needs the pattern a build names its branch by                                          | [Name build branches](upgrade-notes.md#naming-build-branches)                            |
| A command stops with `.claude/lunamill.lock is from an earlier version of lunamill`                                        | The update's sync has not run on this checkout                                                    | Run `lunamill sync` and commit the result                                                |
| A command stops with `.claude/lunamill.yaml changed since the last sync`                                                   | The settings changed without a sync                                                               | Run `lunamill sync` and commit the result                                                |
| The update pull request conflicts with your default branch                                                                 | Something else changed the same file                                                              | Close it, and run `lunamill update` on a new branch                                      |
| `lunamill status` leaves out a ticket you expected                                                                         | It doesn't carry the lunamill label                                                               | Add the label, or run `lunamill ticket adopt N`                                          |

## Never edit a Lunamill file

Every file named `lunamill-...`, and Lunamill's rules, are written by
Lunamill. An edit made to one would be lost on the next update, so CI
fails when one differs from what the version your repository names would
write.

To change what Lunamill does:

- **For your repository only:** say so in your own instructions for the
  agent, which win over Lunamill's rules, change a number under
  [`rules`](../reference/settings/rules.md#rules) in your settings, or put a skill or
  an agent of your own in a [plugin role](../customize/plugins.md).
- **For everyone:** change it in Lunamill, and it reaches you as an
  update.

[Why it works this way](../about/design.md) explains why the files are copied in
and what the three version numbers are.
