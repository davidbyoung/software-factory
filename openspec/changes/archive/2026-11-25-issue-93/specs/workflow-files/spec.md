## ADDED Requirements

### Requirement: factory.yml switched off by GitHub

The factory SHALL behave as this line says: When a pull request is opened, reopened, pushed to, or marked ready, and GitHub gives `disabled_inactivity` as the state of `factory.yml`, "Factory files in step" fails with the error `GitHub switched factory.yml off after 60 days with no activity, so nothing posts "Review verdict" here. Enable it on the Actions tab, or run: gh workflow enable factory.yml. Then push a commit to this pull request.`

#### Scenario: factory.yml switched off by GitHub

- **WHEN** a pull request is opened, reopened, pushed to, or marked ready, and GitHub gives `disabled_inactivity` as the state of `factory.yml`
- **THEN** "Factory files in step" fails with the error `GitHub switched factory.yml off after 60 days with no activity, so nothing posts "Review verdict" here. Enable it on the Actions tab, or run: gh workflow enable factory.yml. Then push a commit to this pull request.`

### Requirement: factory.yml disabled by hand

The factory SHALL behave as this line says: When GitHub gives any other state that starts with `disabled_`, except `disabled_fork`, the check fails with the error `factory.yml is disabled, so nothing posts "Review verdict" here. Enable it on the Actions tab, or run: gh workflow enable factory.yml. Then push a commit to this pull request.`

#### Scenario: factory.yml disabled by hand

- **WHEN** GitHub gives any other state that starts with `disabled_`, except `disabled_fork`
- **THEN** the check fails with the error `factory.yml is disabled, so nothing posts "Review verdict" here. Enable it on the Actions tab, or run: gh workflow enable factory.yml. Then push a commit to this pull request.`

### Requirement: factory.yml off in a fork

The factory SHALL behave as this line says: When GitHub gives `disabled_fork`, the check's step passes and prints `factory.yml is off in this fork`.

#### Scenario: factory.yml off in a fork

- **WHEN** GitHub gives `disabled_fork`
- **THEN** the check's step passes and prints `factory.yml is off in this fork`.

### Requirement: factory.yml enabled

The factory SHALL behave as this line says: When GitHub gives `active`, the step passes and prints `factory.yml is enabled`.

#### Scenario: factory.yml enabled

- **WHEN** GitHub gives `active`
- **THEN** the step passes and prints `factory.yml is enabled`.

### Requirement: factory.yml not on the default branch yet

The factory SHALL behave as this line says: When GitHub answers 404, the step passes and prints `factory.yml is not on the default branch yet`.

#### Scenario: factory.yml not on the default branch yet

- **WHEN** GitHub answers 404
- **THEN** the step passes and prints `factory.yml is not on the default branch yet`.

### Requirement: The state of factory.yml not read

The factory SHALL behave as this line says: When GitHub gives no state for any other reason, the step passes with the warning `Could not tell whether factory.yml is enabled: REASON`, where REASON is the last line the GitHub CLI printed as its error, without the `gh: ` it starts with.

#### Scenario: The state of factory.yml not read

- **WHEN** GitHub gives no state for any other reason
- **THEN** the step passes with the warning `Could not tell whether factory.yml is enabled: REASON`, where REASON is the last line the GitHub CLI printed as its error, without the `gh: ` it starts with.

### Requirement: A state of factory.yml not known

The factory SHALL behave as this line says: When GitHub gives a state none of the lines above names, the step passes with the warning `Could not tell whether factory.yml is enabled: its state is STATE`.

#### Scenario: A state of factory.yml not known

- **WHEN** GitHub gives a state none of the lines above names
- **THEN** the step passes with the warning `Could not tell whether factory.yml is enabled: its state is STATE`.

### Requirement: The check of factory.yml after a failed step

The factory SHALL behave as this line says: When an earlier step of "Factory files in step" failed, the step that checks `factory.yml` still runs.

#### Scenario: The check of factory.yml after a failed step

- **WHEN** an earlier step of "Factory files in step" failed
- **THEN** the step that checks `factory.yml` still runs.

## MODIFIED Requirements

### Requirement: A preset whose repository runs the poller

The factory SHALL behave as this line says: When `builds.trigger` is `github-action` and a preset the repository follows is recorded as running the poller, `factory sync` writes no poller schedule and leaves `poller` out of `parts`, `factory doctor` prints the `factory-poller.yml is enabled in` line for that repository after the line for its own workflow, and the flag on a ticket that has not started reads `not started, is the poller in OWNER/NAME running?`

#### Scenario: A preset whose repository runs the poller

- **WHEN** `builds.trigger` is `github-action` and a preset the repository follows is recorded as running the poller
- **THEN** `factory sync` writes no poller schedule and leaves `poller` out of `parts`, `factory doctor` prints the `factory-poller.yml is enabled in` line for that repository after the line for its own workflow, and the flag on a ticket that has not started reads `not started, is the poller in OWNER/NAME running?`
