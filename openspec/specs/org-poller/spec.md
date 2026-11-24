# org-poller Specification

## Purpose

The one poller for an organization's board: `factory poller --once --preset FILE`, the factory's `poller.yml` that runs it from the organization's `factory-config` repository, how a new release reaches that repository's `factory-poller.yml`, and the check of its schedule.

## Requirements

### Requirement: A pass from a preset

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A pass from a preset

- **WHEN** `factory poller --once --preset FILE` runs
- **THEN** it reads the ticket system, the board, the columns, the labels, and `builds.max-per-hour` from FILE, takes the board's owner from `GITHUB_REPOSITORY`, and reads the board once. For each repository with a ticket in the ready column it makes today's pass for that repository: the same tickets, order, blockers, hourly cap for that repository, start note, and comment when a build cannot start, as in a repository with no `factory.yml` or one the App is not installed on.

### Requirement: The factory's poller.yml

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The factory's poller.yml

- **WHEN** a workflow file that calls `poller.yml` runs on its poller's schedule
- **THEN** `poller.yml`, in the factory's repository, runs line 16's command for `factory-preset.yaml` on the schedule of the file that calls it, with a token of the App's for every repository of the installation. Two passes never overlap.

### Requirement: A new release reaches factory-poller.yml

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A new release reaches factory-poller.yml

- **WHEN** `poller.yml` runs on its `0 1 * * *` schedule or by hand
- **THEN** On its `0 1 * * *` schedule and by hand, `poller.yml` runs `factory update --pull-requests`, which in a checkout with `.github/workflows/factory-poller.yml` and no `.claude/factory.yaml` does only this: when that file names a release older than the newest, it opens one pull request that rewrites the version after `poller.yml@v`, with the branch, title, description, and `is still open` and `was closed` lines an update of the factory has today. `factory update` there prints `The factory OLD → NEW` and rewrites the file.

### Requirement: The cron line and the interval

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The cron line and the interval

- **WHEN** `factory preset check` runs where `.github/workflows/factory-poller.yml` is beside a preset
- **THEN** `factory preset check` fails when the first `cron` line of `.github/workflows/factory-poller.yml` beside a preset is not the one `builds.poll-minutes` gives: `✗ .github/workflows/factory-poller.yml runs on "*/5 * * * *", and builds.poll-minutes is 30. Write "*/30 * * * *" there.`

### Requirement: A repository that sets its own trigger

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A repository that sets its own trigger

- **WHEN** `factory poller --once --preset FILE` comes to a repository with a ticket in the ready column
- **THEN** before that repository's pass it reads the repository's `.claude/factory.yaml` on its default branch. When the file itself sets `builds.trigger` to a value other than `github-action`, it starts none of the repository's tickets and logs `OWNER/NAME: builds.trigger is VALUE there, so its tickets are left`, with no warning mark. Only the file's own key is read, not its presets: a file that does not set the key is polled, and so is a repository whose file is missing or cannot be read, which gets today's comment when its build cannot start.
