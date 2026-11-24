## ADDED Requirements

### Requirement: Preparing a build

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Preparing a build

- **WHEN** a build's Prepare runs
- **THEN** `factory session prepare build N` claims the ticket, then stops it with the reason when it has no Spec or Acceptance criteria section and no `follow-up` label, or waits on a comment round. It makes the branch-name and earlier-branch checks of `factory-build` and deletes a merged branch.

### Requirement: What is handed over

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What is handed over

- **WHEN** Prepare hands a session what it may read
- **THEN** It hands over the ticket, the tickets it names, its blockers, the follow-ups ticket, the presets the lock names, and, for a pull request, its threads, comments, reviews, check results, and the logs of failed ones. Comments in the review's own format are handed over only when the review's run posted them.

### Requirement: A pull request Prepare refuses

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A pull request Prepare refuses

- **WHEN** a run is for a pull request
- **THEN** For a pull request, the base must be the default branch and the head in this repository; otherwise it refuses. A pull request from a fork starts no run, and its verdict keeps waiting, as today.
