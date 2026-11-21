## ADDED Requirements

### Requirement: A missing branch name

The factory SHALL behave as this line says: When the settings in effect have no `code-host.branch-name`, from the file or a preset, `factory config check` exits 1 and prints `.claude/factory.yaml: code-host.branch-name: is required. Run factory init to set it, or add it, such as branch-name: "{ticket}"`.

#### Scenario: A missing branch name

- **WHEN** the settings in effect have no `code-host.branch-name`, from the file or a preset
- **THEN** `factory config check` exits 1 and prints `.claude/factory.yaml: code-host.branch-name: is required. Run factory init to set it, or add it, such as branch-name: "{ticket}"`.

### Requirement: Code host on one line

The factory SHALL behave as this line says: When `.claude/factory.yaml` writes `code-host: github` on one line and no preset in effect supplies `branch-name`, `factory config check` fails with line 1's message.

#### Scenario: Code host on one line

- **WHEN** `.claude/factory.yaml` writes `code-host: github` on one line and no preset in effect supplies `branch-name`
- **THEN** `factory config check` fails with line 1's message.

### Requirement: A preset's branch name

The factory SHALL behave as this line says: When a preset in effect supplies `code-host.branch-name` and the repository's file does not, `factory config check` passes and `factory ticket branch N` uses the preset's pattern.

#### Scenario: A preset's branch name

- **WHEN** a preset in effect supplies `code-host.branch-name` and the repository's file does not
- **THEN** `factory config check` passes and `factory ticket branch N` uses the preset's pattern.

### Requirement: A branch name that is a map

The factory SHALL behave as this line says: When `code-host.branch-name` is a YAML map, as an unquoted `branch-name: {ticket}` is, `factory config check` exits 1 and prints `.claude/factory.yaml: code-host.branch-name: is a map, not a pattern. Quote it: branch-name: "{ticket}"`.

#### Scenario: A branch name that is a map

- **WHEN** `code-host.branch-name` is a YAML map, as an unquoted `branch-name: {ticket}` is
- **THEN** `factory config check` exits 1 and prints `.claude/factory.yaml: code-host.branch-name: is a map, not a pattern. Quote it: branch-name: "{ticket}"`.

### Requirement: A branch name that is not text

The factory SHALL behave as this line says: When `code-host.branch-name` is any other value that is not text, such as a number or a list, `factory config check` exits 1 and prints `.claude/factory.yaml: code-host.branch-name: must be a pattern, such as branch-name: "{ticket}"`.

#### Scenario: A branch name that is not text

- **WHEN** `code-host.branch-name` is any other value that is not text, such as a number or a list
- **THEN** `factory config check` exits 1 and prints `.claude/factory.yaml: code-host.branch-name: must be a pattern, such as branch-name: "{ticket}"`.

### Requirement: An unknown placeholder

The factory SHALL behave as this line says: When the pattern holds `{NAME}` for any NAME other than `ticket` and `user`, `factory config check` exits 1 and prints `.claude/factory.yaml: code-host.branch-name: {NAME} is not a placeholder. The placeholders are {ticket} and {user}`, naming the first such placeholder.

#### Scenario: An unknown placeholder

- **WHEN** the pattern holds `{NAME}` for any NAME other than `ticket` and `user`
- **THEN** `factory config check` exits 1 and prints `.claude/factory.yaml: code-host.branch-name: {NAME} is not a placeholder. The placeholders are {ticket} and {user}`, naming the first such placeholder.

### Requirement: A pattern without the ticket

The factory SHALL behave as this line says: When the pattern has no `{ticket}`, `factory config check` exits 1 and prints `.claude/factory.yaml: code-host.branch-name: needs {ticket}, or every build gets the same branch`.

#### Scenario: A pattern without the ticket

- **WHEN** the pattern has no `{ticket}`
- **THEN** `factory config check` exits 1 and prints `.claude/factory.yaml: code-host.branch-name: needs {ticket}, or every build gets the same branch`.

### Requirement: A pattern git refuses

The factory SHALL behave as this line says: When the pattern, with its placeholders filled, breaks any of git's rules for a branch name (`git check-ref-format --branch`), `factory config check` exits 1, names the pattern as written, and gives the first rule it breaks, in the order the scenario lists.

#### Scenario: A pattern git refuses

