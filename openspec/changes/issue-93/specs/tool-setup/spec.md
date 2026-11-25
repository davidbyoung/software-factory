## ADDED Requirements

### Requirement: A disabled factory.yml

The factory SHALL behave as this line says: When `factory.yml` is disabled on GitHub Actions, `factory doctor` fails with `factory.yml is disabled` and the fix `Enable it on the Actions tab, or run: gh workflow enable factory.yml`, whatever `builds.trigger` is.

#### Scenario: A disabled factory.yml

- **WHEN** `factory.yml` is disabled on GitHub Actions
- **THEN** `factory doctor` fails with `factory.yml is disabled` and the fix `Enable it on the Actions tab, or run: gh workflow enable factory.yml`, whatever `builds.trigger` is.

### Requirement: An enabled factory.yml

The factory SHALL behave as this line says: When `factory.yml` is enabled on GitHub Actions, `factory doctor` prints `✓ factory.yml is enabled`, whatever `builds.trigger` is.

#### Scenario: An enabled factory.yml

- **WHEN** `factory.yml` is enabled on GitHub Actions
- **THEN** `factory doctor` prints `✓ factory.yml is enabled`, whatever `builds.trigger` is.

### Requirement: A factory.yml not on the default branch yet

The factory SHALL behave as this line says: When `factory.yml` is not on the default branch, `factory doctor` prints `- factory.yml is not on the default branch yet`, whatever `builds.trigger` is, and fails nothing for it.

#### Scenario: A factory.yml not on the default branch yet

- **WHEN** `factory.yml` is not on the default branch
- **THEN** `factory doctor` prints `- factory.yml is not on the default branch yet`, whatever `builds.trigger` is, and fails nothing for it.

### Requirement: A factory.yml whose state cannot be read

The factory SHALL behave as this line says: When the state of `factory.yml` cannot be read, `factory doctor` prints `? Could not tell whether factory.yml is enabled: REASON`, fails nothing for it, and prints its other checks. REASON is the error in GitHub's words, as doctor's other "Could not tell" lines about the repository give it, such as `Bad Gateway (HTTP 502)`.

#### Scenario: A factory.yml whose state cannot be read

- **WHEN** the state of `factory.yml` cannot be read
- **THEN** `factory doctor` prints `? Could not tell whether factory.yml is enabled: REASON`, fails nothing for it, and prints its other checks. REASON is the error in GitHub's words, as doctor's other "Could not tell" lines about the repository give it, such as `Bad Gateway (HTTP 502)`.

### Requirement: A disabled workflow of a preset's poller

The factory SHALL behave as this line says: When a preset's repository, OWNER/NAME, runs the poller and its workflow is disabled, `factory doctor` fails with `factory-poller.yml is disabled in OWNER/NAME` and the fix `Enable it on the Actions tab of OWNER/NAME`.

#### Scenario: A disabled workflow of a preset's poller

- **WHEN** a preset's repository, OWNER/NAME, runs the poller and its workflow is disabled
- **THEN** `factory doctor` fails with `factory-poller.yml is disabled in OWNER/NAME` and the fix `Enable it on the Actions tab of OWNER/NAME`.

### Requirement: A preset's poller not on the default branch

The factory SHALL behave as this line says: When a preset's repository, OWNER/NAME, runs the poller and `factory-poller.yml` is not on its default branch, `factory doctor` fails with `factory-poller.yml is not on the default branch of OWNER/NAME` and the fix `An owner of OWNER runs factory init --org again`.

#### Scenario: A preset's poller not on the default branch

- **WHEN** a preset's repository, OWNER/NAME, runs the poller and `factory-poller.yml` is not on its default branch
- **THEN** `factory doctor` fails with `factory-poller.yml is not on the default branch of OWNER/NAME` and the fix `An owner of OWNER runs factory init --org again`.

## MODIFIED Requirements

### Requirement: Doctor is unchanged with today's tools

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Doctor is unchanged with today's tools

- **WHEN** `factory doctor` runs with today's tools
- **THEN** `factory doctor` prints the same checks as before this change with today's tools, sorted and worded as lines 20 to 25 and 33 say, and three lines #74 adds. With `pr-review` set, it says whether "Review verdict" is required, and what CI's own token may do, under the code host's name, as their own requirements word them. Where a preset's repository runs the poller, `factory doctor` prints that repository's `factory-poller.yml` line under the runner's name, after the line for `factory.yml`.

## REMOVED Requirements

### Requirement: A disabled poller workflow

**Reason**: `factory doctor` checks `factory.yml` whatever `builds.trigger` is. "A disabled factory.yml", "An enabled factory.yml", "A factory.yml whose state cannot be read", and "A disabled workflow of a preset's poller" replace this one.

**Migration**: None.

### Requirement: A poller workflow not yet pushed

**Reason**: the line for a `factory.yml` not on the default branch yet no longer waits on `builds.trigger`. "A factory.yml not on the default branch yet" and "A preset's poller not on the default branch" replace this one. `init`'s own checks still pass before the setup's pull request merges.

**Migration**: None.
