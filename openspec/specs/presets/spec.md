# presets Specification

## Purpose

Presets: folders of settings, agents, and skills in a repository on the code host, each pinned to a commit in the lock, that several repositories share, how `factory sync` combines them with the factory's defaults and `.claude/factory.yaml`, and the `factory preset` commands that add, remove, choose between, check, and report on them.

## Requirements

### Requirement: The order of the layers

The factory SHALL behave as this line says: When `.claude/factory.yaml` lists `presets`, the settings in effect are the factory's defaults, then each preset in the order listed, then `.claude/factory.yaml`, each applied on top of the ones before it.

#### Scenario: The order of the layers

- **WHEN** `.claude/factory.yaml` lists `presets`
- **THEN** the settings in effect are the factory's defaults, then each preset in the order listed, then `.claude/factory.yaml`, each applied on top of the ones before it.

### Requirement: A single value

The factory SHALL behave as this line says: When two layers set the same single value, the later one applies, unless `.claude/factory.choices.yaml` names an earlier preset for that setting. A value set in `.claude/factory.yaml` applies over every preset's.

#### Scenario: A single value

- **WHEN** two layers set the same single value
- **THEN** the later one applies, unless `.claude/factory.choices.yaml` names an earlier preset for that setting. A value set in `.claude/factory.yaml` applies over every preset's.

### Requirement: A list of commands

The factory SHALL behave as this line says: When two layers set a key under `commands`, a preset for some folders adds its commands after the list that applies without it, and among the other layers `commands.gate`, `commands.before-commit`, and `commands.build-setup` take one layer's whole list, chosen as line 16 chooses a single value.

#### Scenario: A list of commands

- **WHEN** When two layers set a key under `commands`
- **THEN** a preset for some folders adds its commands after the list that applies without it, and among the other layers `commands.gate`, `commands.before-commit`, and `commands.build-setup` take one layer's whole list, chosen as line 16 chooses a single value.

### Requirement: A list of plugins

The factory SHALL behave as this line says: When layers set `plugins.build.builders`, `plugins.build.reviewers`, `plugins.test.reviewers`, or `plugins.conflicts.resolvers`, every plugin from every layer applies, in layer order. A plugin that two layers name, by its agent or skill, is chosen as line 16 chooses a single value, its whole entry from one layer.

#### Scenario: A list of plugins

- **WHEN** layers set `plugins.build.builders`, `plugins.build.reviewers`, `plugins.test.reviewers`, or `plugins.conflicts.resolvers`
- **THEN** every plugin from every layer applies, in layer order. A plugin that two layers name, by its agent or skill, is chosen as line 16 chooses a single value, its whole entry from one layer.

### Requirement: Leaving a plugin out

The factory SHALL behave as this line says: When `.claude/factory.yaml` names a plugin with `off: true`, that plugin does not apply, and `factory plugins` does not list it.

#### Scenario: Leaving a plugin out

- **WHEN** `.claude/factory.yaml` names a plugin with `off: true`
- **THEN** that plugin does not apply, and `factory plugins` does not list it.

### Requirement: A list of values

The factory SHALL behave as this line says: When layers set `pr-review.commands`, `auto-merge.deny`, `site.pages`, `site.widths`, `site.checks`, or `site.hide`, every value from every layer applies, each once, in layer order.

#### Scenario: A list of values

- **WHEN** layers set `pr-review.commands`, `auto-merge.deny`, `site.pages`, `site.widths`, `site.checks`, or `site.hide`
- **THEN** every value from every layer applies, each once, in layer order.

### Requirement: A setting with a type

The factory SHALL behave as this line says: When a later layer sets `tickets`, `specs`, or `code-host` with a different `type` from an earlier one, the later layer's whole block applies, and nothing of the earlier block's.

#### Scenario: A setting with a type

- **WHEN** a later layer sets `tickets`, `specs`, or `code-host` with a different `type` from an earlier one
- **THEN** the later layer's whole block applies, and nothing of the earlier block's.

### Requirement: Two presets ship the same file

The factory SHALL behave as this line says: When two presets ship an agent or a skill of the same name, the later preset's file is written, unless `.claude/factory.choices.yaml` names the earlier one for that file's path.

#### Scenario: Two presets ship the same file

- **WHEN** two presets ship an agent or a skill of the same name
- **THEN** the later preset's file is written, unless `.claude/factory.choices.yaml` names the earlier one for that file's path.

