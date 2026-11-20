# Proposal

From [davidbyoung/software-factory#29](https://github.com/davidbyoung/software-factory/issues/29).

## Why

A company with many repositories sets the factory up the same way in each, and today has to copy the same settings into every `.claude/factory.yaml` by hand: the board, the build trigger, the rules' numbers, the CI review's commands, and its own reviewers. A change to one of them is then a pull request in every repository, and nothing shows which ones have drifted.

A **preset** is an npm package of settings, and of any reviewer agents those settings name, that several repositories share. A repository names its presets in `factory.yaml`, and `factory sync` resolves them, with the factory's defaults and the repository's own settings, into `.claude/factory.lock`. Every command reads its settings from the lock. A newer preset reaches each repository as a Dependabot pull request whose diff shows exactly which settings changed for it, the same way a new factory release does today ([Updating](https://github.com/davidbyoung/software-factory/blob/main/docs/updating.md)).

What a repository would write:

```yaml
# .claude/factory.yaml
version: 2
repository: acme/billing
presets:
  - "@acme/factory-preset" # the organization's defaults
  - "@acme/factory-preset/node" # a layer for one stack
commands:
  gate: [npm run check] # the repository's own settings win
```

And what `factory sync` would write:

```yaml
# .claude/factory.lock: written by `factory sync`. Do not edit.
version: 0.4.0
settings-hash: 3f9a…              # of .claude/factory.yaml
presets:
  - name: "@acme/factory-preset"
    version: 1.4.0
  - name: "@acme/factory-preset/node"
    version: 1.4.0
settings:
  rules:
    small-change-lines: 40         # @acme/factory-preset
    review-rounds: 2               # default
  commands:
    gate: [npm run check]          # factory.yaml
  ...
files:
  - .claude/skills/factory-build/SKILL.md
  - .claude/agents/acme-security-reviewer.md   # from @acme/factory-preset
  ...
```

**Prior art.** This is not a new pattern. projen resolves project types from npm packages into generated files that are checked in, and fails its build when one is stale. The "rendered manifests" pattern in GitOps commits the output of a shared Helm chart or Kustomize base and checks it in CI. `package.json` and `package-lock.json` split intent from what was resolved, and `npm ci` refuses to run when they disagree. The word "preset", and a `presets:` key naming npm packages, is what Tailwind, Babel, and Jest use, and Renovate uses "preset" for nearly this.

## What Changes

- A repository can name presets under `presets` in `.claude/factory.yaml`, and `factory preset add NAME` and `factory preset remove NAME` add or remove one: the npm dev dependency, the line in `presets`, and a sync.
- `factory sync` writes every setting in effect into `.claude/factory.lock`, defaults included, each marked with where its value came from, along with each preset's name and version and a hash of `.claude/factory.yaml`.
- Every command and hook that reads settings reads them from the lock. When `.claude/factory.yaml` has changed since the last sync, each one stops and says to run `factory sync`, and `factory sync --check` fails.
- A preset can ship agents, which `factory sync` copies into `.claude/agents/` and lists in the lock's `files`, and removes when the preset no longer ships them.
- `factory config explain` marks each value as the default, from a named preset, or from `factory.yaml`.
- The docs say how to write, publish, and use a preset.
- Everything under "Proposed docs" below behaves as shown there, and `docs/presets.md` ships as drafted there.

## Capabilities

### New Capabilities

- `settings-lock`: the settings in effect, resolved into `.claude/factory.lock`, and read from there.
- `presets`: settings, agents, and skills shared across repositories as npm packages.

### Modified Capabilities

- `config-explain`: marks a value from a preset, and prints the lock.
- `plugins`: a plugin a preset ships counts as present.
- `remove`: deletes what presets shipped and the choices file.
- `docs`: `docs/presets.md` and the pages that point to it.

## Decisions

Settled by the owner in session, 2026-11-19.

- **An npm package, named in `factory.yaml`, resolved by `factory sync` into a checked-in file.** Resolving the package every time settings are read, as ESLint and `tsconfig` do, was turned down: hooks, the CI review's read of the base commit, and the scheduled poller all read the settings, and each would need `node_modules` first. Having sync write the preset's values into `factory.yaml` itself was turned down too: the preset's values and the repository's edits would share one file, and the next update would overwrite or conflict with them.
- **The resolved settings go into `factory.lock`,** which is already the file sync writes, CI checks, and nobody edits. Its shape changes to hold them.
- **The lock holds every setting, defaults included,** not just what `factory.yaml` and the presets spell out. A release that changes a default then shows in its update pull request, where today it is invisible, and a reader needs only the lock.
- **Settings are read from the lock alone,** as dependencies are read from `package-lock.json`. A stale lock is refused loudly, as `npm ci` refuses, rather than silently used. One consequence: `plugins`, read from `factory.yaml` on every run today, now needs a sync after an edit like every other setting, and `docs/configuration.md` stops saying it does not.
- **The term is "preset",** and the key and the command use the same word: `presets:` and `factory preset add`, not `extends:`. "Package" is every npm dependency, the factory included. "Template" suggests a one-time copy. A **plugin** replaces or adds to one step; a preset is a package of settings, and of the plugin agents they name, shared across repositories.
- **A list of steps replaces, and a list of members adds up.** Changed in the docs-first draft from "lists replace, maps merge": with replace, a repository that added one reviewer of its own would silently drop the organization's shared reviewers, the main reason for presets. Commands run in order, so one layer's list applies whole; plugins, allowed commands, and deny globs add up. "Proposed docs" has the table, including settings with a `type`.
- **`repository` and `version` are never taken from a preset.**

### Settled in the docs-first draft, 2026-11-19

- **One rule settles every other disagreement:** the later preset wins, and the repository's own settings and files come last. Combining presets is never an error, a same-named agent or skill from two presets included; only a real error, listed under "What sync still refuses", stops a sync.
- **Adding or removing a preset shows every change first,** and asks only where two presets disagree, or where the repository's own value replaces a preset's. Anything added to a list is shown without a question. `--yes` and `--dry-run` serve sessions and scripts.
- **Choices are kept in `.claude/factory.choices.yaml`,** not in `factory.yaml` and not in the lock. The lock must stay safe to delete and rebuild from its inputs, and choices kept in it would be lost silently when it is. A choice names a preset, not a value, so the owner is asked once, and again only when a preset is added, removed, or an update makes two presets disagree for the first time. `factory preset choices` shows and changes them, and `factory preset choose` records one without a prompt.
- **A value a preset adds to a list of values can't be left out by one repository** in this first version. It is the one exception to "Not doing: a preset that cannot be overridden", accepted because such a value only narrows what merges (`auto-merge.deny`) or was trusted when the preset was installed (`pr-review.commands`).
- **A preset can't set `repository`, `auto-merge.allow`, or `auto-merge.commands`;** `version` is its own (`approvers` was dropped in refinement, below). Each one decides who a session takes instructions from or what merges without a person.
- **A preset is a folder with a `factory-preset.yaml`** taking the same settings as `factory.yaml`. The package's root is the preset named after the package, and a subfolder with its own file is `package/folder`. A `factory` field in `package.json` was passed over, since YAML lets a line move between the two files unchanged.
- **A preset ships agents and skills,** in `agents/` and `skills/` beside its file, under any name. Not `CLAUDE.md` text. No `factory-` prefix is reserved: a clash with a later factory file is settled like any other same-named file.
- **A stale lock stops every command but `sync`, `doctor`, `config check`, and the `preset` commands,** and blocks a commit; the session-start hook warns.
- **Settings version 2 stays.** A preset file declares its own `version: 2`, and the factory releases it works with go in its `peerDependencies`.
- **`factory preset check` lists each preset it found and what it ships,** so an author can see a subfolder preset was picked up, and each problem says what to change.
- **Private presets need #31,** which makes the factory's workflows install private packages from any registry by following the repository's `.npmrc`. It is not a blocker: a preset on a public registry works without it. No registry gets a path of its own.

### Settled in refinement, 2026-11-19

- **One pull request.** The owner kept the lock and presets together, rather than splitting the move to reading settings from the lock into a ticket of its own.
- **A preset update never merges itself.** `factory-deps-auto-merge.yml` enables auto-merge on every minor or patch Dependabot bump except the factory's own, so `factory sync` writes each preset's package name into that exclusion too.
- **`approvers` leaves the list of settings a preset can't set.** #14 removes the key, and `factory config check` refuses it today as Planned, so a preset can't set it either way. The list is `repository`, `auto-merge.allow`, and `auto-merge.commands`.
- **`off: true` is the repository's alone.** One preset can't take out another's plugin, so a preset that writes it is refused, by `preset check` and by `sync`.
- **The automated review reads the base commit's lock.** Its "List the tools the review may use" step reads `pr-review.commands` from the base commit today, through `FACTORY_SETTINGS`, so a pull request can't widen its own review's commands. With presets, those commands can come from a preset, so it reads the base commit's lock through a new `FACTORY_LOCK`, and the base's `factory.yaml` only when that lock predates this release.
- **`FACTORY_SETTINGS` keeps its meaning:** a settings file read directly, for trying settings out, with its presets resolved from `node_modules`, no lock, and no stale check.
- **A lock written before this release is stale.** It has no `settings`, so every command asks for `factory sync`. The factory update that brings this release is where that sync runs, as `factory-deps` already syncs every factory update.
- **The lock is read as YAML.** `lockedFiles` reads it line by line today, and its pattern would read each item of the new `presets` list as a file.
- **`factory preset changes REF` writes `factory-deps`'s comment.** The comment compares two locks, so a command makes it, and the skill posts what it prints.
- **`preset add` installs before it shows the summary,** since the summary is made from the package's contents. Answering no uninstalls it again.
- **A choice whose preset stops setting its setting is dropped,** and the sync that drops it says so.
- **The lines `preset add` prints after a private preset name only Dependabot.** Saving a registry's token for the factory's workflows is #31's, which adds its own line.
- **The lock records what each value replaced,** in an `overridden` block, so `factory preset changes` can say what an update changed in a layer that didn't win. The lock's `settings` hold only the value in effect, and the old preset versions aren't installed when the comment is made.
- **Blocks merge key by key.** Two layers that set different keys of `tickets.columns`, `session-minutes`, or any other block both apply, each key chosen as a single value is. A block with a `type` is the exception (line 21).
- **A role a layer writes gets no built-in plugin,** even when `off: true` leaves it empty, as when `.claude/factory.yaml` writes the list empty today.
- **The factory's own files always win** over a preset's file of the same path, as the repository's own files do, since every session follows them.
- **Prompts ask again on an empty or unrecognized answer,** except `Apply? [y/N]`, where anything but `y` is no. In `preset choices`, Enter keeps a setting as it stands, chosen or not.
- **`preset remove --yes` takes the remaining preset's value** where a value goes back to one the repository chose against, and writes nothing into `.claude/factory.yaml`.
- **`preset check` doesn't fail on a plugin its package doesn't ship.** The repository using the preset may provide it, so check prints a note for it, and says nothing for a `factory-` name.
- **`docs/presets.md` ships without private registries in the factory's workflows.** #31 builds them, after this, so the page's "Private presets" section marks the workflows' part Planned, and #31 rewrites the section.
- **#31 waits on this ticket.** It makes an edit to `.npmrc` stale the lock "as an edit to `.claude/factory.yaml` does", and that check is built here. Building #31 first would mean building a stale check of its own and replacing it. Recorded as #31 blocked by #29.
