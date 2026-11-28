# updates Specification

## Purpose

How a repository moves to a new release of Lunamill and to a preset's newest commit: `lunamill update`, the pull requests it opens, the job that runs it, and `lunamill doctor`'s line for Lunamill's version.

## Requirements

### Requirement: A newer release of Lunamill

Lunamill SHALL behave as this line says: When `lunamill update` finds a release of Lunamill newer than the lock names, it prints `Lunamill OLD → NEW` and runs NEW's sync, so the lock and both workflow files name NEW.

#### Scenario: A newer release of Lunamill

- **WHEN** `lunamill update` finds a release of Lunamill newer than the lock names
- **THEN** it prints `Lunamill OLD → NEW` and runs NEW's sync, so the lock and both workflow files name NEW.

### Requirement: A preset's newest commit

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset's newest commit

- **WHEN** `lunamill update` runs in a repository that follows presets
- **THEN** For each preset, it compares the preset's files, its `lunamill-preset.yaml` and the `agents/` and `skills/` beside it, at its pinned commit and at the newest commit of its repository's default branch. Where they differ it moves the pin and prints `NAME OLD → NEW`, each seven characters; where they do not, it prints `NAME is at its newest commit, COMMIT.` and leaves the pin.

### Requirement: What lunamill update prints last

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What lunamill update prints last

- **WHEN** `lunamill update` ends
- **THEN** It ends `✓ Wrote N files. Commit them on a branch and open a pull request.`, adding ` and deleted M` after `files` when it deleted any; and `1 file` for one. With nothing to do it prints `✓ Nothing to update: lunamill is VERSION, the newest release`, then `.` with no preset, `, and NAME is at its newest commit.` with one, `, and both presets are at their newest commits.` with two, and `, and all N presets ...` with more. It exits 0. In Lunamill's own repository it moves presets only, and with no settings file it prints `.claude/lunamill.yaml is missing. Run: lunamill init` and exits 1, unless the checkout has `.github/workflows/lunamill-poller.yml`, where it does what `org-poller` says.

### Requirement: One pull request for each update

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: One pull request for each update

- **WHEN** `lunamill update --pull-requests` runs
- **THEN** `lunamill update --pull-requests` opens one pull request for Lunamill and one for each preset repository with a moved pin, which moves every such preset of that repository to its newest commit, on the branch and with the title, description, and lines "`lunamill update`" shows. A preset's description is what `lunamill preset changes` prints. Lunamill's lists each file the sync changed but the lock, as `rewritten`, `new`, or `deleted`.

### Requirement: An update already opened

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An update already opened

- **WHEN** a pull request with an update's branch exists
- **THEN** It opens none where a pull request with that update's branch exists, open, closed, or merged, and prints the `is still open` or `was closed` line for it. A newer one for the same thing closes the older open one, with a comment naming it.

### Requirement: A preset repository that cannot be read

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset repository that cannot be read

- **WHEN** `lunamill update` cannot read a preset's repository
- **THEN** A preset repository it cannot read gets the `?` line. The rest go on, and it exits 0.

### Requirement: The Updates job

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The Updates job

- **WHEN** the Updates job runs
- **THEN** The Updates job runs it at 01:00, 13:00, and 19:00 UTC and by hand, with a token of the App's where the App's key and `LUNAMILL_APP_CLIENT_ID` reach the run, and with the build token otherwise, and its commits are named and signed as a build's are: under the App, the committer is the App's bot and nothing is signed. With neither it looks for nothing, prints the line under "With a part off", and passes.

### Requirement: Doctor's line for Lunamill

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Doctor's line for Lunamill

- **WHEN** `lunamill doctor` runs
- **THEN** `lunamill doctor` prints Lunamill's line as "`lunamill doctor`" shows: ✓ with the newest release, `?` when a newer one is released, and `? The lunamill VERSION. The newest release could not be read: ` and the last line of the code host's error.

### Requirement: Update refuses a commit whose preset is not valid

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Update refuses a commit whose preset is not valid

- **WHEN** the commit `lunamill update` would move a preset to has a fault "Preset check refuses a value that is not valid", "A preset in the older version", or "A preset's file that is not YAML" describes, or one only a preset has
- **THEN** it prints `NAME: ` and the same words after its `NAME OLD → NEW` lines and exits 1 with no stack trace, and the lock is as it was, for every preset it would have moved.

### Requirement: An update refused under pull requests

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An update refused under pull requests

- **WHEN** that happens under `--pull-requests`
- **THEN** it opens no pull request for that update and exits 1. Those it opened before it stay.

### Requirement: What update reads and opens

Lunamill SHALL behave as this line says: When `lunamill update` looks for a newer release, it reads the newest release of `lunamill-ai/lunamill`, prints `Lunamill OLD → NEW`, and a pull request it opens comes from the branch `lunamill-update/lunamill-NEW` and is titled "Update Lunamill to NEW".

#### Scenario: What update reads and opens

- **WHEN** `lunamill update` looks for a newer release
- **THEN** it reads the newest release of `lunamill-ai/lunamill`, prints `Lunamill OLD → NEW`, and a pull request it opens comes from the branch `lunamill-update/lunamill-NEW` and is titled "Update Lunamill to NEW".
