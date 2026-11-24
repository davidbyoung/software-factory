## MODIFIED Requirements

### Requirement: From origin/HEAD

The factory SHALL behave as this line says: When `factory default-branch` runs outside a workflow and `REMOTE/HEAD` is set, it prints the branch `REMOTE/HEAD` points to, without `REMOTE/`, and exits 0. REMOTE is the remote whose address is the repository the `repository` line of `.claude/factory.yaml` names, whatever that remote is called and whether its address is an SSH or an HTTPS one, and `origin` where two remotes have that repository's address and one of them is `origin`. In a checkout with no `.claude/factory.yaml`, REMOTE is `origin`.

#### Scenario: From origin/HEAD

- **WHEN** `factory default-branch` runs outside a workflow and `REMOTE/HEAD` is set
- **THEN** it prints the branch `REMOTE/HEAD` points to, without `REMOTE/`, and exits 0. REMOTE is the remote whose address is the repository the `repository` line of `.claude/factory.yaml` names, whatever that remote is called and whether its address is an SSH or an HTTPS one, and `origin` where two remotes have that repository's address and one of them is `origin`. In a checkout with no `.claude/factory.yaml`, REMOTE is `origin`.

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

### Requirement: Sync cannot tell

The factory SHALL behave as this line says: When `factory sync` cannot tell the default branch, which is where `factory default-branch` fails, it writes nothing, prints the line that command fails with there, and exits 1.

#### Scenario: Sync cannot tell

- **WHEN** `factory sync` cannot tell the default branch, which is where `factory default-branch` fails
- **THEN** it writes nothing, prints the line that command fails with there, and exits 1.

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
