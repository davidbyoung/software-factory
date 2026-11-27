## ADDED Requirements

### Requirement: The jobs of run.yml and its groups

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The jobs of run.yml and its groups

- **WHEN** `run.yml` runs
- **THEN** Its own jobs are Review, Answer, and Approve what an approval policy found, and three calls, each of a workflow file in the factory's repository that holds that group's jobs: Pull request holds Record the verdict, Read the change for the approval policies, Run the approval policies' commands, Run an approval policy's agent, Post the approval policies' status, Classify risk, and Enable auto-merge; Tickets holds Tell the other repositories, Open the ticked tickets, and Sync the board; and Default branch holds Factory files in step, Require the verdict, Build, Find the conflicts, Conflict, Find the dependency pull requests, Dependency, Open the updates' pull requests, Start the Ready tickets, and Unknown job.

### Requirement: A job in a group starts as before

The factory SHALL behave as this line says: When an event, a schedule, or a run by hand starts `run.yml`, each job in a group starts on exactly the events, schedules, and conditions "Each job's events and condition" gives it, as a job of `run.yml`'s own does.

#### Scenario: A job in a group starts as before

- **WHEN** an event, a schedule, or a run by hand starts `run.yml`
- **THEN** Each job in a group starts on exactly the events, schedules, and conditions "Each job's events and condition" gives it, as a job of `run.yml`'s own does.

### Requirement: A group with nothing to start

The factory SHALL behave as this line says: When no job of a group would start on an event, the group's call is skipped, and the checks list shows it as one skipped row named `factory / GROUP`: on a push to a pull request, Tickets and Default branch; on a review submitted, all three.

#### Scenario: A group with nothing to start

- **WHEN** no job of a group would start on an event
- **THEN** The group's call is skipped, and the checks list shows it as one skipped row named `factory / GROUP`: on a push to a pull request, Tickets and Default branch; on a review submitted, all three.

### Requirement: The rows of a group's jobs

The factory SHALL behave as this line says: When a group's call runs, each of its jobs' rows is `factory / GROUP / JOB`, with JOB the job's own name, unchanged by the group, such as `factory / Pull request / Record the verdict`, and a build's rows are `factory / Default branch / Build / Prepare`, `Session`, and `Publish`. Review's and Answer's rows stay `factory / Review / ...` and `factory / Answer / ...`.

#### Scenario: The rows of a group's jobs

- **WHEN** a group's call runs
- **THEN** Each of its jobs' rows is `factory / GROUP / JOB`, with JOB the job's own name, unchanged by the group, such as `factory / Pull request / Record the verdict`, and a build's rows are `factory / Default branch / Build / Prepare`, `Session`, and `Publish`. Review's and Answer's rows stay `factory / Review / ...` and `factory / Answer / ...`.

### Requirement: What a group is given

The factory SHALL behave as this line says: When a group is called, it is passed only the secrets its jobs read, and its call grants only the permissions its jobs declare, none beyond what `factory.yml` grants.

#### Scenario: What a group is given

- **WHEN** a group is called
- **THEN** It is passed only the secrets its jobs read, and its call grants only the permissions its jobs declare, none beyond what `factory.yml` grants.

### Requirement: The job that requires the verdict

The factory SHALL behave as this line says: When a push reaches the default branch while `review` is on, the Default branch group's job "Require the verdict" runs `factory enroll`.

#### Scenario: The job that requires the verdict

- **WHEN** a push reaches the default branch while `review` is on
- **THEN** The Default branch group's job "Require the verdict" runs `factory enroll`.

## MODIFIED Requirements

### Requirement: Each job's events and condition

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Each job's events and condition

- **WHEN** an event, a schedule, or a run by hand starts a job in "The jobs"
- **THEN** Each job in "The jobs" runs on the events, schedule, and condition its row gives, except that a job that starts a session is the three jobs `cloud-run` says, and that the review is a job of `run.yml` on `pull_request_target`. A job with no session uses a token of the App's in place of the build, board, or auto-merge token where the App's key and `FACTORY_APP_CLIENT_ID` reach the run.

### Requirement: The job that opens the ticked tickets

The factory SHALL behave as this line says: When a pull request from this repository merges with a list in its description, whether or not a box is ticked, the Tickets group's job "Open the ticked tickets" runs `factory pr follow-ups --event` with the event's file, and the board's sync for that event waits for it. On any other event, and for any other pull request, the job is skipped.

#### Scenario: The job that opens the ticked tickets

- **WHEN** a pull request from this repository merges with a list in its description, whether or not a box is ticked
- **THEN** The Tickets group's job "Open the ticked tickets" runs `factory pr follow-ups --event` with the event's file, and the board's sync for that event waits for it. On any other event, and for any other pull request, the job is skipped.