### Requirement: The repository's own file stays

The factory SHALL behave as this line says: When a preset ships an agent or a skill whose path is a file the repository wrote itself, one the lock does not list, `factory sync` leaves that file and prints `kept PATH, this repository's own, over NAME`.

#### Scenario: The repository's own file stays

- **WHEN** a preset ships an agent or a skill whose path is a file the repository wrote itself
- **THEN** one the lock does not list, `factory sync` leaves that file and prints `kept PATH, this repository's own, over NAME`.

### Requirement: Keys of one block

The factory SHALL behave as this line says: When two layers set different keys of the same block, such as `tickets.columns` or `session-minutes`, both apply, each key chosen as line 16 chooses a single value.

#### Scenario: Keys of one block

- **WHEN** two layers set different keys of the same block
- **THEN** such as `tickets.columns` or `session-minutes`, both apply, each key chosen as line 16 chooses a single value.

### Requirement: An emptied role gets no built-in plugin

The factory SHALL behave as this line says: When `off: true` leaves a role's list empty, the role has no plugin, and the factory's built-in plugin for it does not come back.

#### Scenario: An emptied role gets no built-in plugin

- **WHEN** `off: true` leaves a role's list empty
- **THEN** the role has no plugin, and the factory's built-in plugin for it does not come back.

### Requirement: The factory's own file stays

The factory SHALL behave as this line says: When a preset ships an agent or a skill at the path of one of the factory's own files, `factory sync` writes the factory's and prints `kept PATH, the factory's own, over NAME`.

#### Scenario: The factory's own file stays

- **WHEN** a preset ships an agent or a skill at the path of one of the factory's own files
- **THEN** `factory sync` writes the factory's and prints `kept PATH, the factory's own, over NAME`.

### Requirement: Settings a preset can't set

The factory SHALL behave as this line says: When a preset sets `repository`, `auto-merge.allow`, or `auto-merge.commands`, `factory sync` and `factory config check` print `NAME: KEY: a preset can't set this`.

#### Scenario: Settings a preset can't set

- **WHEN** a preset sets `repository`, `auto-merge.allow`, or `auto-merge.commands`
- **THEN** `factory sync` and `factory config check` print `NAME: KEY: a preset can't set this`.

### Requirement: A preset that names a preset

The factory SHALL behave as this line says: When a preset sets `presets`, they print `NAME: presets: a preset can't name another preset`.

#### Scenario: A preset that names a preset

- **WHEN** a preset sets `presets`
- **THEN** they print `NAME: presets: a preset can't name another preset`.

### Requirement: Off in a preset

The factory SHALL behave as this line says: When a preset writes `off: true` on a plugin, they print `NAME: KEY: off: only .claude/factory.yaml can leave a plugin out`.

#### Scenario: Off in a preset

- **WHEN** a preset writes `off: true` on a plugin
- **THEN** they print `NAME: KEY: off: only .claude/factory.yaml can leave a plugin out`.

### Requirement: An unknown key or version in a preset

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An unknown key or version in a preset

- **WHEN** a preset has a key the factory doesn't know, in effect or as the first fault of the preset by itself
- **THEN** `factory sync` and `factory config check` print the message `factory config check` prints for the same fault in `.claude/factory.yaml`, prefixed with `NAME: `. A preset with a `version` other than 2 is refused the same way when it is added or updated.

### Requirement: A preset listed twice

The factory SHALL behave as this line says: When `presets` lists the same preset twice with the same `in`, or twice without one, they print `presets: NAME is listed twice`, with ` --in IN` after NAME when it has one.

#### Scenario: A preset listed twice

- **WHEN** When `presets` lists the same preset twice with the same `in`, or twice without one
- **THEN** they print `presets: NAME is listed twice`, with ` --in IN` after NAME when it has one.

### Requirement: Off on a plugin no preset names

The factory SHALL behave as this line says: When `.claude/factory.yaml` writes `off: true` on a plugin that no preset names, they print `KEY: NAME: off, but no preset names it`.

#### Scenario: Off on a plugin no preset names

- **WHEN** `.claude/factory.yaml` writes `off: true` on a plugin that no preset names
- **THEN** they print `KEY: NAME: off, but no preset names it`.

### Requirement: Preset add shows a summary

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preset add shows a summary

