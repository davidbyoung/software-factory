# Updating

**When a new version is released, a pull request appears in your
repository. You read it and merge it.** That is all you have to do, and
nobody installs anything afterward.

Four releases ask more of you. One changes how the factory is installed:
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
   version's [`factory sync`](../reference/cli.md#setting-up) wrote, the command that
   writes the factory's files into your repository.
3. You read it and merge it. It never merges itself, whatever your
   [`auto-merge`](../reference/settings/auto-merge.md#auto-merge) settings allow.
4. The next time anyone runs `factory` in the repository, it downloads
   that version, once, and says so:

   ```text
   Downloading the factory 0.3.0, which this repository names. This happens once.
   ```

The job needs [builds in the cloud](../features/cloud-builds.md), since it pushes a
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

A change to a [preset](../customize/presets.md) arrives the same way, as a pull
request of its own:
[When a preset changes](../customize/presets.md#when-a-preset-changes).

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

| What you see                                                                                                               | What happened                                                                                     | What to do                                                                               |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| CI fails with "of the factory's files don't match the settings"                                                            | A factory file was edited by hand, or settings changed without a sync                             | Run `factory sync` and commit the result                                                 |
| A command stops with `This repository names the factory 0.3.0, and it could not be downloaded`                             | npm could not fetch that version, and the line ends with npm's reason                             | Fix what npm names, such as the network or a registry setting, and run the command again |
| A command stops with `.claude/factory.lock names the factory ..., which is not a release`                                  | The lock's `version` line holds something other than a released version, as after an edit by hand | Run `factory update`                                                                     |
| A session's commands stop with `The factory is not installed on this machine`                                              | This machine has no `factory` command                                                             | Install it once, as the line says: `npm install -g @davidbyoung/software-factory`        |
| A command stops with `version: must be 2`                                                                                  | The update changed the shape of the settings file                                                 | [Move the file](upgrade-notes.md#moving-to-settings-version-2)                           |
| A command stops with [`tickets.columns: is required`](../reference/settings/tickets.md#ticketscolumns) or `have no column` | The update needs a column named for every state                                                   | [Name every column](upgrade-notes.md#naming-every-column)                                |
| A command stops with [`code-host.branch-name: is required`](../reference/settings/code-host.md#code-host)                  | The update needs the pattern a build names its branch by                                          | [Name build branches](upgrade-notes.md#naming-build-branches)                            |
| A command stops with `.claude/factory.lock is from an earlier version of the factory`                                      | The update's sync has not run on this checkout                                                    | Run `factory sync` and commit the result                                                 |
| A command stops with `.claude/factory.yaml changed since the last sync`                                                    | The settings changed without a sync                                                               | Run `factory sync` and commit the result                                                 |
| The update pull request conflicts with your default branch                                                                 | Something else changed the same file                                                              | Close it, and run `factory update` on a new branch                                       |
| `factory status` leaves out a ticket you expected                                                                          | It doesn't carry the factory label                                                                | Add the label, or run `factory ticket adopt N`                                           |

## Never edit a factory file

Every file named `factory-...`, and the factory's rules, are written by
the factory. An edit made to one would be lost on the next update, so CI
fails when one differs from what the version your repository names would
write.

To change what the factory does:

- **For your repository only:** say so in your own instructions for the
  agent, which win over the factory's rules, change a number under
  [`rules`](../reference/settings/rules.md#rules) in your settings, or put a skill or
  an agent of your own in a [plugin role](../customize/plugins.md).
- **For everyone:** change it in the factory, and it reaches you as an
  update.

[Why it works this way](../about/design.md) explains why the files are copied in
and what the three version numbers are.
