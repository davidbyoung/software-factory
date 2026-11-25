## MODIFIED Requirements

### Requirement: What it may be asked

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What it may be asked

- **WHEN** a session asked for writes
- **THEN** It replies to and resolves only threads of this run's pull request, and comments on, edits, stops, or ends only this run's ticket and pull request. It also lists a follow-up in the pull request this run opened or answers, as `factory follow-up` does, every box unticked, and refuses one from a build that opened none, or from a review, naming it in the run's log. It opens a ticket from a Conflict or a Dependency run, and asks for the review again. When what the session left did not arrive, when a build left nothing, or when the session did not finish and left no commits, it says so there, with the run's address.

### Requirement: A bundle it refuses

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A bundle it refuses

- **WHEN** Publish checks a bundle
- **THEN** It refuses a bundle that is not one branch, does not start from the commit Prepare handed over, or adds a commit with a symbolic link, a submodule, a change under `.github/workflows/`, or a merge of anything but the default branch; and one whose `.github/workflows/` differs from its merge base with the default branch. Nor does it push a commit in another's name, or whose message links another ticket in a wording the code host documents; a build that asks for no pull request, one it may not open, or one that links another ticket; or commits for a pull request that is closed or has moved on. Nothing the session asked for is done then but a stop and an end, and a conflict's is marked as stopped. It prints and comments the "Not pushed" lines, each as one short line with no marker of the session's.
