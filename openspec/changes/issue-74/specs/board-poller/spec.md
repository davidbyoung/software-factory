## MODIFIED Requirements

### Requirement: What a pass reads

The factory SHALL behave as this line says: When `factory poller --once` runs without `--preset`, it reads the repository, `tickets.board`, and the Ready column from `.claude/factory.yaml`, and the token from `FACTORY_BOARD_TOKEN`. With `--preset FILE` it reads the board and the Ready column from FILE and the board's owner from `GITHUB_REPOSITORY`, as `org-poller` says, and the token the same way.

#### Scenario: What a pass reads

- **WHEN** `factory poller --once` runs without `--preset`
- **THEN** it reads the repository, `tickets.board`, and the Ready column from `.claude/factory.yaml`, and the token from `FACTORY_BOARD_TOKEN`. With `--preset FILE` it reads the board and the Ready column from FILE and the board's owner from `GITHUB_REPOSITORY`, as `org-poller` says, and the token the same way.

### Requirement: A pass that cannot read

The factory SHALL behave as this line says: When `factory poller --once` cannot read the board or the tickets, it prints why and exits 1, so the scheduled run shows as failed. With `--preset FILE`, only a board it cannot read does so: a repository whose tickets it cannot read is logged under the repository's name, as a warning in a workflow's run, and fails nothing.

#### Scenario: A pass that cannot read

- **WHEN** `factory poller --once` cannot read the board or the tickets
- **THEN** it prints why and exits 1, so the scheduled run shows as failed. With `--preset FILE`, only a board it cannot read does so: a repository whose tickets it cannot read is logged under the repository's name, as a warning in a workflow's run, and fails nothing.

### Requirement: The scheduled workflow is written

The factory SHALL behave as this line says: When `factory sync` runs with `builds.trigger: github-action`, and the lock records no preset whose repository runs the poller, it writes the poller's `cron` line into `.github/workflows/factory.yml`, whose poller job runs `factory poller --once` every `builds.poll-minutes` minutes and can be run by hand. With such a preset it writes no `cron` line for the poller, and the poller's job is off.

#### Scenario: The scheduled workflow is written

- **WHEN** `factory sync` runs with `builds.trigger: github-action`, and the lock records no preset whose repository runs the poller
- **THEN** it writes the poller's `cron` line into `.github/workflows/factory.yml`, whose poller job runs `factory poller --once` every `builds.poll-minutes` minutes and can be run by hand. With such a preset it writes no `cron` line for the poller, and the poller's job is off.
