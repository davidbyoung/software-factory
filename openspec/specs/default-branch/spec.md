# default-branch Specification

## Purpose

Where the factory takes the default branch's name from, and what the commit guard, session start, `factory sync`, and the commands that name the branch do with it, so nothing assumes it is called `main`.

## Requirements

### Requirement: In a workflow run

The factory SHALL behave as this line says: When `factory default-branch` runs in a workflow run whose event names the repository's default branch, it prints that name and exits 0.

#### Scenario: In a workflow run

- **WHEN** `factory default-branch` runs in a workflow run whose event names the repository's default branch
- **THEN** it prints that name and exits 0.

### Requirement: From origin/HEAD

The factory SHALL behave as this line says: When `factory default-branch` runs outside a workflow and `origin/HEAD` is set, it prints the branch `origin/HEAD` points to, without `origin/`, and exits 0.

#### Scenario: From origin/HEAD

- **WHEN** `factory default-branch` runs outside a workflow and `origin/HEAD` is set
- **THEN** it prints the branch `origin/HEAD` points to, without `origin/`, and exits 0.

### Requirement: From the code host

The factory SHALL behave as this line says: When `origin/HEAD` is not set, `factory default-branch` asks the code host, prints the name, sets `origin/HEAD` to it so the next run asks nobody, and exits 0.

#### Scenario: From the code host

- **WHEN** `origin/HEAD` is not set
- **THEN** `factory default-branch` asks the code host, prints the name, sets `origin/HEAD` to it so the next run asks nobody, and exits 0.

### Requirement: Nobody answers

The factory SHALL behave as this line says: When there is an `origin` remote and none of the three answers, `factory default-branch` prints `Could not tell the default branch. Run: git remote set-head origin --auto` on standard error and exits 1.

#### Scenario: Nobody answers

- **WHEN** there is an `origin` remote and none of the three answers
- **THEN** `factory default-branch` prints `Could not tell the default branch. Run: git remote set-head origin --auto` on standard error and exits 1.

### Requirement: The default branch is checked out

The factory SHALL behave as this line says: When a session runs a git command with the default branch checked out, the commit guard blocks it with `BRANCH is checked out. Create a branch from origin/BRANCH first.`, whatever the default branch is called.

#### Scenario: The default branch is checked out

- **WHEN** a session runs a git command with the default branch checked out
- **THEN** the commit guard blocks it with `BRANCH is checked out. Create a branch from origin/BRANCH first.`, whatever the default branch is called.

### Requirement: A push to the default branch

The factory SHALL behave as this line says: When a session pushes to the default branch, the commit guard blocks it with `pushing to BRANCH. BRANCH only changes through a merged pull request.`

#### Scenario: A push to the default branch

- **WHEN** a session pushes to the default branch
- **THEN** the commit guard blocks it with `pushing to BRANCH. BRANCH only changes through a merged pull request.`

### Requirement: The guard cannot tell

The factory SHALL behave as this line says: When the commit guard cannot tell the default branch in a checkout that has `.claude/factory.yaml`, it blocks the git command with line 58's message.

#### Scenario: The guard cannot tell

- **WHEN** the commit guard cannot tell the default branch in a checkout that has `.claude/factory.yaml`
- **THEN** it blocks the git command with line 58's message.

### Requirement: Session start

The factory SHALL behave as this line says: When a session starts, the branches it lists as holding unmerged work are compared with `origin/BRANCH`, BRANCH being the default branch, and each line reads `NAME (N commits not on origin/BRANCH)`.

#### Scenario: Session start

- **WHEN** a session starts
- **THEN** the branches it lists as holding unmerged work are compared with `origin/BRANCH`, BRANCH being the default branch, and each line reads `NAME (N commits not on origin/BRANCH)`.

### Requirement: Sync writes the push triggers

The factory SHALL behave as this line says: When `factory sync` runs, the `branches:` list of the push trigger in `.github/workflows/factory-check.yml` and `.github/workflows/factory-conflicts.yml` holds the default branch's name and nothing else.

#### Scenario: Sync writes the push triggers

- **WHEN** `factory sync` runs
- **THEN** the `branches:` list of the push trigger in `.github/workflows/factory-check.yml` and `.github/workflows/factory-conflicts.yml` holds the default branch's name and nothing else.

### Requirement: Triggers out of step

The factory SHALL behave as this line says: When the default branch's name differs from what those two copies hold, `factory sync --check` fails, naming the copies.

#### Scenario: Triggers out of step

- **WHEN** the default branch's name differs from what those two copies hold
- **THEN** `factory sync --check` fails, naming the copies.

### Requirement: Sync cannot tell

The factory SHALL behave as this line says: When there is an `origin` remote and `factory sync` cannot tell the default branch, it writes nothing, prints line 58's message, and exits 1.

#### Scenario: Sync cannot tell

- **WHEN** there is an `origin` remote and `factory sync` cannot tell the default branch
- **THEN** it writes nothing, prints line 58's message, and exits 1.

### Requirement: Conflict and dependency lines

The factory SHALL behave as this line says: When `factory pr watch N` reports a conflict, its line reads `conflict with BRANCH at SHA`, and `factory deps` names the step `merge BRANCH (step 2)`, BRANCH being the default branch.

#### Scenario: Conflict and dependency lines

- **WHEN** `factory pr watch N` reports a conflict
- **THEN** its line reads `conflict with BRANCH at SHA`, and `factory deps` names the step `merge BRANCH (step 2)`, BRANCH being the default branch.

### Requirement: The site comparison's base

The factory SHALL behave as this line says: When `factory site compare` runs, the base it starts is the default branch as `factory default-branch` gives it, and it fails with line 58's message where that does.

#### Scenario: The site comparison's base

- **WHEN** `factory site compare` runs
- **THEN** the base it starts is the default branch as `factory default-branch` gives it, and it fails with line 58's message where that does.

### Requirement: No origin remote

The factory SHALL behave as this line says: When the checkout has no `origin` remote, `factory default-branch` prints the branch `git config init.defaultBranch` names, or `main` when that is not set, and exits 0.

#### Scenario: No origin remote

- **WHEN** the checkout has no `origin` remote
- **THEN** `factory default-branch` prints the branch `git config init.defaultBranch` names, or `main` when that is not set, and exits 0.

### Requirement: A checkout without settings

The factory SHALL behave as this line says: When a session runs a git command in a checkout that has no `.claude/factory.yaml`, the commit guard takes the default branch from `origin/HEAD` alone, asks no code host, and lets the command through when `origin/HEAD` is not set.

#### Scenario: A checkout without settings

- **WHEN** a session runs a git command in a checkout that has no `.claude/factory.yaml`
- **THEN** the commit guard takes the default branch from `origin/HEAD` alone, asks no code host, and lets the command through when `origin/HEAD` is not set.
