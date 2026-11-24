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

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: From origin/HEAD

- **WHEN** `factory default-branch` runs outside a workflow and `REMOTE/HEAD` is set
- **THEN** it prints the branch `REMOTE/HEAD` points to, without `REMOTE/`, and exits 0. REMOTE is the remote whose address is the repository the `repository` line of `.claude/factory.yaml` names, whatever that remote is called and whether its address is an SSH or an HTTPS one, and `origin` where two remotes have that repository's address and one of them is `origin`. Where no remote has that repository's address, REMOTE is `origin` when the address of `origin` names no repository on a code host the factory supports, as an SSH host alias such as `git@github-work:acme/web.git` or a proxy's address does not; an `origin` whose address names another repository, or no `origin`, stops the command with the line `init-repository` gives for no such remote. In a checkout with no `.claude/factory.yaml`, REMOTE is `origin`.

### Requirement: From the code host

The factory SHALL behave as this line says: When `REMOTE/HEAD` is not set, REMOTE being the remote "From origin/HEAD" reads, `factory default-branch` asks the code host, prints the name, sets `REMOTE/HEAD` to it so the next run asks nobody, and exits 0.

#### Scenario: From the code host

- **WHEN** `REMOTE/HEAD` is not set, REMOTE being the remote "From origin/HEAD" reads
- **THEN** `factory default-branch` asks the code host, prints the name, sets `REMOTE/HEAD` to it so the next run asks nobody, and exits 0.

### Requirement: Nobody answers

The factory SHALL behave as this line says: When there is a remote REMOTE, as "From origin/HEAD" reads it, and none of the three answers, `factory default-branch` prints `Could not tell the default branch. Run: git remote set-head REMOTE --auto` on standard error, with the remote's name for REMOTE, and exits 1.

#### Scenario: Nobody answers

- **WHEN** there is a remote REMOTE, as "From origin/HEAD" reads it, and none of the three answers
- **THEN** `factory default-branch` prints `Could not tell the default branch. Run: git remote set-head REMOTE --auto` on standard error, with the remote's name for REMOTE, and exits 1.

### Requirement: The default branch is checked out

The factory SHALL behave as this line says: When a session runs a git command with the default branch checked out, the commit guard blocks it with `BRANCH is checked out. Create a branch from REMOTE/BRANCH first.`, whatever the default branch is called, REMOTE being the remote "From origin/HEAD" reads, or with the line `init-repository` gives for no such remote when no remote's address is the `repository` line's.

#### Scenario: The default branch is checked out

- **WHEN** a session runs a git command with the default branch checked out
- **THEN** the commit guard blocks it with `BRANCH is checked out. Create a branch from REMOTE/BRANCH first.`, whatever the default branch is called, REMOTE being the remote "From origin/HEAD" reads, or with the line `init-repository` gives for no such remote when no remote's address is the `repository` line's.

### Requirement: A push to the default branch

The factory SHALL behave as this line says: When a session pushes to the default branch, the commit guard blocks it with `pushing to BRANCH. BRANCH only changes through a merged pull request.`

#### Scenario: A push to the default branch

- **WHEN** a session pushes to the default branch
- **THEN** the commit guard blocks it with `pushing to BRANCH. BRANCH only changes through a merged pull request.`

### Requirement: The guard cannot tell

The factory SHALL behave as this line says: When the commit guard cannot tell the default branch in a checkout that has `.claude/factory.yaml`, it blocks the git command with the line `factory default-branch` fails with there: the message of "Nobody answers", or the line `init-repository` gives for no such remote.

#### Scenario: The guard cannot tell

- **WHEN** the commit guard cannot tell the default branch in a checkout that has `.claude/factory.yaml`
- **THEN** it blocks the git command with the line `factory default-branch` fails with there: the message of "Nobody answers", or the line `init-repository` gives for no such remote.

### Requirement: Session start

