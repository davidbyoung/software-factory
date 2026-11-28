# commands Specification

## Purpose

The `commands` block of the settings, which holds every command a build runs, and lunamill's commands that run them: `lunamill gate`, `lunamill test-one`, `lunamill end-to-end`, and `lunamill specs check`.

## Requirements

### Requirement: The commands' defaults

lunamill SHALL behave as this line says: When `commands` is not written, `commands.build-setup`, `commands.before-commit`, and `commands.gate` are empty lists, `commands.test-one`, `commands.end-to-end`, and `commands.coverage` are not set, and `commands.relock` is `npm install`.

#### Scenario: The commands' defaults

- **WHEN** `commands` is not written
- **THEN** `commands.build-setup`, `commands.before-commit`, and `commands.gate` are empty lists, `commands.test-one`, `commands.end-to-end`, and `commands.coverage` are not set, and `commands.relock` is `npm install`.

### Requirement: A command list that is not a list

lunamill SHALL behave as this line says: When `commands.build-setup`, `commands.before-commit`, or `commands.gate` is anything but a list of text and items, `lunamill config check` fails, naming the key.

#### Scenario: A command list that is not a list

- **WHEN** When `commands.build-setup`, `commands.before-commit`, or `commands.gate` is anything but a list of text and items
- **THEN** `lunamill config check` fails, naming the key.

### Requirement: A command that is not text

lunamill SHALL behave as this line says: When `commands.test-one`, `commands.end-to-end`, or `commands.relock` is neither text that is not empty nor a list of text and items, `lunamill config check` fails with `.claude/lunamill.yaml: commands.KEY: must be text`.

#### Scenario: A command that is not text

- **WHEN** When `commands.test-one`, `commands.end-to-end`, or `commands.relock` is neither text that is not empty nor a list of text and items
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: commands.KEY: must be text`.

### Requirement: Coverage needs both keys

lunamill SHALL behave as this line says: When `commands.coverage` is one map written without `run` or without `report`, or a list holds an item without `report`, `lunamill config check` fails with `.claude/lunamill.yaml: commands.coverage.KEY: is required when commands.coverage is written`, or for the list `.claude/lunamill.yaml: commands.coverage[N].report: is required in a list`.

#### Scenario: Coverage needs both keys

- **WHEN** When `commands.coverage` is one map written without `run` or without `report`, or a list holds an item without `report`
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: commands.coverage.KEY: is required when commands.coverage is written`, or for the list `.claude/lunamill.yaml: commands.coverage[N].report: is required in a list`.

### Requirement: Config get a command

lunamill SHALL behave as this line says: When `lunamill config get commands.KEY` runs for `build-setup`, `before-commit`, `gate`, `test-one`, `end-to-end`, `relock`, `coverage.run`, or `coverage.report`, it prints the value, one line per command for a list, an item as `cd FOLDER && COMMAND` once for each of its folders, nothing for an empty list, and `none` for a key that is not set; `coverage.run` and `coverage.report` fail on a list, naming `lunamill coverage`.

#### Scenario: Config get a command

- **WHEN** When `lunamill config get commands.KEY` runs for `build-setup`, `before-commit`, `gate`, `test-one`, `end-to-end`, `relock`, `coverage.run`, or `coverage.report`
- **THEN** it prints the value, one line per command for a list, an item as `cd FOLDER && COMMAND` once for each of its folders, nothing for an empty list, and `none` for a key that is not set; `coverage.run` and `coverage.report` fail on a list, naming `lunamill coverage`.

### Requirement: The commit guard runs before-commit

lunamill SHALL behave as this line says: When a session runs `git commit`, the commit guard runs each `commands.before-commit` command the change sets off, in order, text from the repository's root and an item in each of its folders, and blocks the commit after the first that fails, an item finishing its other folders, with `the gate failed on: COMMAND. Fix the errors above, then commit.`, naming each command that failed.

#### Scenario: The commit guard runs before-commit

- **WHEN** When a session runs `git commit`
- **THEN** the commit guard runs each `commands.before-commit` command the change sets off, in order, text from the repository's root and an item in each of its folders, and blocks the commit after the first that fails, an item finishing its other folders, with `the gate failed on: COMMAND. Fix the errors above, then commit.`, naming each command that failed.

