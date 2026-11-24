## ADDED Requirements

### Requirement: A preset whose repository runs the poller

The factory SHALL behave as this line says: When `builds.trigger` is `github-action` and a preset the repository follows is recorded so, `factory sync` writes no poller schedule and leaves `poller` out of `parts`, `factory doctor` prints the `factory-poller.yml is enabled in` line for that repository in place of its own workflow's, and the flag on a ticket that has not started reads `not started, is the poller in OWNER/NAME running?`

#### Scenario: A preset whose repository runs the poller

- **WHEN** `builds.trigger` is `github-action` and a preset the repository follows is recorded so
- **THEN** `factory sync` writes no poller schedule and leaves `poller` out of `parts`, `factory doctor` prints the `factory-poller.yml is enabled in` line for that repository in place of its own workflow's, and the flag on a ticket that has not started reads `not started, is the poller in OWNER/NAME running?`

## MODIFIED Requirements

### Requirement: The two workflow files

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The two workflow files

- **WHEN** `factory sync` runs
- **THEN** it writes `.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`, whatever the settings, as "What the pull request holds" shows them, with the line `run-credential` adds under each file's `secrets`: `app-key: ${{ secrets.FACTORY_APP_PRIVATE_KEY }}`. It writes no other workflow and nothing under `.github/actions/`. It overwrites today's `factory-review.yml`, and deletes the ten other `factory-*.yml` files and `.github/actions/factory-agent/` that the lock lists.

### Requirement: What the files hold from the settings

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What the files hold from the settings

- **WHEN** `factory sync` fills in the two workflow files from the settings
- **THEN** The files hold, from the settings: the default branch in the push trigger; the poller's `cron` line, written as today's, only when `builds.trigger` is `github-action` and the lock records no preset whose repository runs the poller; which of `review`, `board`, `auto-merge`, `poller`, and `dependabot` are on, by the settings "The jobs" names for each, `poller` being off with such a preset; each session's minutes; the `verdict-override` label's name; and the names of the secrets `.npmrc` and the ticket system read.

### Requirement: Each job's events and condition

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Each job's events and condition

- **WHEN** an event, a schedule, or a run by hand starts a job in "The jobs"
- **THEN** Each job in "The jobs" runs on the events, schedule, and condition its row gives, with today's steps, permissions, and concurrency, and with the steps `run-credential` adds, which make a token of the App's and use it in place of the build, board, or auto-merge token where the App's key and `FACTORY_APP_CLIENT_ID` reach the run. `run.yml` has one more job, "Require the verdict", which runs `factory enroll` on a push to the default branch while `review` is on.
