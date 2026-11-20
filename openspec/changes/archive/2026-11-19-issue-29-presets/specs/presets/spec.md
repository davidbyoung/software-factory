## ADDED Requirements

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

The factory SHALL behave as this line says: When two layers set `commands.gate`, `commands.before-commit`, or `commands.build-setup`, one layer's whole list applies, chosen as line 16 chooses a single value.

#### Scenario: A list of commands

- **WHEN** two layers set `commands.gate`, `commands.before-commit`, or `commands.build-setup`
- **THEN** one layer's whole list applies, chosen as line 16 chooses a single value.

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

The factory SHALL behave as this line says: When a preset has a key the factory doesn't know, or a `version` other than 2, they print the message `factory config check` prints for the same fault in `.claude/factory.yaml`, prefixed with `NAME: `.

#### Scenario: An unknown key or version in a preset

- **WHEN** a preset has a key the factory doesn't know
- **THEN** or a `version` other than 2, they print the message `factory config check` prints for the same fault in `.claude/factory.yaml`, prefixed with `NAME: `.

### Requirement: A preset listed twice

The factory SHALL behave as this line says: When `presets` lists the same preset twice, they print `presets: NAME is listed twice`.

#### Scenario: A preset listed twice

- **WHEN** `presets` lists the same preset twice
- **THEN** they print `presets: NAME is listed twice`.

### Requirement: A preset with no file

The factory SHALL behave as this line says: When a listed preset has no `factory-preset.yaml` in its folder, they print `NAME: no factory-preset.yaml in node_modules/PACKAGE/FOLDER`.

#### Scenario: A preset with no file

- **WHEN** a listed preset has no `factory-preset.yaml` in its folder
- **THEN** they print `NAME: no factory-preset.yaml in node_modules/PACKAGE/FOLDER`.

### Requirement: Off on a plugin no preset names

The factory SHALL behave as this line says: When `.claude/factory.yaml` writes `off: true` on a plugin that no preset names, they print `KEY: NAME: off, but no preset names it`.

#### Scenario: Off on a plugin no preset names

- **WHEN** `.claude/factory.yaml` writes `off: true` on a plugin that no preset names
- **THEN** they print `KEY: NAME: off, but no preset names it`.

### Requirement: Preset add shows a summary

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preset add shows a summary

- **WHEN** `factory preset add NAME` runs in a terminal
- **THEN** it installs the package NAME is in as a dev dependency, then prints the summary of Proposed docs: changes grouped as `added`, `replaces the default`, `disagrees with PRESET`, and `replaced by your .claude/factory.yaml`, then `writes PATH` for each agent and skill. It changes nothing else before `Apply? [y/N]` is answered `y`. A value the preset sets equal to the one in effect is not listed.

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

The factory SHALL behave as this line says: When `Apply?` is answered `y`, `preset add` adds NAME, quoted, at the end of `presets`, writes the answers, runs the sync, and prints `added NAME to presets in .claude/factory.yaml` and the sync's lines.

#### Scenario: Preset add applies

- **WHEN** `Apply?` is answered `y`
- **THEN** `preset add` adds NAME, quoted, at the end of `presets`, writes the answers, runs the sync, and prints `added NAME to presets in .claude/factory.yaml` and the sync's lines.

### Requirement: Preset add declined

The factory SHALL behave as this line says: When `Apply?` is answered anything but `y`, `preset add` uninstalls the package unless it was installed before, changes nothing else, prints `Nothing changed.`, and exits 0.

#### Scenario: Preset add declined

- **WHEN** `Apply?` is answered anything but `y`
- **THEN** `preset add` uninstalls the package unless it was installed before, changes nothing else, prints `Nothing changed.`, and exits 0.

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

The factory SHALL behave as this line says: When NAME is already in `presets`, `preset add` prints `NAME is already in presets` and exits 1.

#### Scenario: A preset already listed

- **WHEN** NAME is already in `presets`
- **THEN** `preset add` prints `NAME is already in presets` and exits 1.

### Requirement: npm can't install the preset

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: npm can't install the preset