### Requirement: The build action runs build-setup

lunamill SHALL behave as this line says: When an unattended build starts, the session's job runs `lunamill build-setup` before the session, which runs each `commands.build-setup` command in order, text from the root and an item in each of its folders, and the run stops after the first that fails.

#### Scenario: The build action runs build-setup

- **WHEN** When an unattended build starts
- **THEN** the session's job runs `lunamill build-setup` before the session, which runs each `commands.build-setup` command in order, text from the root and an item in each of its folders, and the run stops after the first that fails.

### Requirement: The gate passes

lunamill SHALL behave as this line says: When `lunamill gate` runs and `commands.gate` is set, it runs each command the change sets off, in order, text from the repository's root and an item in each of its folders, prints `$ COMMAND` before each, passes its output through, and when every command exits 0, prints its closing line and exits 0.

#### Scenario: The gate passes

- **WHEN** When `lunamill gate` runs and `commands.gate` is set
- **THEN** it runs each command the change sets off, in order, text from the repository's root and an item in each of its folders, prints `$ COMMAND` before each, passes its output through, and when every command exits 0, prints its closing line and exits 0.

### Requirement: The gate fails

lunamill SHALL behave as this line says: When a command of the gate fails, `lunamill gate` runs no command after it but the same item's other folders, prints `✗ The gate failed on: COMMAND` on standard error, or for an item that failed in several folders `✗ The gate failed in F of the N folders COMMAND ran in:` and each command, and exits 1.

#### Scenario: The gate fails

- **WHEN** When a command of the gate fails
- **THEN** `lunamill gate` runs no command after it but the same item's other folders, prints `✗ The gate failed on: COMMAND` on standard error, or for an item that failed in several folders `✗ The gate failed in F of the N folders COMMAND ran in:` and each command, and exits 1.

### Requirement: No gate is set

lunamill SHALL behave as this line says: When `lunamill gate` runs and `commands.gate` is empty, it prints `commands.gate is not set: add the commands that check a change to .claude/lunamill.yaml` on standard error and exits 1.

#### Scenario: No gate is set

- **WHEN** `lunamill gate` runs and `commands.gate` is empty
- **THEN** it prints `commands.gate is not set: add the commands that check a change to .claude/lunamill.yaml` on standard error and exits 1.

### Requirement: One test alone

lunamill SHALL behave as this line says: When `lunamill test-one FILE` or `lunamill test-one FILE NAME` runs and `commands.test-one` is set, it runs the command that covers FILE, text from the repository's root and an item in its folder with `FILE` from that folder, with `FILE` and `NAME` in its environment, `NAME` empty when none is given, passes its output through, and exits with its status.

#### Scenario: One test alone

- **WHEN** When `lunamill test-one FILE` or `lunamill test-one FILE NAME` runs and `commands.test-one` is set
- **THEN** it runs the command that covers FILE, text from the repository's root and an item in its folder with `FILE` from that folder, with `FILE` and `NAME` in its environment, `NAME` empty when none is given, passes its output through, and exits with its status.

### Requirement: No test-one command

lunamill SHALL behave as this line says: When `lunamill test-one FILE` runs and `commands.test-one` is not set, it prints `commands.test-one is not set` on standard error and exits 1.

#### Scenario: No test-one command

- **WHEN** `lunamill test-one FILE` runs and `commands.test-one` is not set
- **THEN** it prints `commands.test-one is not set` on standard error and exits 1.

### Requirement: Test-one without a file

lunamill SHALL behave as this line says: When `lunamill test-one` runs with no FILE, it prints its usage on standard error and exits 2.

#### Scenario: Test-one without a file

- **WHEN** `lunamill test-one` runs with no FILE
- **THEN** it prints its usage on standard error and exits 2.

### Requirement: One end-to-end spec

lunamill SHALL behave as this line says: When `lunamill end-to-end FILE` runs and `commands.end-to-end` is set, it runs the command that covers FILE once, text from the repository's root and an item in its folder with `FILE` from that folder, with `FILE` in its environment, passes its output through, and exits with its status.

