# workflow-files Specification

## Purpose

The two workflow files `lunamill sync` writes into a repository, `.github/workflows/lunamill.yml` and `.github/workflows/lunamill-review.yml`: what they hold, the version of Lunamill's own workflows they call, and when each job runs.

## Requirements

### Requirement: The two workflow files

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The two workflow files

- **WHEN** `lunamill sync` runs
- **THEN** it writes `.github/workflows/lunamill.yml` and `.github/workflows/lunamill-review.yml`, whatever the settings, as "What the pull request holds" shows them, with the line `run-credential` adds under each file's `secrets`: `app-key: ${{ secrets.LUNAMILL_APP_PRIVATE_KEY }}`. It writes no other workflow and nothing under `.github/actions/`. It overwrites today's `lunamill-review.yml`, and deletes the ten other `lunamill-*.yml` files and `.github/actions/factory-agent/` that the lock lists.

### Requirement: The version each file calls

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The version each file calls

- **WHEN** `lunamill sync` writes the two workflow files
- **THEN** Each file's one job calls `lunamill-ai/lunamill/.github/workflows/run.yml` or `review.yml` at `@v` and the version the lock names, and `lunamill sync --check` fails when either names another.

### Requirement: Lunamill's own repository

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Lunamill's own repository

- **WHEN** `lunamill sync` writes the two workflow files in Lunamill's own repository
- **THEN** In Lunamill's own repository the two call `./.github/workflows/run.yml` and `./.github/workflows/review.yml`, and each job installs Lunamill from the checkout.

### Requirement: What the files hold from the settings

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What the files hold from the settings

- **WHEN** `lunamill sync` fills in the two workflow files from the settings
- **THEN** The files hold, from the settings: the default branch in the push trigger; the poller's `cron` line, written as today's, only when `builds.trigger` is `github-action` and the lock records no preset whose repository runs the poller; which of `review`, `board`, `auto-merge`, `poller`, `dependabot`, and `approval-policies` are on, by the settings "The jobs" names for each, `poller` being off with such a preset, and `approval-policies` on when the settings have a policy not turned off; each session's minutes; the `verdict-override` and `policy-override` labels' names; and the names of the secrets `.npmrc` and the ticket system read. With the review, auto-merge, or approval policies on, `lunamill.yml` also starts on a pull request's `edited` event, for a change of its base.

### Requirement: Each job's events and condition

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Each job's events and condition

- **WHEN** an event, a schedule, or a run by hand starts a job in "The jobs"
- **THEN** Each job in "The jobs" runs on the events, schedule, and condition its row gives, except that a job that starts a session is the three jobs `cloud-run` says, and that the review is a job of `run.yml` on `pull_request_target`. A job with no session uses a token of the App's in place of the build, board, or auto-merge token where the App's key and `LUNAMILL_APP_CLIENT_ID` reach the run.

### Requirement: A job whose part is off

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A job whose part is off

- **WHEN** a job's row names one of those five, and that part is off
- **THEN** A job whose row names one of those five is skipped, and starts no runner, when it is off. Every other condition in that column is checked by the job itself.

### Requirement: Starting a job through lunamill.yml

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Starting a job through lunamill.yml

- **WHEN** `lunamill build N`, the poller, or a command that starts the board sync starts its job
- **THEN** `lunamill build N`, the poller, and the commands that start the board sync start their job through `lunamill.yml`. `lunamill build N` prints its run's link as today.

### Requirement: Installing the repository's own dependencies

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Installing the repository's own dependencies

- **WHEN** a job that runs a session starts
- **THEN** A job that runs a session, the review's among them, runs `npm ci` in its copy of the default branch only when that copy's root has a `package-lock.json`, and takes Node's version from its `package.json` when that sets `engines.node`, and 22 otherwise. `commands.build-setup` runs after, as today.

### Requirement: The check on every pull request

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The check on every pull request

- **WHEN** a pull request is opened or pushed to, or the default branch is pushed to
- **THEN** `lunamill sync --check` and `lunamill config check` run on every pull request under `pull_request`, and on a push to the default branch. On a pull request the first is `lunamill sync --check --against BASE`, the base commit, whose lock line 40 compares with. "Lunamill files in step" holds no key. The pin of a private preset is checked by the review's Prepare, which refuses a pull request whose lock does not match its preset.

