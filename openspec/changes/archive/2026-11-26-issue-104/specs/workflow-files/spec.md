## MODIFIED Requirements

### Requirement: What the files hold from the settings

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What the files hold from the settings

- **WHEN** `factory sync` fills in the two workflow files from the settings
- **THEN** The files hold, from the settings: the default branch in the push trigger; the poller's `cron` line, written as today's, only when `builds.trigger` is `github-action` and the lock records no preset whose repository runs the poller; which of `review`, `board`, `auto-merge`, `poller`, `dependabot`, and `approval-policies` are on, by the settings "The jobs" names for each, `poller` being off with such a preset, and `approval-policies` on when the settings have a policy not turned off; each session's minutes; the `verdict-override` and `policy-override` labels' names; and the names of the secrets `.npmrc` and the ticket system read. With approval policies on, `factory.yml` also starts on a pull request's `edited` event, for a change of its base.

## ADDED Requirements

### Requirement: Approval policies' jobs when off

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Approval policies' jobs when off

- **WHEN** approval policies are off
- **THEN** their jobs are skipped and start no runner.
