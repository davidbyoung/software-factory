# parts-off Specification

## Purpose

What lunamill's jobs and commands do in a repository with a part off: the review's verdict and the commands that wait for a review when the automated review is off, and a job that would run a session when no build token is set.

## Requirements

### Requirement: The verdict with the review off

lunamill SHALL behave as this line says: When `pr-review` is not set, the "Review verdict" status lunamill posts on any pull request but Dependabot's, whatever its draft state and labels, is a success that reads `The automated review is off`.

#### Scenario: The verdict with the review off

- **WHEN** `pr-review` is not set
- **THEN** the "Review verdict" status lunamill posts on any pull request but Dependabot's, whatever its draft state and labels, is a success that reads `The automated review is off`.

### Requirement: No review expected with the review off

lunamill SHALL behave as this line says: When `pr-review` is not set, `lunamill pr state N` prints `Claude review: none expected on this head`, and `lunamill pr state N --wait` and `lunamill pr watch N` wait for no review.

#### Scenario: No review expected with the review off

- **WHEN** `pr-review` is not set
- **THEN** `lunamill pr state N` prints `Claude review: none expected on this head`, and `lunamill pr state N --wait` and `lunamill pr watch N` wait for no review.

### Requirement: Work is checked before the token

lunamill SHALL behave as this line says: When a job would run a session, it checks for work first, with the workflow's own token.

#### Scenario: Work is checked before the token

- **WHEN** a job would run a session
- **THEN** it checks for work first, with the workflow's own token.

### Requirement: Work and no token

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Work and no token

- **WHEN** there is work and neither a build token nor the App's key with `LUNAMILL_APP_CLIENT_ID`, or no Claude credential
- **THEN** a run started by a push, a schedule, or a review someone submitted prints what it found, then `, and no build token is set, so no session ran. Builds in the cloud are off: lunamill init turns them on.`, with `no Claude credential` for the token when that is what is missing, and passes. What it found is `N pull requests conflict`, `A review on #N waits for an answer`, or `N Dependabot pull requests are open`, each in the singular for one. A run started by hand or by the poller fails with today's message, and so does the automated review.