### Requirement: A preset whose repository runs the poller

Lunamill SHALL behave as this line says: When `builds.trigger` is `github-action` and a preset the repository follows is recorded as running the poller, `lunamill sync` writes no poller schedule and leaves `poller` out of `parts`, `lunamill doctor` prints the `lunamill-poller.yml is enabled in` line for that repository after the line for its own workflow, and the flag on a ticket that has not started reads `not started, is the poller in OWNER/NAME running?`

#### Scenario: A preset whose repository runs the poller

- **WHEN** `builds.trigger` is `github-action` and a preset the repository follows is recorded as running the poller
- **THEN** `lunamill sync` writes no poller schedule and leaves `poller` out of `parts`, `lunamill doctor` prints the `lunamill-poller.yml is enabled in` line for that repository after the line for its own workflow, and the flag on a ticket that has not started reads `not started, is the poller in OWNER/NAME running?`

### Requirement: The job that tells the others

Lunamill SHALL behave as this line says: When `run.yml` runs on `pull_request_target` opened, reopened, or closed for a pull request from this repository whose body holds `Part of `, the job "Tell the other repositories" runs. No session and no pull request's code is in it.

#### Scenario: The job that tells the others

- **WHEN** `run.yml` runs on `pull_request_target` opened, reopened, or closed for a pull request from this repository whose body holds `Part of `
- **THEN** the job "Tell the other repositories" runs. No session and no pull request's code is in it.

### Requirement: The order job

Lunamill SHALL behave as this line says: When `lunamill.yml` is run by hand with the job `order` and a pull request's number as `pr`, the job "Record the verdict" posts both statuses for it.

#### Scenario: The order job

- **WHEN** `lunamill.yml` is run by hand with the job `order` and a pull request's number as `pr`
- **THEN** the job "Record the verdict" posts both statuses for it.

### Requirement: lunamill.yml switched off by GitHub

Lunamill SHALL behave as this line says: When a pull request is opened, reopened, pushed to, or marked ready, and GitHub gives `disabled_inactivity` as the state of `lunamill.yml`, "Lunamill files in step" fails with the error `GitHub switched lunamill.yml off after 60 days with no activity, so nothing posts "Review verdict" here. Enable it on the Actions tab, or run: gh workflow enable lunamill.yml. Then push a commit to this pull request.`

#### Scenario: lunamill.yml switched off by GitHub

- **WHEN** a pull request is opened, reopened, pushed to, or marked ready, and GitHub gives `disabled_inactivity` as the state of `lunamill.yml`
- **THEN** "Lunamill files in step" fails with the error `GitHub switched lunamill.yml off after 60 days with no activity, so nothing posts "Review verdict" here. Enable it on the Actions tab, or run: gh workflow enable lunamill.yml. Then push a commit to this pull request.`

### Requirement: lunamill.yml disabled by hand

Lunamill SHALL behave as this line says: When GitHub gives any other state that starts with `disabled_`, except `disabled_fork`, the check fails with the error `lunamill.yml is disabled, so nothing posts "Review verdict" here. Enable it on the Actions tab, or run: gh workflow enable lunamill.yml. Then push a commit to this pull request.`

#### Scenario: lunamill.yml disabled by hand

- **WHEN** GitHub gives any other state that starts with `disabled_`, except `disabled_fork`
- **THEN** the check fails with the error `lunamill.yml is disabled, so nothing posts "Review verdict" here. Enable it on the Actions tab, or run: gh workflow enable lunamill.yml. Then push a commit to this pull request.`

### Requirement: lunamill.yml off in a fork

Lunamill SHALL behave as this line says: When GitHub gives `disabled_fork`, the check's step passes and prints `lunamill.yml is off in this fork`.

#### Scenario: lunamill.yml off in a fork

- **WHEN** GitHub gives `disabled_fork`
- **THEN** the check's step passes and prints `lunamill.yml is off in this fork`.

### Requirement: lunamill.yml enabled

Lunamill SHALL behave as this line says: When GitHub gives `active`, the step passes and prints `lunamill.yml is enabled`.

#### Scenario: lunamill.yml enabled

- **WHEN** GitHub gives `active`
- **THEN** the step passes and prints `lunamill.yml is enabled`.