- **WHEN** npm can't install the package
- **THEN** `preset add` prints `npm couldn't install NAME: REGISTRY answered STATUS.` and exits 1 with nothing changed. REGISTRY is the registry npm used, from `npm config get @SCOPE:registry`, or `npm config get registry` for an unscoped package. STATUS comes from npm's error code, such as `401 Unauthorized` for `E401`. When the code is 401, 403, or 404, it adds `If it's a private package, give this machine a token for REGISTRY, as .npmrc expects.` When npm's error has no HTTP status, it prints `npm couldn't install NAME:` and npm's last error line.

### Requirement: A package with no preset file

The factory SHALL behave as this line says: When the package has no `factory-preset.yaml` in NAME's folder, `preset add` prints line 29's message, uninstalls it as line 35 does, and exits 1.

#### Scenario: A package with no preset file

- **WHEN** the package has no `factory-preset.yaml` in NAME's folder
- **THEN** `preset add` prints line 29's message, uninstalls it as line 35 does, and exits 1.

### Requirement: The Dependabot group line

The factory SHALL behave as this line says: When `.github/dependabot.yml` exists and no group in it has the package as its only pattern, `preset add` ends with `Next: in .github/dependabot.yml, give PACKAGE a group of its own, so its updates arrive as their own pull requests.`

#### Scenario: The Dependabot group line

- **WHEN** `.github/dependabot.yml` exists and no group in it has the package as its only pattern
- **THEN** `preset add` ends with `Next: in .github/dependabot.yml, give PACKAGE a group of its own, so its updates arrive as their own pull requests.`

### Requirement: The Dependabot registry line

The factory SHALL behave as this line says: When `.npmrc` sends the package's scope to a registry that `.github/dependabot.yml` has no `registries` entry for, `preset add` ends with `Next: in .github/dependabot.yml, add REGISTRY under registries, so Dependabot sees new versions of PACKAGE.`

#### Scenario: The Dependabot registry line

- **WHEN** `.npmrc` sends the package's scope to a registry that `.github/dependabot.yml` has no `registries` entry for
- **THEN** `preset add` ends with `Next: in .github/dependabot.yml, add REGISTRY under registries, so Dependabot sees new versions of PACKAGE.`

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

The factory SHALL behave as this line says: When `preset remove` is applied, it takes NAME out of `presets`, removes each choice that names it, uninstalls its package unless another listed preset is in the same package, deletes the files only it shipped, runs the sync, and prints `removed NAME from presets in .claude/factory.yaml`, `removed K choices from .claude/factory.choices.yaml` when K is above 0, and the sync's lines.

#### Scenario: Preset remove applies

- **WHEN** `preset remove` is applied
- **THEN** it takes NAME out of `presets`, removes each choice that names it, uninstalls its package unless another listed preset is in the same package, deletes the files only it shipped, runs the sync, and prints `removed NAME from presets in .claude/factory.yaml`, `removed K choices from .claude/factory.choices.yaml` when K is above 0, and the sync's lines.

### Requirement: Preset remove declined, outside a terminal, dry run, or yes

The factory SHALL behave as this line says: When `preset remove` is answered no, run outside a terminal, or run with `--dry-run`, it behaves as lines 35, 36, and 38 say for `preset add`, with nothing uninstalled on a no. With `--yes`, a value that goes back to one the repository chose against takes that value, and nothing is written into `.claude/factory.yaml`.

#### Scenario: Preset remove declined, outside a terminal, dry run, or yes

- **WHEN** `preset remove` is answered no, run outside a terminal, or run with `--dry-run`
- **THEN** it behaves as lines 35, 36, and 38 say for `preset add`, with nothing uninstalled on a no. With `--yes`, a value that goes back to one the repository chose against takes that value, and nothing is written into `.claude/factory.yaml`.

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

### Requirement: Preset check lists the presets

The factory SHALL behave as this line says: When `factory preset check` runs in a package's folder, it prints one line for each preset it finds, the root's and each subfolder's with a `factory-preset.yaml`, as `NAME` and what it ships, `N agents, M skills` or `no agents or skills`, and exits 0 when it finds no problem.

#### Scenario: Preset check lists the presets

- **WHEN** `factory preset check` runs in a package's folder
- **THEN** it prints one line for each preset it finds, the root's and each subfolder's with a `factory-preset.yaml`, as `NAME` and what it ships, `N agents, M skills` or `no agents or skills`, and exits 0 when it finds no problem.

### Requirement: Preset check names each problem