- **WHEN** the pattern, with its placeholders filled, breaks any of git's rules for a branch name (`git check-ref-format --branch`)
- **THEN** `factory config check` exits 1 and prints `.claude/factory.yaml: code-host.branch-name: PATTERN can't be a git branch name: REASON`, with PATTERN as written and REASON the first that applies, in this order: `it has a space`, `it has a control character`, `it has X` for X the first of `..`, `//`, `@{`, `~`, `^`, `:`, `?`, `*`, `[`, or `\`; `it starts with -` or `it starts with /`; `it ends with /`, `it ends with .lock`, or `it ends with .`; or `a part starts with .` or `a part ends with .lock`, for a part between slashes.

### Requirement: A valid pattern

The factory SHALL behave as this line says: When the pattern has `{ticket}`, only known placeholders, and passes line 8, `factory config check` passes as it does today, printing `✓ The settings are valid.`.

#### Scenario: A valid pattern

- **WHEN** the pattern has `{ticket}`, only known placeholders, and passes line 8
- **THEN** `factory config check` passes as it does today, printing `✓ The settings are valid.`.

### Requirement: The branch for a ticket

The factory SHALL behave as this line says: When `factory ticket branch N` runs for a ticket that exists, it prints one line, the pattern with each `{ticket}` replaced by N as the ticket system writes it, without `#`, and each `{user}` by the account the code host's CLI is signed in as, and exits 0.

#### Scenario: The branch for a ticket

- **WHEN** `factory ticket branch N` runs for a ticket that exists
- **THEN** it prints one line, the pattern with each `{ticket}` replaced by N as the ticket system writes it, without `#`, and each `{user}` by the account the code host's CLI is signed in as, and exits 0.

### Requirement: The branch for a missing ticket

The factory SHALL behave as this line says: When `factory ticket branch N` runs for a ticket that does not exist, it prints `#N was not found` and exits 1.

#### Scenario: The branch for a missing ticket

- **WHEN** `factory ticket branch N` runs for a ticket that does not exist
- **THEN** it prints `#N was not found` and exits 1.

### Requirement: The branch without a sign-in

The factory SHALL behave as this line says: When the pattern has `{user}` and the code host has no sign-in or refuses it (`gh` exits 4, its "authentication required" status, or GitHub answers 401), `factory ticket branch N` prints `code-host.branch-name uses {user}, and gh is not signed in: run gh auth login` and exits 1. Any other failure to read the account prints the code host's own error and exits 1.

#### Scenario: The branch without a sign-in

- **WHEN** the pattern has `{user}` and the code host has no sign-in or refuses it (`gh` exits 4, its "authentication required" status, or GitHub answers 401)
- **THEN** `factory ticket branch N` prints `code-host.branch-name uses {user}, and gh is not signed in: run gh auth login` and exits 1. Any other failure to read the account prints the code host's own error and exits 1.

### Requirement: The spec change's name

The factory SHALL behave as this line says: When `specs` is `openspec`, `factory specs change-name N` prints `issue-` followed by N as the ticket system writes it, in lowercase, and exits 0, whatever `code-host.branch-name` says.

#### Scenario: The spec change's name

- **WHEN** `specs` is `openspec`
- **THEN** `factory specs change-name N` prints `issue-` followed by N as the ticket system writes it, in lowercase, and exits 0, whatever `code-host.branch-name` says.

### Requirement: The spec change's name with specs off

The factory SHALL behave as this line says: When `specs` is `none`, `factory specs change-name N` prints `specs are off: there is no spec change to name` and exits 1.

#### Scenario: The spec change's name with specs off

- **WHEN** `specs` is `none`
- **THEN** `factory specs change-name N` prints `specs are off: there is no spec change to name` and exits 1.

### Requirement: The newest pull request from a branch

The factory SHALL behave as this line says: When `factory pr for-branch BRANCH` runs and pull requests have been opened from BRANCH, it prints the newest one as `#N open`, `#N merged`, or `#N closed`, closed meaning closed without merging, and exits 0.

#### Scenario: The newest pull request from a branch

- **WHEN** `factory pr for-branch BRANCH` runs and pull requests have been opened from BRANCH
- **THEN** it prints the newest one as `#N open`, `#N merged`, or `#N closed`, closed meaning closed without merging, and exits 0.

### Requirement: No pull request from a branch

The factory SHALL behave as this line says: When no pull request has been opened from BRANCH, `factory pr for-branch BRANCH` prints `none` and exits 0.

#### Scenario: No pull request from a branch

- **WHEN** no pull request has been opened from BRANCH
- **THEN** `factory pr for-branch BRANCH` prints `none` and exits 0.

### Requirement: The first of several faults

The factory SHALL behave as this line says: When `factory config check` meets a pattern with several faults, it reports the first by the order of lines 4 to 8: the value's type, then an unknown placeholder, then a missing `{ticket}`, then git's rules. Braces that do not hold a name of letters, digits, or hyphens, such as `{}` or an unclosed `{ticket`, are plain text to line 6, and git's rules judge them.

#### Scenario: The first of several faults

- **WHEN** `factory config check` meets a pattern with several faults
- **THEN** it reports the first by the order of lines 4 to 8: the value's type, then an unknown placeholder, then a missing `{ticket}`, then git's rules. Braces that do not hold a name of letters, digits, or hyphens, such as `{}` or an unclosed `{ticket`, are plain text to line 6, and git's rules judge them.