### Requirement: lunamill.yml not on the default branch yet

Lunamill SHALL behave as this line says: When GitHub answers 404, the step passes and prints `lunamill.yml is not on the default branch yet`.

#### Scenario: lunamill.yml not on the default branch yet

- **WHEN** GitHub answers 404
- **THEN** the step passes and prints `lunamill.yml is not on the default branch yet`.

### Requirement: The state of lunamill.yml not read

Lunamill SHALL behave as this line says: When GitHub gives no state for any other reason, the step passes with the warning `Could not tell whether lunamill.yml is enabled: REASON`, where REASON is the last line the GitHub CLI printed as its error, without the `gh: ` it starts with.

#### Scenario: The state of lunamill.yml not read

- **WHEN** GitHub gives no state for any other reason
- **THEN** the step passes with the warning `Could not tell whether lunamill.yml is enabled: REASON`, where REASON is the last line the GitHub CLI printed as its error, without the `gh: ` it starts with.

### Requirement: A state of lunamill.yml not known

Lunamill SHALL behave as this line says: When GitHub gives a state none of the lines above names, the step passes with the warning `Could not tell whether lunamill.yml is enabled: its state is STATE`.

#### Scenario: A state of lunamill.yml not known

- **WHEN** GitHub gives a state none of the lines above names
- **THEN** the step passes with the warning `Could not tell whether lunamill.yml is enabled: its state is STATE`.

### Requirement: The check of lunamill.yml after a failed step

Lunamill SHALL behave as this line says: When an earlier step of "Lunamill files in step" failed, the step that checks `lunamill.yml` still runs.

#### Scenario: The check of lunamill.yml after a failed step

- **WHEN** an earlier step of "Lunamill files in step" failed
- **THEN** the step that checks `lunamill.yml` still runs.

### Requirement: The job that opens the ticked tickets

Lunamill SHALL behave as this line says: When a pull request from this repository merges with a list in its description, whether or not a box is ticked, the Tickets group's job "Open the ticked tickets" runs `lunamill pr follow-ups --event` with the event's file, and the board's sync for that event waits for it. On any other event, and for any other pull request, the job is skipped.

#### Scenario: The job that opens the ticked tickets

- **WHEN** a pull request from this repository merges with a list in its description, whether or not a box is ticked
- **THEN** The Tickets group's job "Open the ticked tickets" runs `lunamill pr follow-ups --event` with the event's file, and the board's sync for that event waits for it. On any other event, and for any other pull request, the job is skipped.

### Requirement: Approval policies' jobs when off

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Approval policies' jobs when off

- **WHEN** approval policies are off
- **THEN** their jobs are skipped and start no runner.

### Requirement: The jobs of run.yml and its groups

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The jobs of run.yml and its groups

- **WHEN** `run.yml` runs
- **THEN** Its own jobs are Review, Answer, and Approve what an approval policy found, and three calls, each of a workflow file in Lunamill's repository that holds that group's jobs: Pull request holds Record the verdict, Read the change for the approval policies, Run the approval policies' commands, Run an approval policy's agent, Post the approval policies' status, Classify risk, and Enable auto-merge; Tickets holds Tell the other repositories, Open the ticked tickets, and Sync the board; and Default branch holds Lunamill files in step, Require the verdict, Build, Find the conflicts, Conflict, Find the dependency pull requests, Dependency, Open the updates' pull requests, Start the Ready tickets, and Unknown job.

### Requirement: A job in a group starts as before

Lunamill SHALL behave as this line says: When an event, a schedule, or a run by hand starts `run.yml`, each job in a group starts on exactly the events, schedules, and conditions "Each job's events and condition" gives it, as a job of `run.yml`'s own does.

#### Scenario: A job in a group starts as before

- **WHEN** an event, a schedule, or a run by hand starts `run.yml`
- **THEN** Each job in a group starts on exactly the events, schedules, and conditions "Each job's events and condition" gives it, as a job of `run.yml`'s own does.

### Requirement: A group with nothing to start

Lunamill SHALL behave as this line says: When no job of a group would start on an event, the group's call is skipped, and the checks list shows it as one skipped row named `lunamill / GROUP`: on a push to a pull request, Tickets and Default branch; on a review submitted, all three.