#### Scenario: One end-to-end spec

- **WHEN** When `lunamill end-to-end FILE` runs and `commands.end-to-end` is set
- **THEN** it runs the command that covers FILE once, text from the repository's root and an item in its folder with `FILE` from that folder, with `FILE` in its environment, passes its output through, and exits with its status.

### Requirement: An end-to-end spec repeated

lunamill SHALL behave as this line says: When `lunamill end-to-end FILE --times K` runs, it runs the command that covers FILE K times in a row, in its folder, stops at the first run that fails, prints `failed on run J of K` on standard error, and exits 1; when every run passes it exits 0.

#### Scenario: An end-to-end spec repeated

- **WHEN** When `lunamill end-to-end FILE --times K` runs
- **THEN** it runs the command that covers FILE K times in a row, in its folder, stops at the first run that fails, prints `failed on run J of K` on standard error, and exits 1; when every run passes it exits 0.

### Requirement: No end-to-end command

lunamill SHALL behave as this line says: When `lunamill end-to-end FILE` runs and `commands.end-to-end` is not set, it prints `commands.end-to-end is not set` on standard error and exits 1.

#### Scenario: No end-to-end command

- **WHEN** `lunamill end-to-end FILE` runs and `commands.end-to-end` is not set
- **THEN** it prints `commands.end-to-end is not set` on standard error and exits 1.

### Requirement: The spec check runs

lunamill SHALL behave as this line says: When `lunamill specs check` runs and `specs.type` is `openspec`, it runs `specs.check` from the repository's root with `DO_NOT_TRACK=1` in its environment, passes its output through, and exits with its status.

#### Scenario: The spec check runs

- **WHEN** `lunamill specs check` runs and `specs.type` is `openspec`
- **THEN** it runs `specs.check` from the repository's root with `DO_NOT_TRACK=1` in its environment, passes its output through, and exits with its status.

### Requirement: Commands end with a line of their own

lunamill SHALL behave as this line says: `test-one`, `end-to-end`, and `specs check` pass their command's output through, then print line 30's or 31's line, and exit with its status.

#### Scenario: Commands end with a line of their own

- **WHEN** `test-one`, `end-to-end`, or `specs check` runs its command
- **THEN** `test-one`, `end-to-end`, and `specs check` pass their command's output through, then print line 30's or 31's line, and exit with its status.

### Requirement: The spec check with no spec tool

lunamill SHALL behave as this line says: When `lunamill specs check` runs and `specs.type` is `none`, it prints `- No spec tool (specs: none): each ticket holds its own spec.` and exits 0.

#### Scenario: The spec check with no spec tool

- **WHEN** `lunamill specs check` runs and `specs.type` is `none`
- **THEN** It prints `- No spec tool (specs: none): each ticket holds its own spec.` and exits 0.

### Requirement: The gate's plan

lunamill SHALL behave as this line says: When `lunamill gate` runs and a gate command is an item, it first prints `commands.gate: R of T run, for the K files changed since origin/DEFAULT`, a row for each command that runs with its reason, or `every change` for text, and `- L left out, since this change touches none of their files: lunamill gate --dry-run lists each` when L is above 0.

#### Scenario: The gate's plan

- **WHEN** When `lunamill gate` runs and a gate command is an item
- **THEN** it first prints `commands.gate: R of T run, for the K files changed since origin/DEFAULT`, a row for each command that runs with its reason, or `every change` for text, and `- L left out, since this change touches none of their files: lunamill gate --dry-run lists each` when L is above 0.

### Requirement: An item's row

lunamill SHALL behave as this line says: When an item runs in more than one folder, its row is `COMMAND, in each of the N folders of IN` with its reason.

#### Scenario: An item's row

- **WHEN** When an item runs in more than one folder
- **THEN** its row is `COMMAND, in each of the N folders of IN` with its reason.

### Requirement: A command with in is printed with cd

lunamill SHALL behave as this line says: When a command has `in`, it is printed as `cd FOLDER && COMMAND` in its row, before it runs, in a failure line, and by `lunamill config get`.

#### Scenario: A command with in is printed with cd

