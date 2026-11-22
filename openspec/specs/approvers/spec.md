# approvers Specification

## Purpose

Whose words a session takes as instructions: an approver, any account the code host says can write to the repository. The commands that keep only an approver's reviews and comments, `factory ticket answers` for a ticket's answers, who may pass the review verdict, and which cost comments count.

## Requirements

### Requirement: An approver's review is pending

The factory SHALL behave as this line says: When `factory pr review-pending N REVIEW` runs for a review whose author is an approver, and its body or one of its line comments lacks the agent mark, it prints `pending` and exits 0, in a repository a person owns and in one an organization owns.

#### Scenario: An approver's review is pending

- **WHEN** `factory pr review-pending N REVIEW` runs for a review whose author is an approver, and its body or one of its line comments lacks the agent mark
- **THEN** it prints `pending` and exits 0, in a repository a person owns and in one an organization owns.

### Requirement: A review that is not an approver's

The factory SHALL behave as this line says: When the review's author is not an approver, `factory pr review-pending N REVIEW` prints `nothing to do: review REVIEW is not an approver's` and exits 1.

#### Scenario: A review that is not an approver's

- **WHEN** the review's author is not an approver
- **THEN** `factory pr review-pending N REVIEW` prints `nothing to do: review REVIEW is not an approver's` and exits 1.

### Requirement: The factory's own reply

The factory SHALL behave as this line says: When the review is an approver's and everything in it carries the agent mark, it prints `nothing to do: review REVIEW is the factory's own reply: nothing of an approver's in it` and exits 1.

#### Scenario: The factory's own reply

- **WHEN** the review is an approver's and everything in it carries the agent mark
- **THEN** it prints `nothing to do: review REVIEW is the factory's own reply: nothing of an approver's in it` and exits 1.

### Requirement: Review-pending cannot ask

The factory SHALL behave as this line says: When `factory pr review-pending` cannot ask whether the author is an approver, it exits 2, as it does for any failed read.

#### Scenario: Review-pending cannot ask

- **WHEN** `factory pr review-pending` cannot ask whether the author is an approver
- **THEN** it exits 2, as it does for any failed read.

### Requirement: Approver review bodies to answer

The factory SHALL behave as this line says: When `factory pr state N` runs, its count line reads `approver review bodies to answer: K`, and lists each review that has a non-empty body without the agent mark, an approver as its author, and a submission time after the last conversation comment that carries the agent mark. As today, a conflict sweep's comment (`<!-- conflict-fix -->`, `conflict-stop`, or `<!-- session-handoff -->`) does not count as that last comment.

#### Scenario: Approver review bodies to answer

- **WHEN** `factory pr state N` runs
- **THEN** its count line reads `approver review bodies to answer: K`, and lists each review that has a non-empty body without the agent mark, an approver as its author, and a submission time after the last conversation comment that carries the agent mark. As today, a conflict sweep's comment (`<!-- conflict-fix -->`, `conflict-stop`, or `<!-- session-handoff -->`) does not count as that last comment.

### Requirement: An approver's turn

The factory SHALL behave as this line says: When an unresolved thread's last comment is an approver's and lacks the agent mark, `factory pr state N` ends that thread's line with `, approver's turn` where it printed `, owner's turn`, whichever approver opened the thread.

#### Scenario: An approver's turn

- **WHEN** an unresolved thread's last comment is an approver's and lacks the agent mark
- **THEN** `factory pr state N` ends that thread's line with `, approver's turn` where it printed `, owner's turn`, whichever approver opened the thread.

### Requirement: Not an approver's in the report

The factory SHALL behave as this line says: When a review or a thread's last comment is from an account that is not an approver, `factory pr state N` does not list it under line 5 or mark it under line 6.

#### Scenario: Not an approver's in the report

- **WHEN** a review or a thread's last comment is from an account that is not an approver
- **THEN** `factory pr state N` does not list it under line 5 or mark it under line 6.

### Requirement: Comments from approvers

The factory SHALL behave as this line says: When `factory pr comments N --from-approvers` runs, it prints only the comments whose author is an approver, those carrying the agent mark included. With `--author` or `--contains` as well, a comment must pass each.

#### Scenario: Comments from approvers

- **WHEN** `factory pr comments N --from-approvers` runs
- **THEN** it prints only the comments whose author is an approver, those carrying the agent mark included. With `--author` or `--contains` as well, a comment must pass each.

### Requirement: State and comments cannot ask

The factory SHALL behave as this line says: When `factory pr state N` or `factory pr comments N --from-approvers` cannot ask whether an author is an approver, it prints the reason on standard error, prints no report and no comments, and exits 1.

#### Scenario: State and comments cannot ask

- **WHEN** `factory pr state N` or `factory pr comments N --from-approvers` cannot ask whether an author is an approver
- **THEN** it prints the reason on standard error, prints no report and no comments, and exits 1.

