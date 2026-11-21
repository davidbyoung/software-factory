# Presets

This page is for a team that sets the factory up the same way in several
repositories. A preset is an npm package that holds the settings those
repositories share, along with any reviewers of your own that the
settings name.

It has two readers:

- **If you look after a repository,** [Using a preset](#using-a-preset)
  ends with your repository following the shared settings, and a pull
  request whenever they change.
- **If you maintain the shared settings,** [Writing a preset](#writing-a-preset)
  ends with a published preset that every repository can add.

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
  - "@acme/factory-preset" # what every Acme repository shares
  - "@acme/factory-preset/node" # extra settings for Acme's Node repositories
commands:
  gate:
    - npm run check # this repository's own
```

A name that starts with `@` must be quoted in YAML. Those are
[scoped npm packages](https://docs.npmjs.com/about-scopes), which is how
most companies publish their own, but any package name works.

`factory sync`, the command that writes the factory's files into your
repository, combines the factory's defaults, each preset in the order
listed, and your own settings. It writes the result into
`.claude/factory.lock`, which you commit and never edit. Every command
reads its settings from the lock, so it has to be up to date: after you
change a setting, a command stops until you sync, and tells you so:

```text
.claude/factory.yaml changed since the last sync. Run: npx --no-install factory sync
```

## Using a preset

### Adding a preset

You need the factory already set up in the repository, which it is when
`.claude/factory.yaml` exists ([Quick start](quick-start.md)). A preset on
the public npm registry needs nothing else. For a private one, see
[Private presets](#private-presets).

In this example the repository already uses `@acme/factory-preset` and
adds the Node one. Run:

```bash
factory preset add @acme/factory-preset/node
```

Before it changes anything, it shows what the preset would change in this
repository:

```text
@acme/factory-preset/node 1.4.0 would change these settings here:

  added
    plugins.build.reviewers    + node-deps-reviewer
    pr-review.commands         + npm audit
  replaces the default
    rules.review-rounds        2 → 3
  disagrees with @acme/factory-preset
    rules.small-change-lines   @acme/factory-preset: 40   this preset: 30
  replaced by your .claude/factory.yaml
    commands.gate              yours: npm run check   this preset's: npm test

  writes .claude/agents/node-deps-reviewer.md

Choose:
  rules.small-change-lines: 30 from this preset, or 40 from @acme/factory-preset? [30/40]
  commands.gate: keep yours, or drop it and use this preset's? [keep/drop]

Apply? [y/N]
```

The summary groups each change by what happens to it:

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

Answering `N` at `Apply?` leaves everything as it was.

The questions appear only when you run the command in a terminal. A
[session](glossary.md) or a CI job gets the summary and nothing changes,
unless it adds `--yes`. With `--yes` nothing is asked: where presets
disagree the later one in your list applies, and your own settings always
stay. To see the summary without changing anything, add `--dry-run`.

**It worked when**
[`factory config explain`](cli.md), which prints every
setting in effect, shows the preset's values marked with its name:

```yaml
rules:
  small-change-lines: 30 # @acme/factory-preset/node, chosen over @acme/factory-preset
  review-rounds: 3 # @acme/factory-preset/node
```

Commit what the command changed: `package.json`, `package-lock.json`,
`.claude/factory.yaml`, `.claude/factory.lock`,
`.claude/factory.choices.yaml` if you made a choice, and the agents and
skills the summary listed under "writes".

### Your choices

Each answer you give where two presets disagree is kept in
`.claude/factory.choices.yaml`. The `preset` commands create and write it,
so you commit it but don't edit it by hand. Each line is a setting, or a
file two presets both ship, and the preset this repository follows for it:

```yaml
rules.small-change-lines: "@acme/factory-preset/node"
.claude/agents/security-reviewer.md: "@acme/factory-preset"
```

A choice names the preset, not its value. When
`@acme/factory-preset/node` later changes 30 to 25, the repository gets 25
and you aren't asked again. You're asked only when something about the
choice itself changes:

| What happens                                                  | What you see                                                                                             |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| You add a preset                                              | A question for each setting it disagrees with another preset on                                          |
| You remove a preset                                           | A question for each setting that would go back to a preset you chose against                             |
| A preset update makes two presets disagree for the first time | A line in [the update's pull request](#when-a-preset-changes). The later preset applies until you choose |
| The preset you chose stops setting a value                    | A line in the update's pull request saying which value applies now                                       |
| A preset you chose against changes its value                  | Nothing, since your choice stands                                                                        |

To see every choice and change any of them, run:

```bash
factory preset choices
```

It lists each setting two presets disagree on, what each preset would set,
and which applies now, then asks which to follow. Outside a terminal it
prints the list without asking. To record one choice without questions,
from a session or a script:

```bash
factory preset choose rules.review-rounds @acme/factory-preset/node
```

**It worked when** `factory config explain` marks the setting
`chosen over` the other preset.

### When a preset changes

A new version of a preset reaches each repository the way a new version
of the factory does ([Updating](updating.md#what-happens)):

1. Your [dependency bot](glossary.md), such as Dependabot, opens a pull
   request for the new version.
2. `factory-deps`, the factory's job for those pull requests, runs
   `factory sync` on it and comments what changed in this repository:

   ```text
   @acme/factory-preset 1.4.0 → 1.5.0

   Changes here:
   - plugins.build.reviewers: + acme-a11y-reviewer,
     which wrote .claude/agents/acme-a11y-reviewer.md

   Needs a choice:
   - rules.review-rounds: @acme/factory-preset now sets 2, and
     @acme/factory-preset/node sets 3. 3 applies, from the later
     preset, until you choose.

   Doesn't apply here:
   - rules.small-change-lines: 40 → 35, but you chose
     @acme/factory-preset/node's 30
   - commands.gate, which your .claude/factory.yaml sets
   ```

3. Anything under "Needs a choice" is safe to merge as it stands: the
   value it names is the one in effect. To choose differently, check out
   the pull request's branch, run `factory preset choices`,
   and push the `.claude/factory.choices.yaml` and `.claude/factory.lock`
   it wrote.
4. Read the pull request and merge it. A preset update never merges
   itself, whatever your [`auto-merge`](configuration.md#auto-merge)
   settings allow.

The diff of `.claude/factory.lock` in that pull request is the whole
change to this repository, setting by setting. Without a dependency bot,
update as [Updating](updating.md#without-dependabot) describes for the
factory, then run `factory sync`.

### Removing a preset

```bash
factory preset remove @acme/factory-preset/node
```

It shows a summary first, as `preset add` does, and asks about any
setting that would go back to the value of a preset you chose against:

```text
Removing @acme/factory-preset/node would change these settings here:

  removed
    plugins.build.reviewers    − node-deps-reviewer
  back to the default
    rules.review-rounds        3 → 2
  back to a value you chose against
    rules.small-change-lines   30 → 40, from @acme/factory-preset

  deletes .claude/agents/node-deps-reviewer.md

Choose:
  rules.small-change-lines: use 40 from @acme/factory-preset, or keep 30 in your .claude/factory.yaml? [40/30]

Apply? [y/N]
```

Keeping 30 writes `small-change-lines: 30` into your `factory.yaml`, since
no preset provides it anymore. Then the command uninstalls the package,
takes it out of `presets`, deletes the agents and skills the preset
shipped, and syncs. A file your repository wrote itself is never deleted.

**It worked when** `factory config explain` no longer names the preset.

### How presets combine

The factory's defaults come first, then each preset in the order
`presets` lists them, then your own `factory.yaml`. When more than one of
them sets the same thing, what applies depends on its kind:

| Kind of setting                           | Examples                                                                                             | What applies when more than one sets it                                                                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| A single value                            | [`rules.small-change-lines`](configuration.md#rules)                                                 | The later preset's value, unless you [chose](#your-choices) another. Your own `factory.yaml` wins over every preset          |
| A list of commands run in order           | [`commands.gate`](configuration.md#commandsgate)                                                     | One whole list, the same way as a single value, since running two lists would run steps twice                                |
| A list of plugins                         | [`plugins.build.reviewers`](configuration.md#pluginsbuild)                                           | Every plugin from every list. A plugin named in two lists is treated as a single value                                       |
| A list of values                          | [`pr-review.commands`](configuration.md#pr-review), [`auto-merge.deny`](configuration.md#auto-merge) | Every value from every list, each once                                                                                       |
| A setting that names its tool with `type` | [`tickets`](configuration.md#tickets), [`specs`](configuration.md#specs)                             | The whole setting from one place, when two places name different tools, so a Jira setup never inherits a GitHub board number |
| An agent or skill file a preset ships     | `.claude/agents/security-reviewer.md`                                                                | The later preset's file, unless you chose another. A file your repository wrote itself always stays                          |

To leave out one plugin a preset adds, name it in your own
`factory.yaml` with `off: true`:

```yaml
plugins:
  build:
    reviewers:
      - agent: acme-security-reviewer
        off: true
```

**It worked when** [`factory plugins`](plugins.md) no
longer lists it.

A value a preset adds to a list of values, such as a command in
`pr-review.commands`, can't be left out by one repository. Ask whoever
maintains the preset.

## Writing a preset

### Making the package

1. **Create an npm package** as you would any other, with `npm init`. If
   its `package.json` has a `files` list, include `factory-preset.yaml`,
   `agents/`, `skills/`, and any subfolder presets in it, or npm leaves
   them out of what it publishes.
2. **Write `factory-preset.yaml` at the package's root.** It takes the
   same settings as `.claude/factory.yaml` ([Configuration](configuration.md#every-setting)),
   so a line moves between the two unchanged:

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

3. **Add the agents and skills its settings name** in `agents/` and
   `skills/`, beside `factory-preset.yaml`, written the way your coding
   agent expects them ([Plugins](plugins.md)). `factory sync` copies them
   into each repository that uses the preset.
4. **For a second preset in the same package,** such as one for Node
   repositories, add a folder with its own `factory-preset.yaml`, and its
   own `agents/` and `skills/` if it needs them. Its name is the package's
   name and the folder's, `@acme/factory-preset/node`:

   ```text
   acme-factory-preset/
   ├── package.json              # "name": "@acme/factory-preset"
   ├── factory-preset.yaml       # the preset @acme/factory-preset
   ├── agents/
   │   └── acme-security-reviewer.md
   ├── skills/
   │   └── acme-refine/SKILL.md
   └── node/
       └── factory-preset.yaml   # the preset @acme/factory-preset/node
   ```

5. **Say which versions of the factory it works with,** in `package.json`,
   so npm warns a repository that has another. Start from the version you
   tested with, which `npm ls @davidbyoung/software-factory` prints:

   ```json
   "peerDependencies": {
     "@davidbyoung/software-factory": "^0.5.0"
   }
   ```

### What a preset can't set

Three settings belong to each repository:
[`repository`](configuration.md#repository), and
[`auto-merge.allow` and `auto-merge.commands`](configuration.md#auto-merge).
Each one decides who a session takes instructions from or what merges
without a person. If a preset could set `auto-merge.allow`, one update
could let changes merge themselves in every repository at once.

A preset also can't name another preset. Each repository lists every
preset it uses, so the order is in one place.

### Checking and publishing

In the package's folder, run:

```bash
factory preset check
```

It prints each preset it found and what it ships, so you can see a
subfolder preset was picked up:

```text
@acme/factory-preset        1 agent, 1 skill
@acme/factory-preset/node   no agents or skills
```

**It worked when** it lists every preset and nothing else. A problem gets
a line saying what to change, and the command fails:

```text
node/factory-preset.yaml: auto-merge.allow: a preset can't set this. Remove it, and set it in each repository that wants it
```

A plugin that names an agent or a skill the package doesn't ship gets a
note, not a failure, since a repository that uses the preset can provide
it:

```text
factory-preset.yaml: plugins.build.reviewers: acme-docs-reader: not shipped here, so each repository that uses this preset must provide it
```

Then publish it with `npm publish`, to the public npm registry or to
your company's private one. Each repository that uses
it gets a pull request at its dependency bot's next run, as
[When a preset changes](#when-a-preset-changes) describes.

## Private presets

A preset is an npm package, so a private one installs on your machine the
way any other private package does, from whichever registry your company
uses, through your repository's `.npmrc`.
[Private npm packages](github/setup.md#private-npm-packages) sets up the
factory's workflows and Dependabot to install it too. Give the preset a
Dependabot group of its own as well, the way
[Dependency bots](github/reference.md#dependency-bots) does for the
factory. `factory preset add` names what's missing.

**It worked when** `factory doctor` shows:

```text
✓ @acme/factory-preset 1.4.0 is installed, as the lock records
✓ @acme/factory-preset has a Dependabot group of its own
```
