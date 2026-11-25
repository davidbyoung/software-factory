# workspace Specification

## Purpose

`factory workspace`: the clones of a ticket's other repositories on a machine, and what a session in the cloud has in their place.

## Requirements

### Requirement: Cloning the others

The factory SHALL behave as this line says: When `factory workspace N` runs on a machine, for a ticket that names other repositories, in a checkout of one of them, each of the others is cloned from its default branch to `~/.local/share/software-factory/work/OWNER/NAME-NUMBER/REPOSITORY`, where NAME and NUMBER are the ticket's. Each is on the branch `factory ticket branch` names there, and one already cloned is left as it is.

#### Scenario: Cloning the others

- **WHEN** `factory workspace N` runs on a machine, for a ticket that names other repositories, in a checkout of one of them
- **THEN** each of the others is cloned from its default branch to `~/.local/share/software-factory/work/OWNER/NAME-NUMBER/REPOSITORY`, where NAME and NUMBER are the ticket's. Each is on the branch `factory ticket branch` names there, and one already cloned is left as it is.

### Requirement: What workspace prints

The factory SHALL behave as this line says: When it has, it prints `#12 workspace`, one line for each repository in merge order, `✓`, its name, `branch` and the branch of line 28, and its folder, with `, this checkout` after the session's own, and last `Read first: ` and the path of each clone's `CLAUDE.md` that exists.

#### Scenario: What workspace prints

- **WHEN** it has
- **THEN** it prints `#12 workspace`, one line for each repository in merge order, `✓`, its name, `branch` and the branch of line 28, and its folder, with `, this checkout` after the session's own, and last `Read first: ` and the path of each clone's `CLAUDE.md` that exists.

### Requirement: A clone that fails

The factory SHALL behave as this line says: When a clone fails, its line is `✗` with git's last line, and it exits 1 with the others cloned.

#### Scenario: A clone that fails

- **WHEN** a clone fails
- **THEN** its line is `✗` with git's last line, and it exits 1 with the others cloned.

### Requirement: No other repository

The factory SHALL behave as this line says: When the ticket names no other repository, it prints `#12 has one repository: nothing to clone.` and exits 0.

#### Scenario: No other repository

- **WHEN** the ticket names no other repository
- **THEN** it prints `#12 has one repository: nothing to clone.` and exits 0.

### Requirement: Removing the clones

The factory SHALL behave as this line says: When `factory workspace N --remove` runs, it deletes each clone with nothing uncommitted and no commit that is not on its remote, then the ticket's folder when it is empty, and prints `✓ Removed acme/web` for each.

#### Scenario: Removing the clones

- **WHEN** `factory workspace N --remove` runs
- **THEN** it deletes each clone with nothing uncommitted and no commit that is not on its remote, then the ticket's folder when it is empty, and prints `✓ Removed acme/web` for each.

### Requirement: A clone with work to lose

The factory SHALL behave as this line says: When a clone has work to lose, it keeps it, prints `✗ acme/web   2 commits are not pushed: FOLDER`, `1 commit is not pushed` for one, or `uncommitted changes: FOLDER`, and exits 1.

#### Scenario: A clone with work to lose

- **WHEN** a clone has work to lose
- **THEN** it keeps it, prints `✗ acme/web   2 commits are not pushed: FOLDER`, `1 commit is not pushed` for one, or `uncommitted changes: FOLDER`, and exits 1.

### Requirement: The claim and the clock in a clone

The factory SHALL behave as this line says: When `factory ticket still-live N`, `stop`, `cost`, `factory pr cost`, or a reviewer's note runs in a clone, it uses the claim and the cost clock of the checkout `factory workspace` ran in, so what a session spent is counted once.

#### Scenario: The claim and the clock in a clone

- **WHEN** `factory ticket still-live N`, `stop`, `cost`, `factory pr cost`, or a reviewer's note runs in a clone
- **THEN** it uses the claim and the cost clock of the checkout `factory workspace` ran in, so what a session spent is counted once.

### Requirement: The folder a session may edit

The factory SHALL behave as this line says: When `factory sync` writes `.claude/settings.json`, `permissions.additionalDirectories` holds `~/.local/share/software-factory/work`, beside any other entry.

#### Scenario: The folder a session may edit

- **WHEN** `factory sync` writes `.claude/settings.json`
- **THEN** `permissions.additionalDirectories` holds `~/.local/share/software-factory/work`, beside any other entry.

### Requirement: A clone left behind

The factory SHALL behave as this line says: When `factory status` runs and a clone is left for a ticket that is finished, it prints `? acme/web is still cloned for acme/api#12: FOLDER. Run: factory workspace acme/api#12 --remove`.

#### Scenario: A clone left behind

- **WHEN** `factory status` runs and a clone is left for a ticket that is finished
- **THEN** it prints `? acme/web is still cloned for acme/api#12: FOLDER. Run: factory workspace acme/api#12 --remove`.

### Requirement: Workspace in the cloud

The factory SHALL behave as this line says: When it runs in a cloud session, it clones nothing and prints the run's own repository as `✓` with its branch and `/work, this run's`, and each other as `-` with its pull request, or `no pull request yet`, and its folder and `to read only`.

#### Scenario: Workspace in the cloud

- **WHEN** it runs in a cloud session
- **THEN** it clones nothing and prints the run's own repository as `✓` with its branch and `/work, this run's`, and each other as `-` with its pull request, or `no pull request yet`, and its folder and `to read only`.