- **WHEN** `factory preset add NAME` runs in a terminal
- **THEN** it downloads the newest commit of NAME's repository, then prints the summary of Proposed docs: changes grouped as `added`, `replaces the default`, `disagrees with PRESET`, and `replaced by your .claude/factory.yaml`, then `writes PATH` for each agent and skill. It changes nothing else before `Apply? [y/N]` is answered `y`. A value the preset sets equal to the one in effect is not listed.

### Requirement: Preset add asks where presets disagree

The factory SHALL behave as this line says: When the summary has a value two presets set differently, `preset add` asks which to follow, as Proposed docs shows, and records the answer in `.claude/factory.choices.yaml`.

#### Scenario: Preset add asks where presets disagree

- **WHEN** the summary has a value two presets set differently
- **THEN** `preset add` asks which to follow, as Proposed docs shows, and records the answer in `.claude/factory.choices.yaml`.

### Requirement: Preset add asks about the repository's own value

The factory SHALL behave as this line says: When the summary has a value `.claude/factory.yaml` sets, `preset add` asks `keep` or `drop`. `drop` deletes that key from `.claude/factory.yaml`, and `keep` changes nothing.

#### Scenario: Preset add asks about the repository's own value

- **WHEN** the summary has a value `.claude/factory.yaml` sets
- **THEN** `preset add` asks `keep` or `drop`. `drop` deletes that key from `.claude/factory.yaml`, and `keep` changes nothing.

### Requirement: Preset add applies

The factory SHALL behave as this line says: When `Apply?` is answered `y`, `preset add` adds NAME, quoted, at the end of `presets`, writes the answers, runs the sync, and prints the lines "What preset add prints when applied" gives.

#### Scenario: Preset add applies

- **WHEN** `Apply?` is answered `y`
- **THEN** `preset add` adds NAME, quoted, at the end of `presets`, writes the answers, runs the sync, and prints the lines "What preset add prints when applied" gives.

### Requirement: Preset add declined

The factory SHALL behave as this line says: When `Apply?` is answered anything but `y`, `preset add` changes nothing, prints `Nothing changed.`, and exits 0.

#### Scenario: Preset add declined

- **WHEN** `Apply?` is answered anything but `y`
- **THEN** `preset add` changes nothing, prints `Nothing changed.`, and exits 0.

### Requirement: Preset add outside a terminal

The factory SHALL behave as this line says: When `preset add` runs outside a terminal without `--yes`, it prints the summary, changes nothing as line 35 does, prints `Run it in a terminal to choose, or add --yes to apply it.`, and exits 1.

#### Scenario: Preset add outside a terminal

- **WHEN** `preset add` runs outside a terminal without `--yes`
- **THEN** it prints the summary, changes nothing as line 35 does, prints `Run it in a terminal to choose, or add --yes to apply it.`, and exits 1.

### Requirement: Preset add with yes

The factory SHALL behave as this line says: When `preset add` runs with `--yes`, it applies the summary without asking or recording a choice: where presets disagree the later applies, and `.claude/factory.yaml` keeps its own values.

#### Scenario: Preset add with yes

- **WHEN** `preset add` runs with `--yes`
- **THEN** it applies the summary without asking or recording a choice: where presets disagree the later applies, and `.claude/factory.yaml` keeps its own values.

### Requirement: Preset add with dry run

The factory SHALL behave as this line says: When `preset add` runs with `--dry-run`, it prints the summary, changes nothing as line 35 does, and exits 0.

#### Scenario: Preset add with dry run

- **WHEN** `preset add` runs with `--dry-run`
- **THEN** it prints the summary, changes nothing as line 35 does, and exits 0.

### Requirement: A preset already listed

The factory SHALL behave as this line says: When NAME is already in `presets` with the `in` given, or without one when none is given, `preset add` prints `NAME is already in presets`, with ` --in IN` after NAME when one is given, and exits 1.

#### Scenario: A preset already listed

- **WHEN** When NAME is already in `presets` with the `in` given, or without one when none is given
- **THEN** `preset add` prints `NAME is already in presets`, with ` --in IN` after NAME when one is given, and exits 1.

### Requirement: Preset remove shows a summary

The factory SHALL behave as this line says: When `factory preset remove NAME` runs, it prints the summary of Proposed docs: `removed`, `back to the default`, `back to another preset's value` (`KEY OLD → NEW, from NAME`), `back to a value you chose against`, and `deletes PATH`, then asks about each value that goes back to one the repository chose against, before changing anything.

#### Scenario: Preset remove shows a summary

