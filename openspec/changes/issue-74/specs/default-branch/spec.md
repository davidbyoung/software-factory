## MODIFIED Requirements

### Requirement: From origin/HEAD

The factory SHALL behave as this line says: When `factory default-branch` runs outside a workflow and `REMOTE/HEAD` is set, REMOTE being the remote whose address is the `repository` line's, it prints the branch `REMOTE/HEAD` points to, without `REMOTE/`, and exits 0.

#### Scenario: From origin/HEAD

- **WHEN** `factory default-branch` runs outside a workflow and `REMOTE/HEAD` is set, REMOTE being the remote whose address is the `repository` line's
- **THEN** it prints the branch `REMOTE/HEAD` points to, without `REMOTE/`, and exits 0.

### Requirement: From the code host

The factory SHALL behave as this line says: When `REMOTE/HEAD` is not set, REMOTE being the remote whose address is the `repository` line's, `factory default-branch` asks the code host, prints the name, sets `REMOTE/HEAD` to it so the next run asks nobody, and exits 0.

#### Scenario: From the code host

- **WHEN** `REMOTE/HEAD` is not set, REMOTE being the remote whose address is the `repository` line's
- **THEN** `factory default-branch` asks the code host, prints the name, sets `REMOTE/HEAD` to it so the next run asks nobody, and exits 0.

### Requirement: Nobody answers

The factory SHALL behave as this line says: When there is a remote whose address is the `repository` line's and none of the three answers, `factory default-branch` prints `Could not tell the default branch. Run: git remote set-head origin --auto` on standard error and exits 1.

#### Scenario: Nobody answers

- **WHEN** there is a remote whose address is the `repository` line's and none of the three answers
- **THEN** `factory default-branch` prints `Could not tell the default branch. Run: git remote set-head origin --auto` on standard error and exits 1.

### Requirement: Sync cannot tell

The factory SHALL behave as this line says: When there is a remote whose address is the `repository` line's and `factory sync` cannot tell the default branch, it writes nothing, prints line 58's message, and exits 1.

#### Scenario: Sync cannot tell

- **WHEN** there is a remote whose address is the `repository` line's and `factory sync` cannot tell the default branch
- **THEN** it writes nothing, prints line 58's message, and exits 1.

## REMOVED Requirements

### Requirement: No origin remote

**Reason**: The default branch is read from the remote whose address is the `repository` line's, whatever that remote is called, and with no such remote `factory default-branch` stops, where it took git's own default.

**Migration**: See `init-repository`, "The remote the default branch is read from": with no such remote it prints the line that names the `repository` line, and exits 1.
