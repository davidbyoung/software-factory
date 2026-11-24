# publish Specification

## Purpose

What the last job of a run in the cloud checks, refuses, and does on the code host for the session.

## Requirements

### Requirement: Running nothing

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Running nothing

- **WHEN** Publish reads what a session left
- **THEN** `factory session publish` never checks out or runs anything from the bundle, and reads git with hooks and the machine's git settings off.

### Requirement: A bundle it refuses

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A bundle it refuses

- **WHEN** Publish checks a bundle
- **THEN** It refuses a bundle that is not one branch, does not start from the commit Prepare handed over, or adds a commit with a symbolic link, a submodule, a change under `.github/workflows/`, or a merge of anything but the default branch; and one whose `.github/workflows/` differs from its merge base with the default branch. It prints and comments the "Not pushed" lines.

### Requirement: What it pushes

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What it pushes

- **WHEN** Publish pushes
- **THEN** It pushes only this run's branch, forward only, and never the default branch.

### Requirement: The pull request it opens

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The pull request it opens

- **WHEN** a build asked for a pull request
- **THEN** It opens at most one pull request: a draft, into the default branch, that closes only this run's ticket, with the title cut to 200 characters and the body to 20,000.

### Requirement: Marking ready

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Marking ready

- **WHEN** CI has finished on what Publish pushed
- **THEN** It marks the pull request ready only when every check finished on its newest commit and none failed. One opened with `factory pr open --draft` stays a draft for its owner to mark ready.

### Requirement: What it may be asked

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What it may be asked

- **WHEN** a session asked for writes
- **THEN** It replies to and resolves only threads of this run's pull request, and comments on, edits, stops, or ends only this run's ticket and pull request. It also adds a line to the follow-ups ticket, opens a ticket from a Conflict or a Dependency run, and asks for the review again. When the session did not finish and left no commits, it says so there, with the run's address.

### Requirement: Markers

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Markers

- **WHEN** Publish posts what a session wrote
- **THEN** Everything it posts carries the agent's mark, and any other marker of the factory's in it is removed, except the one the request itself is for.

### Requirement: What it never does

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What it never does

- **WHEN** a session asks for something else
- **THEN** It merges, approves, tags, releases, and starts nothing on request. A request it does not know is refused and named in the run's log.

### Requirement: Its token

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Its token

- **WHEN** Publish waits for CI
- **THEN** It makes its token after waiting for CI, again when an hour has passed.
