# cli-output Specification

## Purpose

What the commands a person runs print, so the output says what it is and whether it worked.

## Requirements

### Requirement: Usage with no command

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Usage with no command

- **WHEN** `factory` runs with no command
- **THEN** it prints, on standard error, `Usage: factory COMMAND`, then the groups `Setting up`, `Every day`, `Now and then`, `Presets`, and `Your repository's commands`, each command indented two spaces and padded to 21 characters before its one-line description, or alone on its line with the description on the next, indented 23 spaces, when the command is longer than 20 characters, as Proposed docs shows, then `The commands skills, hooks, and workflows run are under "Run for you" in docs/cli.md.`, and exits 2.

### Requirement: Usage for a command it does not have

The factory SHALL behave as this line says: When `factory` runs with words that name no command, it prints `factory has no command "WORDS".`, WORDS being every argument joined by spaces, and a blank line before the same text, and exits 2. `factory --help` and `factory -h` print what line 1 says.

#### Scenario: Usage for a command it does not have

- **WHEN** `factory` runs with words that name no command
- **THEN** it prints `factory has no command "WORDS".`, WORDS being every argument joined by spaces, and a blank line before the same text, and exits 2. `factory --help` and `factory -h` print what line 1 says.

### Requirement: Usage lists a person's commands

The factory SHALL behave as this line says: The usage lists exactly the commands `docs/cli.md` lists under "Setting up", "Every day", "Now and then", "Presets", and "Your repository's commands", matched by the command's words: `status --watch`'s row is `status [--watch]`'s, and options appear as Proposed docs shows them.

#### Scenario: Usage lists a person's commands

- **WHEN** `factory` prints its usage
- **THEN** the usage lists exactly the commands `docs/cli.md` lists under "Setting up", "Every day", "Now and then", "Presets", and "Your repository's commands", matched by the command's words: `status --watch`'s row is `status [--watch]`'s, and options appear as Proposed docs shows them.

### Requirement: Sync says when nothing changed

The factory SHALL behave as this line says: When a person's `factory sync` writes and deletes nothing, it prints `The factory's files already match the settings. Nothing changed.`

#### Scenario: Sync says when nothing changed

- **WHEN** a person's `factory sync` writes and deletes nothing
- **THEN** it prints `The factory's files already match the settings. Nothing changed.`

### Requirement: Sync check passes in a line

The factory SHALL behave as this line says: When `factory sync --check` finds every file matches, it prints `✓ The factory's files match the settings.` and exits 0.

#### Scenario: Sync check passes in a line

- **WHEN** `factory sync --check` finds every file matches
- **THEN** it prints `✓ The factory's files match the settings.` and exits 0.

### Requirement: Sync check names the files that differ

The factory SHALL behave as this line says: When `factory sync --check` finds files that differ, it prints on standard error `✗ N of the factory's files don't match the settings:`, with `doesn't` when N is 1, each path on its own line indented two spaces, then `Run factory sync and commit what it writes.`, and exits 1.

#### Scenario: Sync check names the files that differ

- **WHEN** `factory sync --check` finds files that differ
- **THEN** it prints on standard error `✗ N of the factory's files don't match the settings:`, with `doesn't` when N is 1, each path on its own line indented two spaces, then `Run factory sync and commit what it writes.`, and exits 1.

### Requirement: Config check passes in a line

The factory SHALL behave as this line says: When `factory config check` finds the settings valid, it prints `✓ The settings are valid.` after any warning, and exits 0.

#### Scenario: Config check passes in a line

- **WHEN** `factory config check` finds the settings valid
- **THEN** it prints `✓ The settings are valid.` after any warning, and exits 0.

### Requirement: Board check's layout

The factory SHALL behave as this line says: When `factory board check` runs, it prints `Board N, "TITLE"` (or `Board N` with no title), a blank line, `tickets.columns` and one row per state, a blank line, then `tickets.fields` and one row per field. A row is two spaces, a mark, a space, the state key or the field's label padded to 10 characters, a space, and its text.

#### Scenario: Board check's layout

- **WHEN** `factory board check` runs
- **THEN** it prints `Board N, "TITLE"` (or `Board N` with no title), a blank line, `tickets.columns` and one row per state, a blank line, then `tickets.fields` and one row per field. A row is two spaces, a mark, a space, the state key or the field's label padded to 10 characters, a space, and its text.

### Requirement: A state on the board

