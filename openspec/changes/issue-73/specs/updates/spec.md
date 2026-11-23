## Purpose

How a repository moves to a new release of the factory and to a preset's newest commit: `factory update`, the pull requests it opens, the job that runs it, and `factory doctor`'s line for the factory's version.

## ADDED Requirements

### Requirement: A newer release of the factory

The factory SHALL behave as this line says: When `factory update` finds a release of the factory newer than the lock names, it prints `The factory OLD → NEW` and runs NEW's sync, so the lock and both workflow files name NEW.

#### Scenario: A newer release of the factory

- **WHEN** `factory update` finds a release of the factory newer than the lock names
- **THEN** it prints `The factory OLD → NEW` and runs NEW's sync, so the lock and both workflow files name NEW.

### Requirement: A preset's newest commit

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset's newest commit

- **WHEN** `factory update` runs in a repository that follows presets
- **THEN** For each preset, it compares the preset's files, its `factory-preset.yaml` and the `agents/` and `skills/` beside it, at its pinned commit and at the newest commit of its repository's default branch. Where they differ it moves the pin and prints `NAME OLD → NEW`, each seven characters; where they do not, it prints `NAME is at its newest commit, COMMIT.` and leaves the pin.

### Requirement: What factory update prints last

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What factory update prints last

- **WHEN** `factory update` ends
- **THEN** It ends `✓ Wrote N files. Commit them on a branch and open a pull request.`, adding ` and deleted M` after `files` when it deleted any; and `1 file` for one. With nothing to do it prints `✓ Nothing to update: the factory is VERSION, the newest release`, then `.` with no preset, `, and NAME is at its newest commit.` with one, `, and both presets are at their newest commits.` with two, and `, and all N presets ...` with more. It exits 0. In the factory's own repository it moves presets only, and with no settings file it prints `.claude/factory.yaml is missing. Run: factory init` and exits 1.

### Requirement: One pull request for each update

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: One pull request for each update

- **WHEN** `factory update --pull-requests` runs
- **THEN** `factory update --pull-requests` opens one pull request for the factory and one for each preset repository with a moved pin, which moves every such preset of that repository to its newest commit, on the branch and with the title, description, and lines "`factory update`" shows. A preset's description is what `factory preset changes` prints. The factory's lists each file the sync changed but the lock, as `rewritten`, `new`, or `deleted`.

### Requirement: An update already opened

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An update already opened

- **WHEN** a pull request with an update's branch exists
- **THEN** It opens none where a pull request with that update's branch exists, open, closed, or merged, and prints the `is still open` or `was closed` line for it. A newer one for the same thing closes the older open one, with a comment naming it.

### Requirement: A preset repository that cannot be read

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset repository that cannot be read

- **WHEN** `factory update` cannot read a preset's repository
- **THEN** A preset repository it cannot read gets the `?` line. The rest go on, and it exits 0.

### Requirement: The Updates job

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The Updates job

- **WHEN** the Updates job runs
- **THEN** The Updates job runs it at 01:00, 13:00, and 19:00 UTC and by hand, with the build token, and its commits are named and signed as a build's are. With no build token it looks for nothing, prints the line under "With a part off", and passes.

### Requirement: Doctor's line for the factory

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Doctor's line for the factory

- **WHEN** `factory doctor` runs
- **THEN** `factory doctor` prints the factory's line as "`factory doctor`" shows: ✓ with the newest release, `?` when a newer one is released, and `? The factory VERSION. The newest release could not be read: ` and the last line of the code host's error.