The factory SHALL behave as this line says: When a session starts, the branches it lists as holding unmerged work are compared with `REMOTE/BRANCH`, BRANCH being the default branch and REMOTE the remote "From origin/HEAD" reads, and each line reads `NAME (N commits not on REMOTE/BRANCH)`. Where the default branch or that remote cannot be told, the line `factory default-branch` fails with there stands in for the list, and the session starts.

#### Scenario: Session start

- **WHEN** a session starts
- **THEN** the branches it lists as holding unmerged work are compared with `REMOTE/BRANCH`, BRANCH being the default branch and REMOTE the remote "From origin/HEAD" reads, and each line reads `NAME (N commits not on REMOTE/BRANCH)`. Where the default branch or that remote cannot be told, the line `factory default-branch` fails with there stands in for the list, and the session starts.

### Requirement: Sync writes the push triggers

The factory SHALL behave as this line says: When `factory sync` runs, the `branches:` list of the push trigger in `.github/workflows/factory.yml` holds the default branch's name and nothing else.

#### Scenario: Sync writes the push triggers

- **WHEN** `factory sync` runs
- **THEN** the `branches:` list of the push trigger in `.github/workflows/factory.yml` holds the default branch's name and nothing else.

### Requirement: Triggers out of step

The factory SHALL behave as this line says: When the default branch's name differs from what that file holds, `factory sync --check` fails, naming the file.

#### Scenario: Triggers out of step

- **WHEN** the default branch's name differs from what that file holds
- **THEN** `factory sync --check` fails, naming the file.

### Requirement: Sync cannot tell

The factory SHALL behave as this line says: When `factory sync` cannot tell the default branch, which is where `factory default-branch` fails, it writes nothing, prints the line that command fails with there, and exits 1.

#### Scenario: Sync cannot tell

- **WHEN** `factory sync` cannot tell the default branch, which is where `factory default-branch` fails
- **THEN** it writes nothing, prints the line that command fails with there, and exits 1.

### Requirement: Conflict and dependency lines

The factory SHALL behave as this line says: When `factory pr watch N` reports a conflict, its line reads `conflict with BRANCH at SHA`, and `factory deps` names the step `merge BRANCH (step 2)`, BRANCH being the default branch.

#### Scenario: Conflict and dependency lines

- **WHEN** `factory pr watch N` reports a conflict
- **THEN** its line reads `conflict with BRANCH at SHA`, and `factory deps` names the step `merge BRANCH (step 2)`, BRANCH being the default branch.

### Requirement: The site comparison's base

The factory SHALL behave as this line says: When `factory site compare` runs, the base it starts is the default branch as `factory default-branch` gives it, on the remote "From origin/HEAD" reads, and it fails with the line that command fails with where that does, and with the line `init-repository` gives for no such remote when no remote's address is the `repository` line's.

#### Scenario: The site comparison's base

- **WHEN** `factory site compare` runs
- **THEN** the base it starts is the default branch as `factory default-branch` gives it, on the remote "From origin/HEAD" reads, and it fails with the line that command fails with where that does, and with the line `init-repository` gives for no such remote when no remote's address is the `repository` line's.

### Requirement: No origin remote

The factory SHALL behave as this line says: When the checkout has no `.claude/factory.yaml` and no `origin` remote, `factory default-branch` prints the branch `git config init.defaultBranch` names, or `main` when that is not set, and exits 0.

#### Scenario: No origin remote

- **WHEN** the checkout has no `.claude/factory.yaml` and no `origin` remote
- **THEN** `factory default-branch` prints the branch `git config init.defaultBranch` names, or `main` when that is not set, and exits 0.

### Requirement: A checkout without settings

The factory SHALL behave as this line says: When a session runs a git command in a checkout that has no `.claude/factory.yaml`, the commit guard takes the default branch from `origin/HEAD` alone, asks no code host, and lets the command through when `origin/HEAD` is not set.

#### Scenario: A checkout without settings

- **WHEN** a session runs a git command in a checkout that has no `.claude/factory.yaml`
- **THEN** the commit guard takes the default branch from `origin/HEAD` alone, asks no code host, and lets the command through when `origin/HEAD` is not set.
