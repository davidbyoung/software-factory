# Write a preset

For someone who shares settings across several repositories. A preset is
a folder in a repository on your code host that holds the settings those
repositories share ([Use a preset](presets.md#the-idea)). At the end a
repository holds your preset, and others follow it.

## Making the repository

1. **Create a repository** on your code host, or use one you have. It can
   have any name, and hold other things too. If you name it
   `factory-config`, `factory init` finds it without being told, in
   every repository of the same owner. For an organization,
   [`factory init --org`](../setup/organization.md#set-an-organization-up-once)
   creates `factory-config` with a first preset in it.
2. **Write `factory-preset.yaml` at its root.** It takes the
   same settings as `.claude/factory.yaml` ([Settings](../reference/settings/README.md#every-setting)),
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
   agent expects them ([Your own skills and agents](plugins.md)), and each approval policy's
   files in `approval-policies/NAME/`
   ([Approval policies](../features/approval-policies.md#ship-a-policy-in-a-preset)).
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

## The ticket system is set through a company preset

A company, or any organization, whose repositories share one ticket
system and one board puts [`tickets`](../reference/settings/tickets.md#tickets) in its
preset, as the file above does: the system, the board's number, and its
columns. Every repository that follows the preset then has its tickets
on that board, `factory init` asks
none of them about tickets or a board, and one poller starts the builds
of all of them ([The poller](../features/builds-from-the-board.md#the-poller)). The preset that
`factory init --org` writes for an organization is one of these.

Presets stay optional. A repository that follows none writes `tickets`
in its own `.claude/factory.yaml`.

## What a preset can't set

Three settings belong to each repository:
[`repository`](../reference/settings/README.md#repository), and
[`auto-merge.allow` and `auto-merge.commands`](../reference/settings/auto-merge.md#auto-merge).
Each one decides who a session takes instructions from or what merges
without a person. If a preset could set `auto-merge.allow`, one update
could let changes merge themselves in every repository at once.

A preset also can't name another preset. Each repository lists every
preset it follows, so the order is in one place, and adding one never
brings in another.

## Checking and releasing

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
leave [`site`](../reference/settings/site.md#site) to each repository that follows it
or to another preset.

In an organization's `factory-config`, the command also compares the
schedule of `.github/workflows/factory-poller.yml` with
[`builds.poll-minutes`](../reference/settings/builds.md#builds) in the preset beside
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
job's next run, as [When a preset changes](presets.md#when-a-preset-changes)
describes. Who may merge into that repository decides what every
repository that follows it is offered.

There is no way to offer a change to one repository before the rest. To
try one first, put it in a folder of its own, such as `next/`, and
follow `acme/factory-config//next` from the repository you try it in.