### Requirement: A ticket's answers

The factory SHALL behave as this line says: When `factory ticket answers N` runs, it prints each comment on N whose author may decide on the ticket and whose body lacks the agent mark, oldest first, each as `factory ticket view N` prints a comment: a line `--- comment ID by AUTHOR at TIME`, then its body. It exits 0.

#### Scenario: A ticket's answers

- **WHEN** `factory ticket answers N` runs
- **THEN** it prints each comment on N whose author may decide on the ticket and whose body lacks the agent mark, oldest first, each as `factory ticket view N` prints a comment: a line `--- comment ID by AUTHOR at TIME`, then its body. It exits 0.

### Requirement: No answers yet

The factory SHALL behave as this line says: When no comment on N passes line 10, `factory ticket answers N` prints `#N has no answers from an approver yet.` and exits 0.

#### Scenario: No answers yet

- **WHEN** no comment on N passes line 10
- **THEN** `factory ticket answers N` prints `#N has no answers from an approver yet.` and exits 0.

### Requirement: Answers cannot ask

The factory SHALL behave as this line says: When `factory ticket answers N` cannot ask whether an author may decide, it prints the reason on standard error, prints nothing on standard output, and exits 1.

#### Scenario: Answers cannot ask

- **WHEN** `factory ticket answers N` cannot ask whether an author may decide
- **THEN** it prints the reason on standard error, prints nothing on standard output, and exits 1.

### Requirement: Answers on a missing ticket

The factory SHALL behave as this line says: When ticket N does not exist, `factory ticket answers N` fails as `factory ticket view N` does.

#### Scenario: Answers on a missing ticket

- **WHEN** ticket N does not exist
- **THEN** `factory ticket answers N` fails as `factory ticket view N` does.

### Requirement: An approver's override

The factory SHALL behave as this line says: When an approver adds the label `code-host.labels.verdict-override` names (by default `verdict-override`), `factory review verdict` posts `Review verdict` as success with the description `Overridden by an approver`, as the requirement "An approver's override" says today for `verdict: override`.

#### Scenario: An approver's override

- **WHEN** an approver adds the label `code-host.labels.verdict-override` names (by default `verdict-override`)
- **THEN** `factory review verdict` posts `Review verdict` as success with the description `Overridden by an approver`, as the requirement "An approver's override" says today for `verdict: override`.

### Requirement: Another approver's override

The factory SHALL behave as this line says: When a push has removed one approver's override and a different approver adds the label, line 14 holds: nothing depends on who added it before.

#### Scenario: Another approver's override

- **WHEN** a push has removed one approver's override and a different approver adds the label
- **THEN** line 14 holds: nothing depends on who added it before.

### Requirement: An override by someone who cannot write

The factory SHALL behave as this line says: When an account that is not an approver adds that label, `factory review verdict` removes it, posts the verdict the review gave, or pending when there is none, and comments ``Removed `NAME`: @LOGIN cannot write to this repository, and only an account that can may pass the verdict.``, where NAME is the configured name.

#### Scenario: An override by someone who cannot write

- **WHEN** an account that is not an approver adds that label
- **THEN** `factory review verdict` removes it, posts the verdict the review gave, or pending when there is none, and comments ``Removed `NAME`: @LOGIN cannot write to this repository, and only an account that can may pass the verdict.``, where NAME is the configured name.

### Requirement: An override that cannot be checked

The factory SHALL behave as this line says: When `factory review verdict` cannot ask whether the account that added that label is an approver, it removes the label, posts the verdict the review gave, comments ``Removed `NAME`: could not check whether @LOGIN can write to this repository. Add the label again to retry.``, and exits 1 with the reason.

#### Scenario: An override that cannot be checked

- **WHEN** `factory review verdict` cannot ask whether the account that added that label is an approver
- **THEN** it removes the label, posts the verdict the review gave, comments ``Removed `NAME`: could not check whether @LOGIN can write to this repository. Add the label again to retry.``, and exits 1 with the reason.

### Requirement: A cost comment counts on the mark

The factory SHALL behave as this line says: When the board sync adds up a ticket's Cost, a cost marker counts when its comment carries the agent mark, whoever posted it, or when its author is the CI review's bot. So a build that acts as an agent account, or runs in an organization's repository, shows its cost.

#### Scenario: A cost comment counts on the mark

- **WHEN** the board sync adds up a ticket's Cost
- **THEN** a cost marker counts when its comment carries the agent mark, whoever posted it, or when its author is the CI review's bot. So a build that acts as an agent account, or runs in an organization's repository, shows its cost.

### Requirement: A cost comment without the mark

The factory SHALL behave as this line says: When a comment has a cost marker and no agent mark, and its author is not the CI review's bot, the marker does not count.

#### Scenario: A cost comment without the mark

- **WHEN** a comment has a cost marker and no agent mark, and its author is not the CI review's bot
- **THEN** the marker does not count.
