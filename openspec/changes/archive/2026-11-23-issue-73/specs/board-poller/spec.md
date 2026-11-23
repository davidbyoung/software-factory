## MODIFIED Requirements

### Requirement: The scheduled workflow is written

The factory SHALL behave as this line says: When `factory sync` runs with `builds.trigger: github-action`, it writes the poller's `cron` line into `.github/workflows/factory.yml`, whose poller job runs `factory poller --once` every `builds.poll-minutes` minutes and can be run by hand.

#### Scenario: The scheduled workflow is written

- **WHEN** `factory sync` runs with `builds.trigger: github-action`
- **THEN** it writes the poller's `cron` line into `.github/workflows/factory.yml`, whose poller job runs `factory poller --once` every `builds.poll-minutes` minutes and can be run by hand.

### Requirement: The scheduled workflow is deleted

The factory SHALL behave as this line says: When `factory sync` runs with any other trigger, it writes no `cron` line for the poller into `.github/workflows/factory.yml`, and the poller's job is off.

#### Scenario: The scheduled workflow is deleted

- **WHEN** `factory sync` runs with any other trigger
- **THEN** it writes no `cron` line for the poller into `.github/workflows/factory.yml`, and the poller's job is off.