The factory SHALL behave as this line says: When a state's columns are all on the board, its row is `✓` and the names joined by `, `.

#### Scenario: A state on the board

- **WHEN** a state's columns are all on the board
- **THEN** its row is `✓` and the names joined by `, `.

### Requirement: A state with no column

The factory SHALL behave as this line says: When a state is set to `none`, its row is `-` and `none, shows in COLUMN`, or `none` for `ready`.

#### Scenario: A state with no column

- **WHEN** a state is set to `none`
- **THEN** its row is `-` and `none, shows in COLUMN`, or `none` for `ready`.

### Requirement: A state's column missing from the board

The factory SHALL behave as this line says: When the board lacks a column a state names, its row is `✗` and `NAMES: no such column on the board`, followed by `: MISSING` naming the missing ones when the state has more than one name, such as `✗ review     Code review, QA: no such column on the board: QA`. This row wins over line 12's.

#### Scenario: A state's column missing from the board

- **WHEN** the board lacks a column a state names
- **THEN** its row is `✗` and `NAMES: no such column on the board`, followed by `: MISSING` naming the missing ones when the state has more than one name, such as `✗ review     Code review, QA: no such column on the board: QA`. This row wins over line 12's.

### Requirement: The poller's ready column

The factory SHALL behave as this line says: When `builds.trigger` is `own-server` and `ready` names a column, Ready included, `factory board check`'s `ready` row is `?` and `COLUMN: the poller needs FACTORY_READY_COLUMN set to "COLUMN"`. With `ready: none`, the row is as today.

#### Scenario: The poller's ready column

- **WHEN** `builds.trigger` is `own-server` and `ready` names a column, Ready included
- **THEN** `factory board check`'s `ready` row is `?` and `COLUMN: the poller needs FACTORY_READY_COLUMN set to "COLUMN"`. With `ready: none`, the row is as today.

### Requirement: A column no state names

The factory SHALL behave as this line says: When the board has a column no state names, a row follows the states' rows: `?`, the column's name padded as a key, and `no state: left alone`.

#### Scenario: A column no state names

- **WHEN** the board has a column no state names
- **THEN** a row follows the states' rows: `?`, the column's name padded as a key, and `no state: left alone`.

### Requirement: No Status field

The factory SHALL behave as this line says: When the board has no Status field, or one that is not a single select, the `Status` row is `✗` and `no such field` or `not a single select`, each state's row prints two spaces in place of its mark, and no line 13 row prints.

#### Scenario: No Status field

- **WHEN** the board has no Status field, or one that is not a single select
- **THEN** the `Status` row is `✗` and `no such field` or `not a single select`, each state's row prints two spaces in place of its mark, and no line 13 row prints.

### Requirement: A field the sync writes

The factory SHALL behave as this line says: When a field the board sync writes is on the board with what it needs, its row is `✓` and `synced`.

#### Scenario: A field the sync writes

- **WHEN** a field the board sync writes is on the board with what it needs
- **THEN** its row is `✓` and `synced`.

### Requirement: A field skipped

The factory SHALL behave as this line says: When a field is left at its default name and the board has no field of that name, its row is `?` and `skipped: no such field`.

#### Scenario: A field skipped

- **WHEN** a field is left at its default name and the board has no field of that name
- **THEN** its row is `?` and `skipped: no such field`.

### Requirement: A field set to none

The factory SHALL behave as this line says: When a field is set to `none`, its row is `-` and `off`.

#### Scenario: A field set to none

- **WHEN** a field is set to `none`
- **THEN** its row is `-` and `off`.

### Requirement: A field the board cannot hold

The factory SHALL behave as this line says: When a field the settings name is not on the board, its row is `✗` and `no such field: NAME`; when it is on the board but of the wrong type or lacking options, its row is `✗` and `NAME: not a text field`, `NAME: not a single select field`, or `NAME: not a number field`, by the field's kind, or `NAME: lacks A, B`, and for a field at its default name, `lacks A, B: name another field in tickets.fields.KEY, or set it to none`.

#### Scenario: A field the board cannot hold

- **WHEN** a field the settings name is not on the board
- **THEN** its row is `✗` and `no such field: NAME`; when it is on the board but of the wrong type or lacking options, its row is `✗` and `NAME: not a text field`, `NAME: not a single select field`, or `NAME: not a number field`, by the field's kind, or `NAME: lacks A, B`, and for a field at its default name, `lacks A, B: name another field in tickets.fields.KEY, or set it to none`.