- **WHEN** `factory preset remove NAME` runs
- **THEN** it prints the summary of Proposed docs: `removed`, `back to the default`, `back to another preset's value` (`KEY OLD → NEW, from NAME`), `back to a value you chose against`, and `deletes PATH`, then asks about each value that goes back to one the repository chose against, before changing anything.

### Requirement: Keeping a value on remove

The factory SHALL behave as this line says: When a value would go back to one the repository chose against and the answer is to keep the current one, `preset remove` writes that value into `.claude/factory.yaml`.

#### Scenario: Keeping a value on remove

- **WHEN** a value would go back to one the repository chose against and the answer is to keep the current one
- **THEN** `preset remove` writes that value into `.claude/factory.yaml`.

### Requirement: Preset remove applies

The factory SHALL behave as this line says: When `preset remove` is applied, it takes NAME out of `presets`, removes each choice that names it, drops it from the lock, deletes the files only it shipped, runs the sync, and prints the lines "What preset remove prints" gives.

#### Scenario: Preset remove applies

- **WHEN** `preset remove` is applied
- **THEN** it takes NAME out of `presets`, removes each choice that names it, drops it from the lock, deletes the files only it shipped, runs the sync, and prints the lines "What preset remove prints" gives.

### Requirement: Preset remove declined, outside a terminal, dry run, or yes

The factory SHALL behave as this line says: When `preset remove` is answered no, run outside a terminal, or run with `--dry-run`, it behaves as lines 35, 36, and 38 say for `preset add`, with nothing changed on a no. With `--yes`, a value that goes back to one the repository chose against takes that value, and nothing is written into `.claude/factory.yaml`.

#### Scenario: Preset remove declined, outside a terminal, dry run, or yes

- **WHEN** `preset remove` is answered no, run outside a terminal, or run with `--dry-run`
- **THEN** it behaves as lines 35, 36, and 38 say for `preset add`, with nothing changed on a no. With `--yes`, a value that goes back to one the repository chose against takes that value, and nothing is written into `.claude/factory.yaml`.

### Requirement: A preset not listed

The factory SHALL behave as this line says: When NAME is not in `presets`, `preset remove` prints `NAME is not in presets` and exits 1.

#### Scenario: A preset not listed

- **WHEN** NAME is not in `presets`
- **THEN** `preset remove` prints `NAME is not in presets` and exits 1.

### Requirement: Prompts ask again

The factory SHALL behave as this line says: When a prompt gets an empty or unrecognized answer, it asks again. `Apply? [y/N]` is the exception: anything but `y` is no.

#### Scenario: Prompts ask again

- **WHEN** a prompt gets an empty or unrecognized answer
- **THEN** it asks again. `Apply? [y/N]` is the exception: anything but `y` is no.

### Requirement: The choices file

The factory SHALL behave as this line says: When `.claude/factory.choices.yaml` holds a choice, the choice is one line, `SETTING: "PRESET"` for a setting or `PATH: "PRESET"` for a file, under the comment Proposed docs shows. The `preset` commands write the file, create it with its first choice, and delete it when its last choice goes.

#### Scenario: The choices file

- **WHEN** `.claude/factory.choices.yaml` holds a choice
- **THEN** the choice is one line, `SETTING: "PRESET"` for a setting or `PATH: "PRESET"` for a file, under the comment Proposed docs shows. The `preset` commands write the file, create it with its first choice, and delete it when its last choice goes.

### Requirement: Preset choices in a terminal

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preset choices in a terminal

- **WHEN** `factory preset choices` runs in a terminal
- **THEN** it prints, for each setting or file two presets set differently, its key, `chosen` or `not chosen yet`, each preset's value numbered, and `← applies now` by the one in effect, then asks `choose [1/2, Enter keeps it]:`. It writes what changed and runs the sync. Enter keeps a setting as it stands, chosen or not chosen yet. It prints `wrote` lines only for the files that changed, and `Nothing changed.` when none did.

### Requirement: Preset choices outside a terminal

The factory SHALL behave as this line says: When `factory preset choices` runs outside a terminal, it prints the same list without asking, and exits 0.

#### Scenario: Preset choices outside a terminal

- **WHEN** `factory preset choices` runs outside a terminal
- **THEN** it prints the same list without asking, and exits 0.

### Requirement: Nothing to choose

The factory SHALL behave as this line says: When nothing two presets set differs, `factory preset choices` prints `No two presets disagree here.` and exits 0.

#### Scenario: Nothing to choose