- **WHEN** When a command has `in`
- **THEN** it is printed as `cd FOLDER && COMMAND` in its row, before it runs, in a failure line, and by `lunamill config get`.

### Requirement: The gate's closing line with commands left out

lunamill SHALL behave as this line says: When every command that ran passed and some were left out, `lunamill gate` ends with `✓ Every gate command that ran passed: R run, L left out.`

#### Scenario: The gate's closing line with commands left out

- **WHEN** When every command that ran passed and some were left out
- **THEN** `lunamill gate` ends with `✓ Every gate command that ran passed: R run, L left out.`

### Requirement: The gate's first line when a file nothing covers changed

lunamill SHALL behave as this line says: When the gate has an item and a changed file is covered by nothing, the first line is `commands.gate: all T run, since N changed files are in no gate command's files and not in commands.ignore`, followed by each such file on its own line: at most ten, then `and N more: lunamill gate --dry-run lists each`, and every one with `--dry-run`.

#### Scenario: The gate's first line when a file nothing covers changed

- **WHEN** When the gate has an item and a changed file is covered by nothing
- **THEN** the first line is `commands.gate: all T run, since N changed files are in no gate command's files and not in commands.ignore`, followed by each such file on its own line: at most ten, then `and N more: lunamill gate --dry-run lists each`, and every one with `--dry-run`.

### Requirement: The gate's first line when the settings changed

lunamill SHALL behave as this line says: When a settings file changed, the first line is `commands.gate: all T run, since PATH changed`.

#### Scenario: The gate's first line when the settings changed

- **WHEN** When a settings file changed
- **THEN** the first line is `commands.gate: all T run, since PATH changed`.

### Requirement: An item that fails in several folders

lunamill SHALL behave as this line says: When an item fails in several folders, `lunamill gate` ends with `✗ The gate failed in F of the N folders COMMAND ran in:` and each `cd FOLDER && COMMAND` on its own line, and exits 1.

#### Scenario: An item that fails in several folders

- **WHEN** When an item fails in several folders
- **THEN** `lunamill gate` ends with `✗ The gate failed in F of the N folders COMMAND ran in:` and each `cd FOLDER && COMMAND` on its own line, and exits 1.

### Requirement: The gate when only ignored files changed

lunamill SHALL behave as this line says: When only ignored files changed, the first lines are `commands.gate: R of T run, for the K files changed since origin/DEFAULT, which commands.ignore lists`, a row for each text command, and `- L left out, since commands.ignore lists every changed file`; with no text command it ends with `✓ No gate command needs to run: every changed file is in commands.ignore.`; it exits 0.

#### Scenario: The gate when only ignored files changed

- **WHEN** When only ignored files changed
- **THEN** the first lines are `commands.gate: R of T run, for the K files changed since origin/DEFAULT, which commands.ignore lists`, a row for each text command, and `- L left out, since commands.ignore lists every changed file`; with no text command it ends with `✓ No gate command needs to run: every changed file is in commands.ignore.`; it exits 0.

### Requirement: The gate when nothing changed

lunamill SHALL behave as this line says: When nothing changed since the merge base, it prints `commands.gate: 0 of T run, since nothing changed since origin/DEFAULT` and `✓ Nothing to check.`, and exits 0.

#### Scenario: The gate when nothing changed

- **WHEN** When nothing changed since the merge base
- **THEN** it prints `commands.gate: 0 of T run, since nothing changed since origin/DEFAULT` and `✓ Nothing to check.`, and exits 0.

### Requirement: Gate dry run

lunamill SHALL behave as this line says: When `lunamill gate --dry-run` runs, it prints the first line with `would run`, then for every command a row of `runs` or `left out`, the command, and why: the reason, `every change`, or `no change in` and the item's patterns joined as a list ending in "or"; it runs nothing and exits 0.

#### Scenario: Gate dry run

- **WHEN** When `lunamill gate --dry-run` runs
- **THEN** it prints the first line with `would run`, then for every command a row of `runs` or `left out`, the command, and why: the reason, `every change`, or `no change in` and the item's patterns joined as a list ending in "or"; it runs nothing and exits 0.