#### Scenario: A group with nothing to start

- **WHEN** no job of a group would start on an event
- **THEN** The group's call is skipped, and the checks list shows it as one skipped row named `lunamill / GROUP`: on a push to a pull request, Tickets and Default branch; on a review submitted, all three.

### Requirement: The rows of a group's jobs

Lunamill SHALL behave as this line says: When a group's call runs, each of its jobs' rows is `lunamill / GROUP / JOB`, with JOB the job's own name, unchanged by the group, such as `lunamill / Pull request / Record the verdict`, and a build's rows are `lunamill / Default branch / Build / Prepare`, `Session`, and `Publish`. Review's and Answer's rows stay `lunamill / Review / ...` and `lunamill / Answer / ...`.

#### Scenario: The rows of a group's jobs

- **WHEN** a group's call runs
- **THEN** Each of its jobs' rows is `lunamill / GROUP / JOB`, with JOB the job's own name, unchanged by the group, such as `lunamill / Pull request / Record the verdict`, and a build's rows are `lunamill / Default branch / Build / Prepare`, `Session`, and `Publish`. Review's and Answer's rows stay `lunamill / Review / ...` and `lunamill / Answer / ...`.

### Requirement: What a group is given

Lunamill SHALL behave as this line says: When a group is called, it is passed only the secrets its jobs read, and its call grants only the permissions its jobs declare, none beyond what `lunamill.yml` grants.

#### Scenario: What a group is given

- **WHEN** a group is called
- **THEN** It is passed only the secrets its jobs read, and its call grants only the permissions its jobs declare, none beyond what `lunamill.yml` grants.

### Requirement: The job that requires the verdict

Lunamill SHALL behave as this line says: When a push reaches the default branch while `review` is on, the Default branch group's job "Require the verdict" runs `lunamill enroll`.

#### Scenario: The job that requires the verdict

- **WHEN** a push reaches the default branch while `review` is on
- **THEN** The Default branch group's job "Require the verdict" runs `lunamill enroll`.

### Requirement: The workflow files

Lunamill SHALL behave as this line says: When `lunamill sync` writes the workflow files, they are `.github/workflows/lunamill.yml`, titled `Lunamill` with the job id `lunamill`, and `.github/workflows/lunamill-review.yml`, titled `Lunamill review`. Each calls `lunamill-ai/lunamill/.github/workflows/FILE@vVERSION` and passes the secrets and variables whose names start `LUNAMILL_` in place of `FACTORY_`. `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY` keep their names.

#### Scenario: The workflow files

- **WHEN** `lunamill sync` writes the workflow files
- **THEN** they are `.github/workflows/lunamill.yml`, titled `Lunamill` with the job id `lunamill`, and `.github/workflows/lunamill-review.yml`, titled `Lunamill review`. Each calls `lunamill-ai/lunamill/.github/workflows/FILE@vVERSION` and passes the secrets and variables whose names start `LUNAMILL_` in place of `FACTORY_`. `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY` keep their names.

### Requirement: The checks' names

Lunamill SHALL behave as this line says: When a pull request's checks run, the job "Factory files in step" is named "Lunamill files in step", so its check reads `review / Lunamill files in step`, and each check of a group starts `lunamill /`, as in `lunamill / Pull request / Record the verdict`.

#### Scenario: The checks' names

- **WHEN** a pull request's checks run
- **THEN** the job "Factory files in step" is named "Lunamill files in step", so its check reads `review / Lunamill files in step`, and each check of a group starts `lunamill /`, as in `lunamill / Pull request / Record the verdict`.

### Requirement: The workflows' own variables

Lunamill SHALL behave as this line says: When a workflow sets an environment variable for Lunamill itself, its name starts `LUNAMILL_`.

#### Scenario: The workflows' own variables

- **WHEN** a workflow sets an environment variable for Lunamill itself
- **THEN** its name starts `LUNAMILL_`.

### Requirement: The organization's poller file

Lunamill SHALL behave as this line says: When `lunamill init --org` writes an organization's poller, its file is `.github/workflows/lunamill-poller.yml`.

#### Scenario: The organization's poller file

- **WHEN** `lunamill init --org` writes an organization's poller
- **THEN** its file is `.github/workflows/lunamill-poller.yml`.