- **WHEN** nothing two presets set differs
- **THEN** `factory preset choices` prints `No two presets disagree here.` and exits 0.

### Requirement: Preset choose

The factory SHALL behave as this line says: When `factory preset choose KEY PRESET` runs, it records that choice, runs the sync, and exits 0. When no two presets set KEY differently, it prints `KEY: no two presets disagree on this` and exits 1. When PRESET doesn't set KEY, it prints `KEY: PRESET doesn't set this` and exits 1.

#### Scenario: Preset choose

- **WHEN** `factory preset choose KEY PRESET` runs
- **THEN** it records that choice, runs the sync, and exits 0. When no two presets set KEY differently, it prints `KEY: no two presets disagree on this` and exits 1. When PRESET doesn't set KEY, it prints `KEY: PRESET doesn't set this` and exits 1.

### Requirement: A stale choice is dropped

The factory SHALL behave as this line says: When `factory sync` finds a choice naming a preset not in `presets`, or one that no longer sets that key, it drops the choice and prints `dropped the choice for KEY: REASON`, with REASON `NAME is no longer in presets` or `NAME no longer sets it`.

#### Scenario: A stale choice is dropped

- **WHEN** `factory sync` finds a choice naming a preset not in `presets`, or one that no longer sets that key
- **THEN** it drops the choice and prints `dropped the choice for KEY: REASON`, with REASON `NAME is no longer in presets` or `NAME no longer sets it`.

### Requirement: Preset check names each problem

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preset check names each problem

- **WHEN** a preset sets what a preset can't set, names another preset, or leaves a plugin out
- **THEN** `preset check` prints `FILE: KEY: MESSAGE` for each and exits 1. MESSAGE is the one "Settings a preset can't set", "A preset that names a preset", or "Off in a preset" gives, with `. Remove it, and set it in each repository that wants it`, `. Remove it, and list each preset in the repositories that use this one`, or `. Remove it: only a repository can leave a plugin out`. A key the factory doesn't know and a `version` other than 2 are faults of the shared rules, which "Every problem only a preset has, then the first fault" describes.

### Requirement: A plugin the package doesn't ship

The factory SHALL behave as this line says: When a preset's plugin names an agent or a skill that no preset in the same repository ships, `preset check` prints `FILE: KEY: NAME: not shipped here, so each repository that uses this preset must provide it`, and doesn't fail on it. A name that starts with `factory-` is the factory's own and gets no line.

#### Scenario: A plugin the package doesn't ship

- **WHEN** a preset's plugin names an agent or a skill that no preset in the same repository ships
- **THEN** `preset check` prints `FILE: KEY: NAME: not shipped here, so each repository that uses this preset must provide it`, and doesn't fail on it. A name that starts with `factory-` is the factory's own and gets no line.

### Requirement: Preset changes

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preset changes

- **WHEN** `factory preset changes REF` runs
- **THEN** it compares the lock at git REF with the working tree's, and prints the comment of Proposed docs. It starts with `NAME OLD → NEW` for each preset whose commit moved, as "Preset changes names commits" says. `Changes here:` has a line for each setting whose value in effect changed (`KEY: OLD → NEW`, adding `, now from NAME` when its source changed), each list item added or removed (`KEY: + ITEM` or `KEY: − ITEM`, adding `, which wrote PATH` when the item's agent or skill file was written), and each other file written or deleted. `Needs a choice:` has a line for each disagreement that is not chosen yet in the working tree's lock and was not one at REF. `Doesn't apply here:` has a line for each setting an updated preset changed whose value in effect did not, saying which layer's value applies. It ends with the `factory preset choices` line when `Needs a choice:` has a line. A section with no line is left out, and when nothing changed it prints `Nothing changes here.`

### Requirement: A preset's name

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset's name

- **WHEN** `.claude/factory.yaml` lists a name under `presets`
- **THEN** A name under `presets` is `OWNER/NAME` or `OWNER/NAME//FOLDER`, where OWNER may hold more `/`. A name that starts with `@` gets the line the draft shows under Q2, and any other shape `presets: "X" is not a preset's name. Write its repository, as OWNER/NAME or OWNER/NAME//FOLDER`.

### Requirement: Preset add reads the repository

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preset add reads the repository

