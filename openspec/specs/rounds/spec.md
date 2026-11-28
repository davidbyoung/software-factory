# rounds Specification

## Purpose

Which run starts next on a pull request, and when a person is waited for.

## Requirements

### Requirement: The next answer

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The next answer

- **WHEN** CI failed, or the review asked for changes
- **THEN** When CI fails after Publish pushed, or the review asks for changes, Publish starts an answer run for that pull request when a build in the cloud opened it, up to `rules.review-rounds` reviews that asked for changes and four answers in all, counted from the runner's runs for that pull request. At the limit it comments what is open, and starts none.

### Requirement: A person's review

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A person's review

- **WHEN** a person reviews a pull request
- **THEN** A person's review on a pull request from this repository, as today, starts an answer run, by today's event.

### Requirement: Conflicts and Dependabot's pull requests

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Conflicts and Dependabot's pull requests

- **WHEN** the default branch is pushed to, or a schedule fires
- **THEN** A push to the default branch, and the nightly schedule, start one conflict run for each pull request that conflicts. Each open Dependabot pull request starts one dependency run on today's schedule. A pull request has one conflict run, and one dependency run, at a time. A conflict run whose pull request no longer conflicts, or was stopped on, when its turn comes starts no session.
