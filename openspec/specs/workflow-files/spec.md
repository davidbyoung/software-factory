# workflow-files Specification

## Purpose

The two workflow files `factory sync` writes into a repository, `.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`: what they hold, the version of the factory's own workflows they call, and when each job runs.

## Requirements

### Requirement: The two workflow files

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The two workflow files

- **WHEN** `factory sync` runs
- **THEN** it writes `.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`, whatever the settings, as "What the pull request holds" shows them, with the line `run-credential` adds under each file's `secrets`: `app-key: ${{ secrets.FACTORY_APP_PRIVATE_KEY }}`. It writes no other workflow and nothing under `.github/actions/`. It overwrites today's `factory-review.yml`, and deletes the ten other `factory-*.yml` files and `.github/actions/factory-agent/` that the lock lists.

### Requirement: The version each file calls

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The version each file calls

- **WHEN** `factory sync` writes the two workflow files
- **THEN** Each file's one job calls `davidbyoung/software-factory/.github/workflows/run.yml` or `review.yml` at `@v` and the version the lock names, and `factory sync --check` fails when either names another.

### Requirement: The factory's own repository

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The factory's own repository

- **WHEN** `factory sync` writes the two workflow files in the factory's own repository
- **THEN** In the factory's own repository the two call `./.github/workflows/run.yml` and `./.github/workflows/review.yml`, and each job installs the factory from the checkout.

### Requirement: What the files hold from the settings

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What the files hold from the settings

- **WHEN** `factory sync` fills in the two workflow files from the settings
- **THEN** The files hold, from the settings: the default branch in the push trigger; the poller's `cron` line, written as today's, only when `builds.trigger` is `github-action` and the lock records no preset whose repository runs the poller; which of `review`, `board`, `auto-merge`, `poller`, and `dependabot` are on, by the settings "The jobs" names for each, `poller` being off with such a preset; each session's minutes; the `verdict-override` label's name; and the names of the secrets `.npmrc` and the ticket system read.

### Requirement: Each job's events and condition

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Each job's events and condition

- **WHEN** an event, a schedule, or a run by hand starts a job in "The jobs"
- **THEN** Each job in "The jobs" runs on the events, schedule, and condition its row gives, except that a job that starts a session is the three jobs `cloud-run` says, and that the review is a job of `run.yml` on `pull_request_target`. A job with no session uses a token of the App's in place of the build, board, or auto-merge token where the App's key and `FACTORY_APP_CLIENT_ID` reach the run. `run.yml` has one more job, "Require the verdict", which runs `factory enroll` on a push to the default branch while `review` is on.

### Requirement: A job whose part is off

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A job whose part is off

- **WHEN** a job's row names one of those five, and that part is off
- **THEN** A job whose row names one of those five is skipped, and starts no runner, when it is off. Every other condition in that column is checked by the job itself.

### Requirement: Starting a job through factory.yml

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Starting a job through factory.yml

- **WHEN** `factory build N`, the poller, or a command that starts the board sync starts its job
- **THEN** `factory build N`, the poller, and the commands that start the board sync start their job through `factory.yml`. `factory build N` prints its run's link as today.

### Requirement: Installing the repository's own dependencies

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Installing the repository's own dependencies

- **WHEN** a job that runs a session starts
- **THEN** A job that runs a session, the review's among them, runs `npm ci` in its copy of the default branch only when that copy's root has a `package-lock.json`, and takes Node's version from its `package.json` when that sets `engines.node`, and 22 otherwise. `commands.build-setup` runs after, as today.

### Requirement: The check on every pull request

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The check on every pull request

- **WHEN** a pull request is opened or pushed to, or the default branch is pushed to
- **THEN** `factory sync --check` and `factory config check` run on every pull request under `pull_request`, and on a push to the default branch. On a pull request the first is `factory sync --check --against BASE`, the base commit, whose lock line 40 compares with. "Factory files in step" holds no key. The pin of a private preset is checked by the review's Prepare, which refuses a pull request whose lock does not match its preset.

### Requirement: A preset whose repository runs the poller

The factory SHALL behave as this line says: When `builds.trigger` is `github-action` and a preset the repository follows is recorded as running the poller, `factory sync` writes no poller schedule and leaves `poller` out of `parts`, `factory doctor` prints the `factory-poller.yml is enabled in` line for that repository after the line for its own workflow, and the flag on a ticket that has not started reads `not started, is the poller in OWNER/NAME running?`

#### Scenario: A preset whose repository runs the poller

- **WHEN** `builds.trigger` is `github-action` and a preset the repository follows is recorded as running the poller
- **THEN** `factory sync` writes no poller schedule and leaves `poller` out of `parts`, `factory doctor` prints the `factory-poller.yml is enabled in` line for that repository after the line for its own workflow, and the flag on a ticket that has not started reads `not started, is the poller in OWNER/NAME running?`

### Requirement: The job that tells the others

The factory SHALL behave as this line says: When `run.yml` runs on `pull_request_target` opened, reopened, or closed for a pull request from this repository whose body holds `Part of `, the job "Tell the other repositories" runs. No session and no pull request's code is in it.

#### Scenario: The job that tells the others

- **WHEN** `run.yml` runs on `pull_request_target` opened, reopened, or closed for a pull request from this repository whose body holds `Part of `
- **THEN** the job "Tell the other repositories" runs. No session and no pull request's code is in it.

### Requirement: The order job

The factory SHALL behave as this line says: When `factory.yml` is run by hand with the job `order` and a pull request's number as `pr`, the job "Record the verdict" posts both statuses for it.

#### Scenario: The order job

- **WHEN** `factory.yml` is run by hand with the job `order` and a pull request's number as `pr`
- **THEN** the job "Record the verdict" posts both statuses for it.

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

### Requirement: The job that opens the ticked tickets

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The job that opens the ticked tickets

- **WHEN** a pull request from this repository merges with a list in its description, whether or not a box is ticked
- **THEN** `run.yml`'s job "Open the ticked tickets" runs `factory pr follow-ups --event` with the event's file, and the board's sync for that event waits for it. On any other event, and for any other pull request, the job is skipped.