- **WHEN** `factory preset add NAME` runs
- **THEN** `factory preset add NAME` downloads the newest commit of the repository's default branch, with git, into `~/.cache/software-factory/`, and reads `factory-preset.yaml` at its root or in FOLDER. With none there it prints `NAME: no factory-preset.yaml in OWNER/NAME`, or `no FOLDER/factory-preset.yaml`, and exits 1. A repository of the same owner that cannot be read gets `NAME: OWNER/NAME could not be read: ` and git's last line.

### Requirement: The summary's heading

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The summary's heading

- **WHEN** `factory preset add` prints its summary
- **THEN** Its summary is headed `NAME at COMMIT, from MONTH DAY, would change these settings here:`, from the commit's committer date in UTC, as `November 20`, or `November 20, 2025` when it is not this year.

### Requirement: The summary's runs lines

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The summary's runs lines

- **WHEN** a command in effect after the add has this preset as its source
- **THEN** After `writes`, the summary has one `runs` line for it: the command, a comma, and when it runs, `in the review` for `pr-review.commands`, `at the gate` for `commands.gate`, `before each commit` for `commands.before-commit`, `at the start of a cloud build` for `commands.build-setup`, and `as ` and the setting's key for any other. For a preset for some folders, `, in` and its folders follow.

### Requirement: What preset add prints when applied

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What preset add prints when applied

- **WHEN** `Apply?` is answered `y`
- **THEN** On `y` it prints `✓ Added NAME to .claude/factory.yaml, pinned at COMMIT in .claude/factory.lock.`, then `✓ Wrote FILE.` for the choices file when a choice was made and for each agent and skill.

### Requirement: A preset of another owner

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset of another owner