### Requirement: Board check's exit

The factory SHALL behave as this line says: When any row of `factory board check` is `✗`, it exits 1; otherwise 0. It prints no `Note:` or `Problem:` line.

#### Scenario: Board check's exit

- **WHEN** any row of `factory board check` is `✗`
- **THEN** it exits 1; otherwise 0. It prints no `Note:` or `Problem:` line.

### Requirement: Doctor's headings

The factory SHALL behave as this line says: When `factory doctor` runs, it prints its checks under headings in this order: `Settings and files`, the code host's name, the runner's name, the ticket system's name, the coding agent's name, and `Parts that are off`; each check indented two spaces, a blank line between groups, and no heading for a group with no checks.

#### Scenario: Doctor's headings

- **WHEN** `factory doctor` runs
- **THEN** it prints its checks under headings in this order: `Settings and files`, the code host's name, the runner's name, the ticket system's name, the coding agent's name, and `Parts that are off`; each check indented two spaces, a blank line between groups, and no heading for a group with no checks.

### Requirement: Where each doctor check goes

The factory SHALL behave as this line says: When `factory doctor` sorts its checks, the settings, files, version, preset, and `commands.gate` checks go under `Settings and files`; each tool's own checks under its name; the secrets and `.npmrc` checks under the runner's name; and the ticket field checks under the ticket system's name.

#### Scenario: Where each doctor check goes

- **WHEN** `factory doctor` sorts its checks
- **THEN** the settings, files, version, preset, and `commands.gate` checks go under `Settings and files`; each tool's own checks under its name; the secrets and `.npmrc` checks under the runner's name; and the ticket field checks under the ticket system's name.

### Requirement: A check under its tool's name

The factory SHALL behave as this line says: When a check sits under a tool's name, its text does not start with that name and a colon: `✓ CLAUDE.md imports the factory's rules`, not `✓ Claude Code: CLAUDE.md imports the factory's rules`. A sentence whose subject is the tool's name, such as `GitHub Issues has no ticket fields, which tickets.fields names`, keeps it.

#### Scenario: A check under its tool's name

- **WHEN** a check sits under a tool's name
- **THEN** its text does not start with that name and a colon: `✓ CLAUDE.md imports the factory's rules`, not `✓ Claude Code: CLAUDE.md imports the factory's rules`. A sentence whose subject is the tool's name, such as `GitHub Issues has no ticket fields, which tickets.fields names`, keeps it.

### Requirement: Parts that are off

The factory SHALL behave as this line says: When a part is off, `doctor` prints `- NAME` under `Parts that are off`, without `: off`.

#### Scenario: Parts that are off

- **WHEN** a part is off
- **THEN** `doctor` prints `- NAME` under `Parts that are off`, without `: off`.

### Requirement: One line per secret

The factory SHALL behave as this line says: When several parts need one secret, `doctor` prints one line for it: `NAME is set, for A and B` with the parts joined as a sentence lists them, or `NAME is not set, for A and B. Run factory init`.

#### Scenario: One line per secret

- **WHEN** several parts need one secret
- **THEN** `doctor` prints one line for it: `NAME is set, for A and B` with the parts joined as a sentence lists them, or `NAME is not set, for A and B. Run factory init`.

### Requirement: Fixes name factory commands

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Fixes name factory commands

- **WHEN** `doctor`, `init`, `sync --check`, `config check`, or a preset command prints a message that names a factory command
- **THEN** it names it `factory X`, not `npx --no-install factory X`: `doctor`'s and `init`'s fixes (`Run factory sync`, `Run factory init`), `init`'s `run factory init again` messages, `config check`'s design-skill warning, `sync --check`'s last line, and the preset commands' `Run: factory init`. The stale-lock messages and `.npmrc`'s sync errors keep `npx --no-install`.

### Requirement: Init's closing checks

The factory SHALL behave as this line says: When `init` prints its closing checks, they sit under `Checks` with `doctor`'s headings indented two spaces and each check indented four.

#### Scenario: Init's closing checks

- **WHEN** `init` prints its closing checks
- **THEN** they sit under `Checks` with `doctor`'s headings indented two spaces and each check indented four.

### Requirement: Config explain's header

The factory SHALL behave as this line says: When `factory config explain` runs, it prints first `# The settings in effect. "# default" marks the factory's own value,` and `# a preset's name marks that preset's, and an unmarked line is yours.`; the lock does not hold these two lines, and in color they are dim, as comment lines are.