The factory SHALL behave as this line says: When a preset has a problem of lines 24 to 27, `preset check` prints `FILE: KEY: MESSAGE` for each and exits 1. MESSAGE is line 24's with `. Remove it, and set it in each repository that wants it`, line 25's with `. Remove it, and list each preset in the repositories that use this one`, line 26's with `. Remove it: only a repository can leave a plugin out`, and line 27's as `factory config check` words it.

#### Scenario: Preset check names each problem

- **WHEN** a preset has a problem of lines 24 to 27
- **THEN** `preset check` prints `FILE: KEY: MESSAGE` for each and exits 1. MESSAGE is line 24's with `. Remove it, and set it in each repository that wants it`, line 25's with `. Remove it, and list each preset in the repositories that use this one`, line 26's with `. Remove it: only a repository can leave a plugin out`, and line 27's as `factory config check` words it.

### Requirement: A plugin the package doesn't ship

The factory SHALL behave as this line says: When a preset's plugin names an agent or a skill that no preset in the same package ships, `preset check` prints `FILE: KEY: NAME: not shipped here, so each repository that uses this preset must provide it`, and doesn't fail on it. A name that starts with `factory-` is the factory's own and gets no line.

#### Scenario: A plugin the package doesn't ship

- **WHEN** a preset's plugin names an agent or a skill that no preset in the same package ships
- **THEN** `preset check` prints `FILE: KEY: NAME: not shipped here, so each repository that uses this preset must provide it`, and doesn't fail on it. A name that starts with `factory-` is the factory's own and gets no line.

### Requirement: No preset to check

The factory SHALL behave as this line says: When `preset check` runs where there is no `package.json`, or no `factory-preset.yaml` at the root or in a subfolder, it prints `No preset here: no factory-preset.yaml beside a package.json` and exits 1.

#### Scenario: No preset to check

- **WHEN** `preset check` runs where there is no `package.json`, or no `factory-preset.yaml` at the root or in a subfolder
- **THEN** it prints `No preset here: no factory-preset.yaml beside a package.json` and exits 1.

### Requirement: Deps names a preset update

The factory SHALL behave as this line says: When `factory deps` lists a Dependabot pull request that updates a preset's package, it says the update needs a sync, as it says for the factory's own.

#### Scenario: Deps names a preset update

- **WHEN** `factory deps` lists a Dependabot pull request that updates a preset's package
- **THEN** it says the update needs a sync, as it says for the factory's own.

### Requirement: Preset changes

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preset changes

- **WHEN** `factory preset changes REF` runs
- **THEN** it compares the lock at git REF with the working tree's, and prints the comment of Proposed docs. It starts with `PACKAGE V1 → V2` for each preset package whose version changed. `Changes here:` has a line for each setting whose value in effect changed (`KEY: OLD → NEW`, adding `, now from NAME` when its source changed), each list item added or removed (`KEY: + ITEM` or `KEY: − ITEM`, adding `, which wrote PATH` when the item's agent or skill file was written), and each other file written or deleted. `Needs a choice:` has a line for each disagreement that is not chosen yet in the working tree's lock and was not one at REF. `Doesn't apply here:` has a line for each setting an updated preset changed whose value in effect did not, saying which layer's value applies. It ends with the `factory preset choices` line when `Needs a choice:` has a line. A section with no line is left out, and when nothing changed it prints `Nothing changes here.`

### Requirement: The deps skill on a preset update

The factory SHALL behave as this line says: When `factory-deps` shepherds a pull request that updates a preset, it runs `factory sync`, commits what it wrote, and comments what `factory preset changes` prints for the default branch, as it does for an update of the factory.

#### Scenario: The deps skill on a preset update

- **WHEN** `factory-deps` shepherds a pull request that updates a preset
- **THEN** it runs `factory sync`, commits what it wrote, and comments what `factory preset changes` prints for the default branch, as it does for an update of the factory.

### Requirement: Doctor's preset lines

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Doctor's preset lines

- **WHEN** `factory doctor` runs with presets
- **THEN** it prints for each one `✓ NAME V is installed, as the lock records`, or a `✗` line with line 5's or line 6's message. When `.github/dependabot.yml` exists, it prints for each preset package `✓ PACKAGE has a Dependabot group of its own`, or `✗ PACKAGE has no Dependabot group of its own, so its updates may arrive with other packages` with line 42's fix. A stale lock is one `✗` line with the message of lines 4 to 7 or 69. These count toward doctor's result as its other checks do.
