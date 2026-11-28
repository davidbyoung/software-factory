# setup-pull-request Specification

## Purpose

The pull request `lunamill init` opens: the check of the checkout before it asks, its plan's rows, the gate it runs, the branch, the commit, and the pull request, what it prints when one fails, and when "Review verdict" becomes required.

## Requirements

### Requirement: A checkout ahead of the default branch

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A checkout ahead of the default branch

- **WHEN** the repository is settled, by lines 27 to 29 and their question
- **THEN** Once the repository is settled, by lines 27 to 29 and their question, and before any other question, `lunamill init` fetches the default branch from that repository's remote, and stops with the line "the rest" shows when the commit checked out has commits that branch lacks, whatever branch it is on. A checkout at or behind it goes on.

### Requirement: The plan's rows

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The plan's rows

- **WHEN** `lunamill init` prints its plan
- **THEN** Its plan's rows are lowercase labels: `settings`, `files`, and `workflows`, as the draft shows, in place of a row for each file; today's other rows; and `pull request` last.

### Requirement: The gate runs before the commit

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The gate runs before the commit

- **WHEN** the answer to "Go ahead?" is yes, and the sync is done
- **THEN** After "Go ahead?" and the sync, it runs each `commands.gate` command and prints `✓ COMMANDS pass here.`, or the lines "the rest" shows with the last five lines of the failing command's output, and then commits nothing and exits 1. With no gate it runs none.

### Requirement: The branch, the commit, and the pull request

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The branch, the commit, and the pull request

- **WHEN** `lunamill init` commits what it and the sync changed
- **THEN** It makes the branch `set-up-lunamill`, or `set-up-lunamill-2` and so on when that name is taken here or on the remote, from the commit checked out. It commits only the files it and the sync wrote or deleted, by their paths, so anything else changed or staged stays as it was. It pushes the branch to the repository's remote, and opens a pull request into the default branch that is not a draft. The title is "Set up lunamill" when the default branch has no settings file, and "Change lunamill's settings" otherwise, and the description is the plan's rows.

### Requirement: After the pull request opens

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: After the pull request opens

- **WHEN** the pull request is open
- **THEN** It prints `✓ Opened REPOSITORY#N, "TITLE".`, then `Merge it to finish. Nothing else is left to do.`, or `Merge it to finish.` and today's "Left to do" list without its commit line. With `pr-review` set, that list gains `Once it merges, an admin of REPOSITORY runs lunamill init, to require "Review verdict"` when no run could: in an organization's repository with no `lunamill` property, and in a person's with no build token. It leaves the checkout on the new branch.

### Requirement: A commit, a push, or a pull request that fails

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A commit, a push, or a pull request that fails

- **WHEN** the commit, the push, or the pull request fails
- **THEN** A commit that fails prints `✗ Could not commit: ` and git's last line, then `The files are written, and nothing is committed.` A push that fails, and a pull request that will not open, each print their two lines as "the rest" shows. Each exits 1.

### Requirement: No file changed

lunamill SHALL behave as this line says: When no file changed, it opens nothing and prints `Nothing to commit: the files already match.`

#### Scenario: No file changed

- **WHEN** no file changed
- **THEN** it opens nothing and prints `Nothing to commit: the files already match.`

### Requirement: When init makes the rule

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: When init makes the rule

- **WHEN** `lunamill init` comes to the rule that requires "Review verdict"
- **THEN** `lunamill init` makes the rule that requires "Review verdict" only when the default branch has `.github/workflows/lunamill.yml`. Otherwise its plan row ends `, once this pull request merges`.

### Requirement: Doctor says whether Review verdict is required

lunamill SHALL behave as the scenarios below say, the first in the Spec line's own words.

#### Scenario: Doctor says whether Review verdict is required

- **WHEN** `lunamill doctor` runs with `pr-review` set
- **THEN** With `pr-review` set, `lunamill doctor` prints the ✓ or ✗ line "the rest" shows, from the rules the code host applies to the default branch, the organization's among them, or `? Could not tell whether "Review verdict" is required: ` and the reason.

#### Scenario: The setup's pull request has not merged yet

- **WHEN** `lunamill doctor` runs with `pr-review` set, "Review verdict" is not required, and the default branch does not have `.github/workflows/lunamill.yml` yet
- **THEN** it prints `- "Review verdict" is not required yet: the rule is made once the setup's pull request merges`, which fails nothing, so the checks `lunamill init` ends with do not fail a setup that has just opened its pull request.

#### Scenario: What fixes a rule that is missing

- **WHEN** the default branch has `.github/workflows/lunamill.yml`, or the runner cannot say whether it does, and "Review verdict" is still not required
- **THEN** the ✗ line ends `. Run lunamill init` where the repository's owner defines no `lunamill` property, and `. The next push to BRANCH sets it, or an owner of ORG sets lunamill to "on" for this repository` where the owner defines the property and the repository's value is not `on`.
