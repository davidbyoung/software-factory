# org-poller Specification

## Purpose

The one poller for an organization's board: `kodor poller --once --preset FILE`, kodor's `poller.yml` that runs it from the organization's `kodor-config` repository, how a new release reaches that repository's `kodor-poller.yml`, and the check of its schedule.

## Requirements

### Requirement: A pass from a preset

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A pass from a preset

- **WHEN** `kodor poller --once --preset FILE` runs
- **THEN** it reads the ticket system, the board, the columns, the labels, and `builds.max-per-hour` from FILE, takes the board's owner from `GITHUB_REPOSITORY`, and reads the board once. For each repository with a ticket in the ready column it makes today's pass for that repository: the same tickets, order, blockers, hourly cap for that repository, start note, and comment when a build cannot start, as in a repository with no `kodor.yml` or one the App is not installed on.

### Requirement: kodor's poller.yml

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: kodor's poller.yml

- **WHEN** a workflow file that calls `poller.yml` runs on its poller's schedule
- **THEN** `poller.yml`, in kodor's repository, runs line 16's command for `kodor-preset.yaml` on the schedule of the file that calls it, with a token of the App's for every repository of the installation. Two passes never overlap.

### Requirement: A new release reaches kodor-poller.yml

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A new release reaches kodor-poller.yml

- **WHEN** `poller.yml` runs on its `0 1 * * *` schedule or by hand
- **THEN** On its `0 1 * * *` schedule and by hand, `poller.yml` runs `kodor update --pull-requests`, which in a checkout with `.github/workflows/kodor-poller.yml` and no `.claude/kodor.yaml` does only this: when that file names a release older than the newest, it opens one pull request that rewrites the version after `poller.yml@v`, with the branch, title, description, and `is still open` and `was closed` lines an update of kodor has today. `kodor update` there prints `kodor OLD → NEW` and rewrites the file.

### Requirement: The cron line and the interval

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The cron line and the interval

- **WHEN** `kodor preset check` runs where `.github/workflows/kodor-poller.yml` is beside a preset
- **THEN** `kodor preset check` fails when the first `cron` line of `.github/workflows/kodor-poller.yml` beside a preset is not the one `builds.poll-minutes` gives: `✗ .github/workflows/kodor-poller.yml runs on "*/5 * * * *", and builds.poll-minutes is 30. Write "*/30 * * * *" there.`

### Requirement: A repository that sets its own trigger

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A repository that sets its own trigger

- **WHEN** `kodor poller --once --preset FILE` comes to a repository with a ticket in the ready column
- **THEN** before that repository's pass it reads the repository's `.claude/kodor.yaml` on its default branch and, when the file sets no `builds.trigger` of its own, its `.claude/kodor.lock` there, whose settings in effect give the trigger from the presets it pins, with the choices where two disagree, else `manual`. When the trigger is a value other than `github-action`, it starts none of the repository's tickets and logs `OWNER/NAME: builds.trigger is VALUE there, so its tickets are left`, with no warning mark. A repository is polled, and gets today's comment when its build cannot start, when its settings file is missing or cannot be read, or when the file sets no trigger and its lock is missing, cannot be read, records no settings, or does not pin a preset the file lists.

### Requirement: The poller reads a preset that leaves settings out

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The poller reads a preset that leaves settings out

- **WHEN** `kodor poller --once --preset FILE` reads a preset "A preset that leaves out the board" to "Part of site, or of coverage" describe
- **THEN** it does not refuse it for what is left out.

### Requirement: The poller words a fault as the check does

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The poller words a fault as the check does

- **WHEN** FILE has any other fault "Preset check refuses a value that is not valid", "A preset in the older version", or "A preset's file that is not YAML" describes, or one only a preset has
- **THEN** a pass prints after the time the first line `kodor preset check` prints for it, without that line's advice after a fault only a preset has, and exits 1.

### Requirement: An interval the poller cannot run on

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An interval the poller cannot run on

- **WHEN** the preset's `builds.poll-minutes` is not one of the values allowed
- **THEN** `kodor preset check` prints the message "Preset check refuses a value that is not valid" gives for it and no line about `.github/workflows/kodor-poller.yml`.
