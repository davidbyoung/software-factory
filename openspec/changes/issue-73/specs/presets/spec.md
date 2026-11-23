## ADDED Requirements

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
- **THEN** After `writes`, the summary has one `runs` line for each command in effect after the add whose source is this preset: the command, a comma, and when it runs: `in the review` for `pr-review.commands`, `at the gate` for `commands.gate`, `before each commit` for `commands.before-commit`, `at the start of a cloud build` for `commands.build-setup`, and `as ` and the setting's key for any other.

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
- **THEN** On a pull request, the check reads a preset's repository only for a preset whose commit differs from the base branch's lock. It fails with the first line under "A pin changed by hand" when the lock does not match that commit, and with the second when a preset's settings or hashes changed and its commit did not.

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

## MODIFIED Requirements

### Requirement: Preset add shows a summary

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preset add shows a summary

- **WHEN** `factory preset add NAME` runs in a terminal
- **THEN** it downloads the newest commit of NAME's repository, then prints the summary of Proposed docs: changes grouped as `added`, `replaces the default`, `disagrees with PRESET`, and `replaced by your .claude/factory.yaml`, then `writes PATH` for each agent and skill. It changes nothing else before `Apply? [y/N]` is answered `y`. A value the preset sets equal to the one in effect is not listed.

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

### Requirement: Preset remove applies

The factory SHALL behave as this line says: When `preset remove` is applied, it takes NAME out of `presets`, removes each choice that names it, drops it from the lock, deletes the files only it shipped, runs the sync, and prints the lines "What preset remove prints" gives.

#### Scenario: Preset remove applies

- **WHEN** `preset remove` is applied
- **THEN** it takes NAME out of `presets`, removes each choice that names it, drops it from the lock, deletes the files only it shipped, runs the sync, and prints the lines "What preset remove prints" gives.

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

## REMOVED Requirements

### Requirement: A preset with no file

**Reason**: A preset's file is read from its repository when `factory preset add` pins it, and `factory sync` and `factory config check` read the lock, so no command looks for the file under `node_modules`.

**Migration**: See "Preset add reads the repository" for a repository with no `factory-preset.yaml`, and "A preset not pinned yet" for a name with nothing in the lock.

### Requirement: npm can't install the preset

**Reason**: A preset comes from a repository, not from npm, so `preset add` installs no package and prints no `npm couldn't install` line.

**Migration**: See "Preset add reads the repository" and "A preset of another owner" for a repository that cannot be read.

### Requirement: A package with no preset file

**Reason**: A preset comes from a repository, so there is no package to hold a preset file, and none to uninstall.

**Migration**: See "Preset add reads the repository".

### Requirement: The Dependabot group line

**Reason**: A preset is not an npm package, so Dependabot does not see it and `preset add` prints no `Next:` line about a group.

**Migration**: Delete the preset's group from `.github/dependabot.yml`. A preset's update is a pull request the factory opens: see `updates`, "One pull request for each update".

### Requirement: The Dependabot registry line

**Reason**: A preset is not an npm package, so no registry holds it and `preset add` prints no `Next:` line about a registry.

**Migration**: A preset's update is a pull request the factory opens: see `updates`, "One pull request for each update".

### Requirement: Preset check lists the presets

**Reason**: `factory preset check` runs in any folder with a `factory-preset.yaml` in it or below it, not in a package's folder, and lists each preset by its file's path.

**Migration**: See "Preset check lists each preset by its file".

### Requirement: No preset to check

**Reason**: `factory preset check` needs no `package.json`, and its line for a folder with no preset no longer names one.

**Migration**: See "Preset check lists each preset by its file".

### Requirement: Deps names a preset update

**Reason**: No Dependabot pull request updates a preset, so `factory deps` has none to name.

**Migration**: A preset's update is a pull request `factory update --pull-requests` opens: see `updates`, "One pull request for each update".

### Requirement: The deps skill on a preset update

**Reason**: No Dependabot pull request updates a preset, so `factory-deps` has none to shepherd.

**Migration**: The update's pull request already holds what the sync wrote, and its description is what `factory preset changes` prints: see `updates`, "One pull request for each update".

### Requirement: Doctor's preset lines

**Reason**: `factory doctor` prints one line for each preset, its pinned commit. Its lines for a preset's installed version and Dependabot group go.

**Migration**: See "Doctor's line for each preset".
