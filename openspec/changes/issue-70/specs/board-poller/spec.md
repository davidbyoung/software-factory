## ADDED Requirements

### Requirement: The hosted poller reads the settings

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The hosted poller reads the settings

- **WHEN** the hosted poller (`factory poller`, without `--once`) makes a pass
- **THEN** it reads `.claude/factory.lock` from the repository's default branch through GitHub, with `FACTORY_BOARD_TOKEN`, and takes the board, the ready column, the factory label, `builds.max-per-hour`, `builds.trigger`, and the ticket system from the settings recorded there, as `factory poller --once` takes them from a checkout; every other column keeps its default, as with `--once`. It reads the file again at every pass, and the board's owner is the repository's owner.

### Requirement: The hosted poller names its repository

The factory SHALL behave as this line says: When the hosted poller starts, it logs `ready-poller started for OWNER/NAME`.

#### Scenario: The hosted poller names its repository

- **WHEN** the hosted poller starts
- **THEN** it logs `ready-poller started for OWNER/NAME`.

### Requirement: The hosted poller logs the settings it read

The factory SHALL behave as this line says: When the hosted poller first reads the settings, and at each pass where the board, the ready column, the label, or the cap differ from the last it logged, it logs `settings from .claude/factory.lock on BRANCH: board N, ready column "COLUMN", label "LABEL", MAX builds an hour`, BRANCH being the default branch.

#### Scenario: The hosted poller logs the settings it read

- **WHEN** the hosted poller first reads the settings, and at each pass where the board, the ready column, the label, or the cap differ from the last it logged
- **THEN** it logs `settings from .claude/factory.lock on BRANCH: board N, ready column "COLUMN", label "LABEL", MAX builds an hour`, BRANCH being the default branch.

### Requirement: The hosted poller names variables it no longer reads

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The hosted poller names variables it no longer reads

- **WHEN** the hosted poller starts with any of `FACTORY_BOARD_OWNER`, `FACTORY_BOARD_NUMBER`, `FACTORY_READY_COLUMN`, `FACTORY_LABEL`, and `FACTORY_MAX_PER_HOUR` set to more than spaces
- **THEN** it reads none of them, and logs once, before its first `settings from` line, `NAMES are no longer read: the settings on BRANCH are. Take them out of the poller's environment.`, NAMES being those set, in that order, joined by `, `, and `is` in place of `are` and `it` in place of `them` for one.

### Requirement: No lock on the default branch

The factory SHALL behave as this line says: When the default branch has no `.claude/factory.lock`, the hosted poller starts nothing and its reason is `no .claude/factory.lock on BRANCH yet. Merge the pull request that sets the factory up.`

#### Scenario: No lock on the default branch

- **WHEN** the default branch has no `.claude/factory.lock`
- **THEN** the hosted poller starts nothing and its reason is `no .claude/factory.lock on BRANCH yet. Merge the pull request that sets the factory up.`

### Requirement: A trigger other than own-server

The factory SHALL behave as this line says: When the settings' `builds.trigger` is not `own-server`, the hosted poller starts nothing and its reason is `builds.trigger is VALUE on BRANCH, not own-server`.

#### Scenario: A trigger other than own-server

- **WHEN** the settings' `builds.trigger` is not `own-server`
- **THEN** the hosted poller starts nothing and its reason is `builds.trigger is VALUE on BRANCH, not own-server`.

### Requirement: No board in the settings

The factory SHALL behave as this line says: When the settings have no `tickets.board`, the hosted poller starts nothing and its reason is `tickets.board is not set on BRANCH`.

#### Scenario: No board in the settings

- **WHEN** the settings have no `tickets.board`
- **THEN** the hosted poller starts nothing and its reason is `tickets.board is not set on BRANCH`.

### Requirement: A setting the hosted poller cannot read

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A setting the hosted poller cannot read

- **WHEN** a setting the hosted poller uses can't be read, a ready column of `none` included
- **THEN** it starts nothing and its reason is `.claude/factory.lock on BRANCH: ` and the fault as `factory config check` words it after the file's name, such as `builds.max-per-hour: must be a whole number, 1 or more`. When the lock's `version:` differs from the poller's own version, the reason ends ` (written by factory LOCK, and this poller is OWN: run ghcr.io/davidbyoung/software-factory-poller:LOCK)`.

### Requirement: Settings the hosted poller does not use