#### Scenario: Config explain's header

- **WHEN** `factory config explain` runs
- **THEN** it prints first `# The settings in effect. "# default" marks the factory's own value,` and `# a preset's name marks that preset's, and an unmarked line is yours.`; the lock does not hold these two lines, and in color they are dim, as comment lines are.

### Requirement: Site stop says what it stopped

The factory SHALL behave as this line says: When `factory site stop` stops the sites `site compare --keep` left running, it prints `Stopped the 2 sites site compare --keep left running.`, always 2, since it keeps a before and an after site; when none were left running, `No sites were left running.`

#### Scenario: Site stop says what it stopped

- **WHEN** `factory site stop` stops the sites `site compare --keep` left running
- **THEN** it prints `Stopped the 2 sites site compare --keep left running.`, always 2, since it keeps a before and an after site; when none were left running, `No sites were left running.`

### Requirement: The gate says it passed

The factory SHALL behave as this line says: When every command of `factory gate` passes, it prints `✓ Every gate command passed.` last, on standard output.

#### Scenario: The gate says it passed

- **WHEN** every command of `factory gate` passes
- **THEN** it prints `✓ Every gate command passed.` last, on standard output.

### Requirement: The specs check says how it went

The factory SHALL behave as this line says: When `factory specs check` runs the check, it prints `✓ The specs check passed.` last, on standard output, when the check exits 0, and `✗ The specs check failed.` on standard error otherwise. With `specs.type: none` it prints only `specs are off`.

#### Scenario: The specs check says how it went

- **WHEN** `factory specs check` runs the check
- **THEN** it prints `✓ The specs check passed.` last, on standard output, when the check exits 0, and `✗ The specs check failed.` on standard error otherwise. With `specs.type: none` it prints only `specs are off`.

### Requirement: A test says how it went

The factory SHALL behave as this line says: When `factory test-one` or `factory end-to-end` runs its command, it prints `✓ The test passed.` last on standard output when it passes, for `--times` once, after the last run, when every run passes, and `✗ The test failed.` on standard error when it fails, after `failed on run J of K` for `--times`. When the command is not set, it prints only today's error.

#### Scenario: A test says how it went

- **WHEN** `factory test-one` or `factory end-to-end` runs its command
- **THEN** it prints `✓ The test passed.` last on standard output when it passes, for `--times` once, after the last run, when every run passes, and `✗ The test failed.` on standard error when it fails, after `failed on run J of K` for `--times`. When the command is not set, it prints only today's error.

### Requirement: npm's notices are hidden

The factory SHALL behave as this line says: When `factory gate`, `test-one`, `end-to-end`, or `specs check` runs a settings command, its environment has `npm_config_loglevel=warn` unless the caller's environment sets `npm_config_loglevel`.

#### Scenario: npm's notices are hidden

- **WHEN** `factory gate`, `test-one`, `end-to-end`, or `specs check` runs a settings command
- **THEN** its environment has `npm_config_loglevel=warn` unless the caller's environment sets `npm_config_loglevel`.

### Requirement: Doctor's sign-in line

The factory SHALL behave as this line says: When `doctor` prints its code host's sign-in check, it reads `Signed in as LOGIN`, or fails `Signed in` with the code host's error as its fix.

#### Scenario: Doctor's sign-in line

- **WHEN** `doctor` prints its code host's sign-in check
- **THEN** it reads `Signed in as LOGIN`, or fails `Signed in` with the code host's error as its fix.

### Requirement: Doctor's board line and the sync's log keep their words

The factory SHALL behave as this line says: When `doctor` fails its board check, and when the board sync logs a skipped field or stops on the board's fields, they print today's words, apart from a fix line 25 changes; only `board check`'s report is redesigned.

#### Scenario: Doctor's board line and the sync's log keep their words

- **WHEN** `doctor` fails its board check, and when the board sync logs a skipped field or stops on the board's fields
- **THEN** they print today's words, apart from a fix line 25 changes; only `board check`'s report is redesigned.

### Requirement: Marks on the new lines are colored

The factory SHALL behave as this line says: When a line this capability adds starts with `✓` or `✗`, the mark is colored as `doctor`'s are and the text after it is not; headings are not colored.

#### Scenario: Marks on the new lines are colored

- **WHEN** a line this capability adds starts with `✓` or `✗`
- **THEN** the mark is colored as `doctor`'s are and the text after it is not; headings are not colored.
