## MODIFIED Requirements

### Requirement: A preset's part the plan keeps from working

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset's part the plan keeps from working

- **WHEN** the plan withholds the secrets and a preset turns on a board, the review, or builds that start from the board that the repository's own secrets do not meet
- **THEN** `factory init` prints, after a blank line, `✗ The presets turn on PARTS. They need ORG's secrets, and PLAN does not share them with a private repository.`, `Make ORG/REPO public, or move ORG to a paid plan. Then run factory init again.`, `What PLAN leaves out:`, the address of "On GitHub's Free plan" in `docs/integrations/github-organizations.md` at the installed release on an indented line of its own, and `Nothing changed.`, and exits 1. A plan withholds the secrets when the repository is private and its organization's plan is known to share none with a private repository, and the organization is set up but not for this repository. A part is met by the repository's own secrets when every secret it reads is stored on the repository: for builds that start from the board, those of the board and of builds in the cloud too.

### Requirement: The stop where the secrets do not reach

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The stop where the secrets do not reach

- **WHEN** the `Organization` row reads `ORG, set up, but its secrets do not reach this repository: GitHub Free shares them only with public repositories, or an owner narrowed them`, and a preset turns on a board, the review, or builds that start from the board that is not met
- **THEN** `factory init` prints, after a blank line, `✗ The presets turn on PARTS. They need ORG's secrets, and those do not reach ORG/REPO.`, `An owner of ORG gives ORG/REPO access to each of these, under "Repository access". Then run factory init again.`, the lines "What the stop lists" says, `If one is not listed there, the owner runs this first:`, `factory init --org ADDRESS` on a line of its own indented five spaces, `The steps in full:`, the address of "When the organization's secrets do not reach you" in `docs/integrations/github-organizations.md` at the installed release, indented the same, and `Nothing changed.`, and exits 1. The secrets that reach the repository are its own, and those its organization shares with it unless the plan withholds them. A `FACTORY_APP_PRIVATE_KEY` the organization shares counts only where the organization's variable `FACTORY_APP_CLIENT_ID` is shared with the repository too. A part is met when every secret it reads reaches the repository: for builds that start from the board, those of the board and of builds in the cloud too.