- **WHEN** `factory preset add` is given a preset of an owner other than `repository`'s
- **THEN** A preset of an owner other than `repository`'s is read with no sign-in. Read so, its summary opens `NAME is public, and OWNER is not this repository's owner.` With `--yes` it is refused: `✗ NAME belongs to another owner, so a person adds it, at a terminal. Run it without --yes.` One that cannot be read so gets the `not found, or private` line the draft shows. Each exits 1 with nothing changed.

### Requirement: Sync reads no preset's repository

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Sync reads no preset's repository

- **WHEN** `factory sync` runs with presets
- **THEN** `factory sync` reads no preset's repository. It combines the settings each preset has in the lock, and checks each file a preset ships against the lock's hash. One that is missing or edited is copied again from the cache, or downloaded again; when that fails, sync prints the third line under "A pin changed by hand" and exits 1.

### Requirement: A preset not pinned yet

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset not pinned yet

- **WHEN** `factory sync` finds a name in `presets` with no entry in the lock, or an entry whose name left `presets`
- **THEN** A name in `presets` with no entry in the lock stops sync with `✗ presets: NAME is not pinned yet. Run: factory preset add NAME`. An entry whose name left `presets` is dropped, with its files.

### Requirement: What preset remove prints

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What preset remove prints

- **WHEN** `factory preset remove NAME` is applied
- **THEN** `factory preset remove NAME` reads only the repository's own files. It prints `✓ Removed NAME from .claude/factory.yaml and .claude/factory.lock.`, `✓ Removed N choices from .claude/factory.choices.yaml.` when it dropped any, and `✓ Deleted FILE.` for each.

### Requirement: The check reads a preset whose commit changed

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The check reads a preset whose commit changed

- **WHEN** the check runs on a pull request
- **THEN** On a pull request, the check reads a preset's repository only for a preset whose commit differs from the base branch's lock. It fails with the first line under "A pin changed by hand" when the lock does not match that commit, its `poller` line included, and with the second when a preset's settings, hashes, or `poller` line changed and its commit did not.

### Requirement: Preset check lists each preset by its file

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preset check lists each preset by its file

- **WHEN** `factory preset check` runs
- **THEN** `factory preset check` runs in any folder with a `factory-preset.yaml` in it or below it, needs no `package.json`, and lists each preset by its file's path. With none it prints `No preset here: no factory-preset.yaml in this folder or below it`.

### Requirement: Preset changes names commits

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preset changes names commits

- **WHEN** `factory preset changes REF` runs
- **THEN** `factory preset changes REF` heads its text `NAME OLD → NEW`, each seven characters, for each preset whose commit moved, and adds `- FILE, rewritten` for each file whose hash changed. Its other lines are today's.

### Requirement: Doctor's line for each preset

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Doctor's line for each preset

- **WHEN** `factory doctor` runs with presets
- **THEN** `factory doctor` prints `✓ NAME is pinned at COMMIT` for each preset.

### Requirement: Preset check refuses a value that is not valid

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preset check refuses a value that is not valid

- **WHEN** a preset's file has a value `factory config check` would refuse in `.claude/factory.yaml`
- **THEN** `factory preset check` prints it in the same words after the preset's file, as `FILE: KEY: MESSAGE`, and exits 1. A message with no `KEY: `, such as `builds.poll-minutes needs builds.trigger: github-action`, follows `FILE: ` as it is.

### Requirement: Every problem only a preset has, then the first fault

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Every problem only a preset has, then the first fault

- **WHEN** a preset's file has several problems
- **THEN** `factory preset check` prints each problem that only a preset has (a setting a preset can't set, `presets`, and `off`), then the first fault the shared rules find. No fault is printed twice.

### Requirement: A preset that leaves out the board

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset that leaves out the board

- **WHEN** a preset leaves out `tickets.board` and writes `tickets.columns`, or a board's field under `tickets.fields`
- **THEN** `factory preset check` passes.

### Requirement: A preset that holds part of the columns, or no branch name

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset that holds part of the columns, or no branch name

- **WHEN** a preset leaves out some or all of `tickets.columns` beside `tickets.board`, or `code-host.branch-name`
- **THEN** `factory preset check` passes.

### Requirement: An interval with no trigger

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An interval with no trigger

- **WHEN** a preset writes `builds.poll-minutes` and leaves out `builds.trigger`
- **THEN** `factory preset check` passes.

### Requirement: A spec check with no spec tool

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A spec check with no spec tool

- **WHEN** a preset writes `specs.check` and leaves out `specs.type`
- **THEN** `factory preset check` passes.

### Requirement: A reviewer whose setting another layer supplies

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A reviewer whose setting another layer supplies

- **WHEN** a preset lists `factory-ui-reviewer` and leaves out `site`, or lists `factory-e2e-reviewer` and leaves out `commands.end-to-end`
- **THEN** `factory preset check` passes.

### Requirement: Part of site, or of coverage

The factory SHALL behave as this line says: When a preset writes part of `site` and leaves out `site.start` or `site.url`, or writes one of `commands.coverage.run` and `commands.coverage.report` as a single map, `factory preset check` passes; a coverage item in a list needs `run` and `report`.

#### Scenario: Part of site, or of coverage

- **WHEN** When a preset writes part of `site` and leaves out `site.start` or `site.url`, or writes one of `commands.coverage.run` and `commands.coverage.report` as a single map
- **THEN** `factory preset check` passes; a coverage item in a list needs `run` and `report`.

### Requirement: A value that is not valid beside a setting left out

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A value that is not valid beside a setting left out

- **WHEN** a value "A preset that leaves out the board" to "Part of site, or of coverage" let stand without its other half is itself not valid, such as `tickets.columns.ready: []` with no board, or `poll-minutes: 7` with no trigger
- **THEN** `factory preset check` fails as "Preset check refuses a value that is not valid" says.

### Requirement: Two settings of one preset that contradict

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Two settings of one preset that contradict

- **WHEN** a preset writes both halves and they contradict, such as `trigger: manual` with `poll-minutes`, or `board: none` with `tickets.columns`
- **THEN** `factory preset check` fails as "Preset check refuses a value that is not valid" says.

### Requirement: A preset in the older version

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset in the older version

- **WHEN** a preset's `version` is 1
- **THEN** `factory preset check`, `factory preset add`, and the poller print the words `factory config check` prints for version 1.

### Requirement: A preset's file that is not YAML

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset's file that is not YAML

- **WHEN** a preset's file is not YAML
- **THEN** `factory preset check` and the poller print `FILE: ` and the words `factory sync` prints for `.claude/factory.yaml`, its hint to quote a value included, and `factory preset add` prints them after `NAME: `. Each exits 1.

### Requirement: Preset add refuses a value that is not valid

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preset add refuses a value that is not valid

- **WHEN** a preset has a fault "Preset check refuses a value that is not valid" describes
- **THEN** `factory preset add NAME` prints `NAME: ` and the same words, exits 1, and changes nothing, whether or not the repository's own file replaces the value.

### Requirement: A pinned preset's value in effect

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A pinned preset's value in effect

- **WHEN** a pinned preset's value is in effect and not valid
- **THEN** `factory sync` and `factory config check` print `NAME: ` and the same words, and exit 1, for every message, one with no `KEY: ` and one about an item of a list included.

### Requirement: A pinned preset's value that is replaced

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A pinned preset's value that is replaced

- **WHEN** a pinned preset's value is not valid and the repository's own file or a later preset replaces it
- **THEN** `factory sync` and `factory config check` pass.

### Requirement: A preset and a repository valid alone and not together

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset and a repository valid alone and not together

- **WHEN** `.claude/factory.yaml` and a preset are each valid alone and not together, such as a preset that lists `factory-ui-reviewer` in a repository with no `site`
- **THEN** `factory config check` fails as today.

### Requirement: A preset for some folders

The factory SHALL behave as this line says: When a `presets` entry is `name` with `in`, `factory preset add NAME --in IN` writes it, and the preset applies only in those folders. A preset already listed without `in` can be added again with it.

#### Scenario: A preset for some folders

- **WHEN** When a `presets` entry is `name` with `in`
- **THEN** `factory preset add NAME --in IN` writes it, and the preset applies only in those folders. A preset already listed without `in` can be added again with it.

### Requirement: A folder preset's paths

The factory SHALL behave as this line says: When a preset has `in`, each command it gives runs in each of those folders, and each path and pattern it gives, `commands.ignore` included, is read from each folder as if it started with `./`.

#### Scenario: A folder preset's paths

- **WHEN** When a preset has `in`
- **THEN** each command it gives runs in each of those folders, and each path and pattern it gives, `commands.ignore` included, is read from each folder as if it started with `./`.

### Requirement: A folder preset's commands are added

The factory SHALL behave as this line says: When a folder preset sets any key under `commands`, its commands are added after the list that applies without it, which is chosen among the other layers as today; a single map, such as `coverage`, joins as a list of one. In `test-one` and `end-to-end`, text moves last.

#### Scenario: A folder preset's commands are added

- **WHEN** When a folder preset sets any key under `commands`
- **THEN** its commands are added after the list that applies without it, which is chosen among the other layers as today; a single map, such as `coverage`, joins as a list of one. In `test-one` and `end-to-end`, text moves last.

### Requirement: A folder preset's relock

The factory SHALL behave as this line says: When a folder preset sets `relock`, its commands are added to the default `npm install`; only the repository's own `relock` replaces the default.

#### Scenario: A folder preset's relock

- **WHEN** When a folder preset sets `relock`
- **THEN** its commands are added to the default `npm install`; only the repository's own `relock` replaces the default.

### Requirement: A folder preset's sites

The factory SHALL behave as this line says: When a folder preset sets `site`, its sites are added to the others.

#### Scenario: A folder preset's sites

- **WHEN** When a folder preset sets `site`
- **THEN** its sites are added to the others.

### Requirement: A folder preset's reviewers

The factory SHALL behave as this line says: When a folder preset gives a reviewer with no `files`, the reviewer reads changes matching `./**` in each of its folders; when two folder presets give the same reviewer, it is one reviewer reading both presets' folders.

#### Scenario: A folder preset's reviewers

- **WHEN** When a folder preset gives a reviewer with no `files`
- **THEN** the reviewer reads changes matching `./**` in each of its folders; when two folder presets give the same reviewer, it is one reviewer reading both presets' folders.

### Requirement: The same preset for different folders

The factory SHALL behave as this line says: When the same preset is listed twice with different `in`, or once with `in` and once without, both apply, sharing its one pin in `.claude/factory.lock`.

#### Scenario: The same preset for different folders

- **WHEN** When the same preset is listed twice with different `in`
- **THEN** or once with `in` and once without, both apply, sharing its one pin in `.claude/factory.lock`.

### Requirement: What a folder preset can set

The factory SHALL behave as this line says: When a folder preset sets anything but `commands`, `plugins`, or `site`, `factory config check` and `factory sync` fail with `presets[N]: NAME sets KEY, which a preset for some folders can't`.

#### Scenario: What a folder preset can set

- **WHEN** When a folder preset sets anything but `commands`
- **THEN** `plugins`, or `site`, `factory config check` and `factory sync` fail with `presets[N]: NAME sets KEY, which a preset for some folders can't`.

### Requirement: The summary for a folder preset

The factory SHALL behave as this line says: When `factory preset add` shows its summary for a folder preset, each command's row names the folders it runs in.

#### Scenario: The summary for a folder preset

- **WHEN** When `factory preset add` shows its summary for a folder preset
- **THEN** each command's row names the folders it runs in.