### Requirement: Gate all

lunamill SHALL behave as this line says: When `lunamill gate --all` runs, it prints `commands.gate: all T run, as --all asks` and runs every command, each in its folders.

#### Scenario: Gate all

- **WHEN** When `lunamill gate --all` runs
- **THEN** it prints `commands.gate: all T run, as --all asks` and runs every command, each in its folders.

### Requirement: Test-one picks a command

lunamill SHALL behave as this line says: When `lunamill test-one FILE` runs and `commands.test-one` is a list, it runs the first command that covers FILE (FILE in one of its folders and matching its `files`; or no `in` and its `files` match; or text), in that folder, with `FILE` from that folder, after `commands.test-one: cd FOLDER, with FILE=PATH`.

#### Scenario: Test-one picks a command

- **WHEN** When `lunamill test-one FILE` runs and `commands.test-one` is a list
- **THEN** it runs the first command that covers FILE (FILE in one of its folders and matching its `files`; or no `in` and its `files` match; or text), in that folder, with `FILE` from that folder, after `commands.test-one: cd FOLDER, with FILE=PATH`.

### Requirement: No command covers the test file

lunamill SHALL behave as this line says: When no command in the list covers FILE, `lunamill test-one` prints `✗ No commands.test-one command covers FILE: add one whose files cover it to .claude/lunamill.yaml` on standard error and exits 1. `lunamill end-to-end` does the same for `commands.end-to-end`, `--times` included.

#### Scenario: No command covers the test file

- **WHEN** When no command in the list covers FILE
- **THEN** `lunamill test-one` prints `✗ No commands.test-one command covers FILE: add one whose files cover it to .claude/lunamill.yaml` on standard error and exits 1. `lunamill end-to-end` does the same for `commands.end-to-end`, `--times` included.

### Requirement: Factory coverage

lunamill SHALL behave as this line says: When `lunamill coverage` runs, it runs the coverage commands the change sets off, with the plan lines of line 27 headed `commands.coverage`, then reads each report with its command's folder as the base of its paths, and prints the lines that `git diff -U0` from the merge base to the working tree adds or changes and no test covers, as `lunamill pr uncovered` prints them.

#### Scenario: Factory coverage

- **WHEN** When `lunamill coverage` runs
- **THEN** it runs the coverage commands the change sets off, with the plan lines of line 27 headed `commands.coverage`, then reads each report with its command's folder as the base of its paths, and prints the lines that `git diff -U0` from the merge base to the working tree adds or changes and no test covers, as `lunamill pr uncovered` prints them.

### Requirement: Coverage's closing line

lunamill SHALL behave as this line says: When every such line is covered, `lunamill coverage` ends with `✓ Coverage ran: every line the branch changed is covered.`; otherwise with `✓ Coverage ran: N lines the branch changed are not covered, in F files.`; both exit 0.

#### Scenario: Coverage's closing line

- **WHEN** When every such line is covered
- **THEN** `lunamill coverage` ends with `✓ Coverage ran: every line the branch changed is covered.`; otherwise with `✓ Coverage ran: N lines the branch changed are not covered, in F files.`; both exit 0.

### Requirement: A coverage command fails

lunamill SHALL behave as this line says: When a coverage command fails, `lunamill coverage` ends with `✗ Coverage failed on: COMMAND`, or for an item in several folders `✗ Coverage failed in F of the N folders COMMAND ran in:` and each command, and exits 1.

#### Scenario: A coverage command fails

- **WHEN** When a coverage command fails
- **THEN** `lunamill coverage` ends with `✗ Coverage failed on: COMMAND`, or for an item in several folders `✗ Coverage failed in F of the N folders COMMAND ran in:` and each command, and exits 1.

### Requirement: Coverage without a base

lunamill SHALL behave as this line says: When `lunamill coverage` can't find the merge base, it runs nothing, prints `✗ Can't tell which lines changed, since there is no origin/DEFAULT to compare with.` and the fetch line, and exits 1.

#### Scenario: Coverage without a base

- **WHEN** When `lunamill coverage` can't find the merge base
- **THEN** it runs nothing, prints `✗ Can't tell which lines changed, since there is no origin/DEFAULT to compare with.` and the fetch line, and exits 1.

