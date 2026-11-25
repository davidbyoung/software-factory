## ADDED Requirements

### Requirement: A preset's part the plan keeps from working

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset's part the plan keeps from working

- **WHEN** the plan withholds the secrets and a preset turns on a board, the review, or builds that start from the board that the repository's own secrets do not meet
- **THEN** `factory init` prints, after a blank line, `✗ The presets turn on PARTS. They need ORG's secrets, and PLAN does not share them with a private repository.`, `Make ORG/REPO public, or move ORG to a paid plan. Then run factory init again.`, `What PLAN leaves out:`, the address of "On GitHub's Free plan" in `docs/github/setup.md` at the installed release on an indented line of its own, and `Nothing changed.`, and exits 1. A plan withholds the secrets when the repository is private and its organization's plan is known to share none with a private repository, and the organization is set up but not for this repository. A part is met by the repository's own secrets when every secret it reads is stored on the repository: for builds that start from the board, those of the board and of builds in the cloud too.

### Requirement: The parts the stop names

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The parts the stop names

- **WHEN** `factory init` stops because a preset turns on parts the plan keeps from working
- **THEN** PARTS names only the parts that are not met, in the words and order of the `Parts` row: `a board`, `the review`, and `builds that start from the board`.

### Requirement: What the stop leaves undone

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What the stop leaves undone

- **WHEN** `factory init` stops for a preset's part
- **THEN** It has asked nothing after the question about presets, prints no `From the presets, so not asked` block, writes no file, makes no commit, and stores nothing.

### Requirement: The repository's own secrets meet the parts

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The repository's own secrets meet the parts

- **WHEN** the repository's own secrets meet each part a preset turns on
- **THEN** `factory init` goes on as today.

### Requirement: However the presets are named

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: However the presets are named

- **WHEN** the presets come from the repository's own settings or from `--preset`
- **THEN** It stops as it does for presets checked in the list.

### Requirement: A part the repository's own settings turn on

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A part the repository's own settings turn on

- **WHEN** a part is turned on by the repository's own settings, and not by a preset
- **THEN** The stop does not count it.

### Requirement: The repository's secrets that cannot be listed

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The repository's secrets that cannot be listed

- **WHEN** the repository's own secrets cannot be listed
- **THEN** That stop is not made.

### Requirement: The line on what stays off under the plan

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The line on what stays off under the plan

- **WHEN** the plan withholds the secrets, `factory init` goes on, and the repository stores no credential of the coding agent's, or its own secrets cannot be listed
- **THEN** It prints `Builds on your machine work now. The review and builds in the cloud stay off until ORG/REPO is public or ORG is on a paid plan.`, after the question about presets when there is one, in place of the line that ends `until ORG is set up.`

### Requirement: No line on what stays off with a credential stored

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: No line on what stays off with a credential stored

- **WHEN** the plan withholds the secrets and `factory init` does not stop for a preset's part, and the repository does store a credential of the coding agent's
- **THEN** Neither of those two lines is printed.

### Requirement: The plan's second sign

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The plan's second sign

- **WHEN** GitHub answers for the organization and the answer holds no plan, and GitHub refuses to list the rules of a private repository's default branch because of the plan
- **THEN** The plan counts as GitHub Free, for `factory init` and `factory doctor`.

### Requirement: A plan that withholds nothing

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A plan that withholds nothing

- **WHEN** the plan is shown and is not GitHub Free, or GitHub does not answer for the organization, or no plan is shown and the rules are listed or refused for another reason
- **THEN** The plan withholds nothing, as today.

## MODIFIED Requirements

### Requirement: An organization that is not set up here

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An organization that is not set up here

- **WHEN** the `Organization` row is not `set up`
- **THEN** Otherwise the row is one of the two "the rest" shows, by whether `ORG/factory-config` exists, with the two lines after it, except that when the plan withholds the secrets, the `Organization` row reads `ORG, set up, but its secrets do not reach this repository: PLAN shares them only with public repositories`, in place of the row that names GitHub Free or an owner who narrowed them, which shows where the plan is not known to withhold them. It asks for no GitHub token, and each part that reads one is left off, or `factory init` stops, as "A preset's part the plan keeps from working" says.