The factory SHALL behave as this line says: When the lock holds a key the poller's version does not know, or any value, even one it would refuse, in a setting other than those "The hosted poller reads the settings" names, the hosted poller reads the settings that requirement names and polls as usual.

#### Scenario: Settings the hosted poller does not use

- **WHEN** the lock holds a key the poller's version does not know, or any value, even one it would refuse, in a setting other than those "The hosted poller reads the settings" names
- **THEN** the hosted poller reads the settings that requirement names and polls as usual.

### Requirement: How the hosted poller logs a reason not to poll

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: How the hosted poller logs a reason not to poll

- **WHEN** one of "No lock on the default branch", "A trigger other than own-server", "No board in the settings", and "A setting the hosted poller cannot read" holds
- **THEN** the hosted poller logs `not polling: REASON` at the first pass where it holds and at each pass where the reason changes, not at every pass, and while it holds the hourly heartbeat reads `heartbeat: not polling: REASON`. A pass that read the lock, whether it then polls or not, resets the count toward the slower retry to 0, so it reads again a minute later and starts at the first pass after the reason clears.

### Requirement: No settings from an earlier pass

The factory SHALL behave as this line says: When the hosted poller can't read the settings, it never uses settings it read at an earlier pass.

#### Scenario: No settings from an earlier pass

- **WHEN** the hosted poller can't read the settings
- **THEN** it never uses settings it read at an earlier pass.

### Requirement: A failed read of the lock

The factory SHALL behave as this line says: When reading `.claude/factory.lock` fails, other than the file not being there, the hosted poller logs `read failed (N in a row): ERROR`, starts nothing, and counts it toward the slower retry, as a failed read of the board does.

#### Scenario: A failed read of the lock

- **WHEN** reading `.claude/factory.lock` fails, other than the file not being there
- **THEN** the hosted poller logs `read failed (N in a row): ERROR`, starts nothing, and counts it toward the slower retry, as a failed read of the board does.

### Requirement: The hosted poller needs its token

The factory SHALL behave as this line says: When the hosted poller starts without `FACTORY_BOARD_TOKEN`, or with only spaces in it, it logs `ready-poller started for OWNER/NAME`, then `not polling: FACTORY_BOARD_TOKEN not set` at each pass, which counts toward the slower retry as it does today, and polls nothing.

#### Scenario: The hosted poller needs its token

- **WHEN** the hosted poller starts without `FACTORY_BOARD_TOKEN`, or with only spaces in it
- **THEN** it logs `ready-poller started for OWNER/NAME`, then `not polling: FACTORY_BOARD_TOKEN not set` at each pass, which counts toward the slower retry as it does today, and polls nothing.

### Requirement: Init prints the poller's two variables

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init prints the poller's two variables

- **WHEN** `factory init` ends a run with builds from the board on and `builds.trigger: own-server`
- **THEN** the poller's step under "Left to do" lists `FACTORY_REPOSITORY=OWNER/NAME` and `FACTORY_BOARD_TOKEN=the access token you just made`, and no other variable, then the line `It reads the rest from your settings once this pull request merges.` when init opened its pull request, and `It reads the rest from your settings once they are on BRANCH.` when it did not.

## REMOVED Requirements

### Requirement: The hosted poller needs its ready column

**Reason**: The hosted poller reads the ready column from the settings; only its token is required, as "The hosted poller needs its token" says.

**Migration**: Take the variable out of the poller's environment, as "The poller reads your settings" in `docs/updating.md` says.

### Requirement: The hosted poller reads its ready column

**Reason**: `FACTORY_READY_COLUMN` is no longer read: "The hosted poller reads the settings" replaces it.

**Migration**: Take the variable out of the poller's environment, as "The poller reads your settings" in `docs/updating.md` says.

### Requirement: Init prints the poller's ready column

**Reason**: "Init prints the poller's two variables" replaces it.

**Migration**: Take the variable out of the poller's environment, as "The poller reads your settings" in `docs/updating.md` says.

### Requirement: The hosted poller's label and cap

**Reason**: `FACTORY_LABEL` and `FACTORY_MAX_PER_HOUR` are no longer read: the label and the cap come from the settings.

**Migration**: Take the variable out of the poller's environment, as "The poller reads your settings" in `docs/updating.md` says.

### Requirement: Board check names the poller's variables

**Reason**: The poller reads the label and the cap from the settings, so `factory board check` names no variable: "Board check with a poller you host" in cli-output says what it prints.

**Migration**: Take the variable out of the poller's environment, as "The poller reads your settings" in `docs/updating.md` says.