### Requirement: No coverage command

lunamill SHALL behave as this line says: When `commands.coverage` is not set, `lunamill coverage` prints `- No coverage command (commands.coverage is not set).` and exits 0.

#### Scenario: No coverage command

- **WHEN** When `commands.coverage` is not set
- **THEN** `lunamill coverage` prints `- No coverage command (commands.coverage is not set).` and exits 0.

### Requirement: Factory relock

lunamill SHALL behave as this line says: When `lunamill relock` runs, it runs the relock commands the change sets off, with the plan lines headed `commands.relock` and `for the K files that differ from origin/DEFAULT`, and ends with `✓ Every relock command that ran passed: R run, L left out.`, or `✗ Relock failed on:` as line 42 words it; `--all` runs every one; text, such as the default `npm install`, runs every time.

#### Scenario: Factory relock

- **WHEN** When `lunamill relock` runs
- **THEN** it runs the relock commands the change sets off, with the plan lines headed `commands.relock` and `for the K files that differ from origin/DEFAULT`, and ends with `✓ Every relock command that ran passed: R run, L left out.`, or `✗ Relock failed on:` as line 42 words it; `--all` runs every one; text, such as the default `npm install`, runs every time.

### Requirement: Relock runs every command

lunamill SHALL behave as this line says: When the gate has an item and a file nothing covers or a settings file changed, `lunamill relock`'s first line is `commands.relock: all T run, since` and the reason as lines 31 and 32 word it.

#### Scenario: Relock runs every command

- **WHEN** When the gate has an item and a file nothing covers or a settings file changed
- **THEN** `lunamill relock`'s first line is `commands.relock: all T run, since` and the reason as lines 31 and 32 word it.

### Requirement: Factory build-setup

lunamill SHALL behave as this line says: When `lunamill build-setup` runs, it runs every `commands.build-setup` command, each in its folders, prints `$ cd FOLDER && COMMAND` before each, stops after the first command that fails (an item finishing its other folders), and exits with its status.

#### Scenario: Factory build-setup

- **WHEN** When `lunamill build-setup` runs
- **THEN** it runs every `commands.build-setup` command, each in its folders, prints `$ cd FOLDER && COMMAND` before each, stops after the first command that fails (an item finishing its other folders), and exits with its status.

### Requirement: Dry run on the new commands

lunamill SHALL behave as this line says: When `lunamill coverage`, `lunamill relock`, or `lunamill build-setup` runs with `--dry-run`, it prints its plan as line 36 does and runs nothing; `--all` exists on `lunamill gate` and `lunamill relock` only.

#### Scenario: Dry run on the new commands

- **WHEN** When `lunamill coverage`
- **THEN** `lunamill relock`, or `lunamill build-setup` runs with `--dry-run`, it prints its plan as line 36 does and runs nothing; `--all` exists on `lunamill gate` and `lunamill relock` only.

### Requirement: Before-commit fails in several folders

lunamill SHALL behave as this line says: When an item in `commands.before-commit` fails in several folders, the commit guard blocks the commit with `the gate failed on: COMMAND, COMMAND. Fix the errors above, then commit.`, and it prints no plan.

#### Scenario: Before-commit fails in several folders

- **WHEN** When an item in `commands.before-commit` fails in several folders
- **THEN** the commit guard blocks the commit with `the gate failed on: COMMAND, COMMAND. Fix the errors above, then commit.`, and it prints no plan.

### Requirement: Config get a setting with items

lunamill SHALL behave as this line says: When `lunamill config get commands.KEY` prints a setting with items, it prints one line per command as line 29 writes it, folders expanded. `lunamill config get commands.coverage.run` and `.report` print as today for one coverage map, and fail on a list, naming `lunamill coverage`.

#### Scenario: Config get a setting with items

- **WHEN** When `lunamill config get commands.KEY` prints a setting with items
- **THEN** it prints one line per command as line 29 writes it, folders expanded. `lunamill config get commands.coverage.run` and `.report` print as today for one coverage map, and fail on a list, naming `lunamill coverage`.
