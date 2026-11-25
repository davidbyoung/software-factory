# review-verdict Specification

## Purpose

How a review run gives its verdict, and what may pass "Review verdict" without one.

## Requirements

### Requirement: The review's answer

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The review's answer

- **WHEN** a review's session has ended
- **THEN** The review run's structured answer is a verdict, findings with a file, a line, a severity, and a body, and a summary. Publish opens a thread for each finding on a line of the change, puts any other in the summary comment, and posts the status on the commit Prepare named, and on no other.

### Requirement: When the status passes

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: When the status passes

- **WHEN** Publish posts "Review verdict"
- **THEN** The status is a success only when the answer says so and it names no finding to fix. A run that fails or is canceled leaves it a failure, as today.

### Requirement: No comment changes it

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: No comment changes it

- **WHEN** someone comments on the pull request, or adds the override label
- **THEN** No comment, whoever posted it, changes the verdict. The override label counts only when the code host says an approver added it, whatever event is being handled.

### Requirement: Dependabot's pass

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Dependabot's pass

- **WHEN** Dependabot opened the pull request
- **THEN** Dependabot's pass is given only when the code host verifies every commit of the pull request as Dependabot's. A pull request of Dependabot's that someone else has pushed to is reviewed.

### Requirement: Waiting on merge order

The factory SHALL behave as this line says: When "Review verdict" would be a success, with an override or with the review off too, and "Merge order" is pending, it is pending with "Merge order"'s words.

#### Scenario: Waiting on merge order

- **WHEN** "Review verdict" would be a success, with an override or with the review off too, and "Merge order" is pending
- **THEN** it is pending with "Merge order"'s words.
