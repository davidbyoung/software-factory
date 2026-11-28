# publish Specification

## Purpose

What the last job of a run in the cloud checks, refuses, and does on the code host for the session.

## Requirements

### Requirement: Running nothing

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Running nothing

- **WHEN** Publish reads what a session left
- **THEN** `lunamill session publish` never checks out or runs anything from the bundle, and reads git with hooks and the machine's git settings off.

### Requirement: A bundle it refuses

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A bundle it refuses

- **WHEN** Publish checks a bundle
- **THEN** It refuses a bundle that is not one branch, does not start from the commit Prepare handed over, or adds a commit with a symbolic link, a submodule, a change under `.github/workflows/`, or a merge of anything but the default branch; and one whose `.github/workflows/` differs from its merge base with the default branch. Nor does it push a commit in another's name, or whose message links another ticket in a wording the code host documents; a build that asks for no pull request, one it may not open, or one that links another ticket; or commits for a pull request that is closed or has moved on. Nothing the session asked for is done then but a stop and an end, and a conflict's is marked as stopped. It prints and comments the "Not pushed" lines, each as one short line with no marker of the session's.

### Requirement: What it pushes

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What it pushes

- **WHEN** Publish pushes
- **THEN** It pushes only this run's branch, forward only, and never the default branch.

### Requirement: The pull request it opens

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The pull request it opens

- **WHEN** a build asked for a pull request
- **THEN** It opens at most one pull request: a draft, into the default branch, that closes only this run's ticket, with the title cut to 200 characters and the body to 20,000. It records the run's ticket on it.

### Requirement: Marking ready

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Marking ready

- **WHEN** CI has finished on what Publish pushed
- **THEN** It marks a pull request a build opened ready only when every check finished on its newest commit and none failed. One opened with `lunamill pr open --draft` stays a draft for its owner to mark ready. When no check has started after ten minutes, or CI has not finished after an hour, it says so there. It asks the code host what a build's pull request would close once it is opened and again before it is marked ready, and where that is another ticket it says so and does nothing more with it.

### Requirement: What it may be asked

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What it may be asked

- **WHEN** a session asked for writes
- **THEN** It replies to and resolves only threads of this run's pull request, and comments on, edits, stops, or ends only this run's ticket and pull request. It also lists a follow-up in the pull request this run opened or answers, as `lunamill follow-up` does, every box unticked, and refuses one from a build that opened none, or from any other run, naming it in the run's log. It opens a ticket from a Conflict or a Dependency run, and asks for the review again. When what the session left did not arrive, when a build left nothing, or when the session did not finish and left no commits, it says so there, with the run's address.

### Requirement: Markers

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Markers

- **WHEN** Publish posts what a session wrote
- **THEN** Everything it posts carries the agent's mark, and any other marker of lunamill's in it is removed, except the one the request itself is for.

### Requirement: What it never does

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What it never does

- **WHEN** a session asks for something else
- **THEN** It merges, approves, tags, releases, and starts nothing on request. A request it does not know is refused and named in the run's log.

### Requirement: Its token

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Its token

- **WHEN** Publish waits for CI
- **THEN** It makes its token again every 45 minutes while it waits for CI, and a read that fails is made again.
