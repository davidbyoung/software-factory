# spec-tools Specification

## Purpose

The `lunamill specs` commands, `list`, `new`, `check`, and `finish`, through which every skill reaches the spec tool `specs` names, and what each prints when `specs` is `none`, so no skill runs a spec tool itself and a second tool needs only an adapter.

## Requirements

### Requirement: Spec commands with no spec tool

lunamill SHALL behave as this line says: When `specs` is `none`, `lunamill specs list`, `lunamill specs new N`, `lunamill specs check`, and `lunamill specs finish N` each print `- No spec tool (specs: none): each ticket holds its own spec.` and exit 0.

#### Scenario: Spec commands with no spec tool

- **WHEN** `specs` is `none`
- **THEN** `lunamill specs list`, `lunamill specs new N`, `lunamill specs check`, and `lunamill specs finish N` each print `- No spec tool (specs: none): each ticket holds its own spec.` and exit 0.

### Requirement: Listing the specs

lunamill SHALL behave as this line says: When `specs` is `openspec`, `lunamill specs list` prints `specs: openspec`, then one line per folder under `openspec/specs/`, sorted by name: two spaces, the folder's name, and its `spec.md` path, the paths aligned in one column. It exits 0.

#### Scenario: Listing the specs

- **WHEN** `specs` is `openspec`
- **THEN** `lunamill specs list` prints `specs: openspec`, then one line per folder under `openspec/specs/`, sorted by name: two spaces, the folder's name, and its `spec.md` path, the paths aligned in one column. It exits 0.

### Requirement: Listing no specs yet

lunamill SHALL behave as this line says: When `specs` is `openspec` and `openspec/specs/` holds no spec, `lunamill specs list` prints `specs: openspec` and `  none yet`, and exits 0.

#### Scenario: Listing no specs yet

- **WHEN** `specs` is `openspec` and `openspec/specs/` holds no spec
- **THEN** `lunamill specs list` prints `specs: openspec` and `  none yet`, and exits 0.

### Requirement: Starting a ticket's spec

lunamill SHALL behave as this line says: When `specs` is `openspec`, OpenSpec runs, and `openspec/changes/issue-N/` does not exist, `lunamill specs new N` creates that change with OpenSpec, prints `Started ticket N's spec in openspec/changes/issue-N/`, then `Write each file from ticket N's body:`, then one line per file, and last `Then: lunamill specs check`, and exits 0.

#### Scenario: Starting a ticket's spec

- **WHEN** `specs` is `openspec`, OpenSpec runs, and `openspec/changes/issue-N/` does not exist
- **THEN** `lunamill specs new N` creates that change with OpenSpec, prints `Started ticket N's spec in openspec/changes/issue-N/`, then `Write each file from ticket N's body:`, then one line per file, and last `Then: lunamill specs check`, and exits 0.

### Requirement: The files of a spec ticket

lunamill SHALL list, for a ticket with the `spec` label, four files, `proposal.md`, `specs/CAPABILITY/spec.md`, `design.md`, and `tasks.md`, each on one line marked `new`, with the path padded and the description as the scenario gives them.

#### Scenario: The files of a spec ticket

- **WHEN** ticket N has the `spec` label
- **THEN** When ticket N has the `spec` label, line 4's file lines are these four, in order, each on one line with no wrapping: two spaces, `new`, two spaces, the path padded with spaces to the longest path's width plus two, then the description:
- `proposal.md`: `The owner's text and Decisions, linking ticket N`
- `specs/CAPABILITY/spec.md`: `One per heading under Spec: ADDED for (new), MODIFIED for (modified), REMOVED for each "No longer" line; each numbered line is one requirement whose SHALL sentence restates it, with one scenario whose WHEN is the line's "When" clause and whose THEN is the rest`
- `design.md`: `Design, under For the builder`
- `tasks.md`: `Tasks, under For the builder`

### Requirement: The files of a ticket without the spec label

lunamill SHALL behave as this line says: When ticket N has no `spec` label, line 4's list has only `proposal.md` and `specs/CAPABILITY/spec.md`.

#### Scenario: The files of a ticket without the spec label

- **WHEN** ticket N has no `spec` label
- **THEN** Line 4's list has only `proposal.md` and `specs/CAPABILITY/spec.md`.

### Requirement: A spec already started

lunamill SHALL behave as this line says: When `specs` is `openspec`, OpenSpec runs, and `openspec/changes/issue-N/` exists, `lunamill specs new N` prints `Ticket N's spec is already started in openspec/changes/issue-N/`, then line 4's list, changes no file, and exits 0.

#### Scenario: A spec already started

- **WHEN** `specs` is `openspec`, OpenSpec runs, and `openspec/changes/issue-N/` exists
- **THEN** `lunamill specs new N` prints `Ticket N's spec is already started in openspec/changes/issue-N/`, then line 4's list, changes no file, and exits 0.

### Requirement: OpenSpec not installed

lunamill SHALL behave as this line says: When `specs` is `openspec` and OpenSpec does not run, `lunamill specs new N` prints `✗ OpenSpec is not installed: run lunamill init, which installs it.` on standard error, creates nothing, and exits 1.

#### Scenario: OpenSpec not installed

- **WHEN** `specs` is `openspec` and OpenSpec does not run
- **THEN** `lunamill specs new N` prints `✗ OpenSpec is not installed: run lunamill init, which installs it.` on standard error, creates nothing, and exits 1.

### Requirement: Finishing a ticket's spec

lunamill SHALL behave as this line says: When `specs` is `openspec` and `openspec/changes/issue-N/` exists, `lunamill specs finish N` archives it with OpenSpec, prints `✓ Folded ticket N's spec into openspec/specs/.`, commits nothing, and exits 0.

#### Scenario: Finishing a ticket's spec

- **WHEN** `specs` is `openspec` and `openspec/changes/issue-N/` exists
- **THEN** `lunamill specs finish N` archives it with OpenSpec, prints `✓ Folded ticket N's spec into openspec/specs/.`, commits nothing, and exits 0.

### Requirement: A spec already folded

lunamill SHALL behave as this line says: When `specs` is `openspec`, `openspec/changes/issue-N/` does not exist, and `openspec/changes/archive/` holds a folder ending `-issue-N`, `lunamill specs finish N` prints `✓ Ticket N's spec is already folded into openspec/specs/.` and exits 0.

#### Scenario: A spec already folded

- **WHEN** `specs` is `openspec`, `openspec/changes/issue-N/` does not exist, and `openspec/changes/archive/` holds a folder ending `-issue-N`
- **THEN** `lunamill specs finish N` prints `✓ Ticket N's spec is already folded into openspec/specs/.` and exits 0.

### Requirement: Finishing a spec never started

lunamill SHALL behave as this line says: When `specs` is `openspec` and ticket N has no change, open or archived, `lunamill specs finish N` prints `✗ Ticket N has no spec started: run lunamill specs new N first.` on standard error and exits 1.

#### Scenario: Finishing a spec never started

- **WHEN** `specs` is `openspec` and ticket N has no change, open or archived
- **THEN** `lunamill specs finish N` prints `✗ Ticket N has no spec started: run lunamill specs new N first.` on standard error and exits 1.

### Requirement: A fold that fails

lunamill SHALL behave as this line says: When OpenSpec's archive exits non-zero, `lunamill specs finish N` passes its output through, prints `✗ Could not fold ticket N's spec into openspec/specs/.` on standard error, and exits 1.

#### Scenario: A fold that fails

- **WHEN** OpenSpec's archive exits non-zero
- **THEN** `lunamill specs finish N` passes its output through, prints `✗ Could not fold ticket N's spec into openspec/specs/.` on standard error, and exits 1.

### Requirement: The spec commands' arguments and order

lunamill SHALL check each `lunamill specs` command's arguments before anything else, exiting 2 with its usage line on a bad one, and SHALL check `lunamill specs new N`'s conditions in the order the scenario gives.

#### Scenario: The spec commands' arguments and order

- **WHEN** a `lunamill specs` command runs
- **THEN** Each `lunamill specs` command checks its arguments before anything else, whatever `specs` is: `new` and `finish` given anything but one argument the ticket system reads as a ticket's identifier (with GitHub, a positive whole number), and `list` or `check` given any argument, print `Usage: lunamill specs new N`, `Usage: lunamill specs finish N`, `Usage: lunamill specs list`, or `Usage: lunamill specs check` on standard error and exit 2. After its arguments, `lunamill specs new N` checks, in order, and stops at the first that applies: `specs` is `none` (line 1); ticket N does not exist (the ticket system's not-found message, as `lunamill ticket view N` prints it, exit 1); OpenSpec does not run (line 8); the change exists (line 7); otherwise line 4.

### Requirement: OpenSpec runs without tracking

lunamill SHALL behave as this line says: Every OpenSpec command lunamill runs, in `new`, `check`, and `finish`, has `DO_NOT_TRACK=1` in its environment.

#### Scenario: OpenSpec runs without tracking

- **WHEN** lunamill runs an OpenSpec command
- **THEN** Every OpenSpec command lunamill runs, in `new`, `check`, and `finish`, has `DO_NOT_TRACK=1` in its environment.

### Requirement: No skill runs OpenSpec itself

lunamill SHALL behave as this line says: When lunamill's skills, agents, rules, review instructions, workflows, and actions are read, none runs `openspec` itself; a test fails on a line that does, as it does today for `gh issue`.

#### Scenario: No skill runs OpenSpec itself

- **WHEN** lunamill's skills, agents, rules, review instructions, workflows, and actions are read
- **THEN** None runs `openspec` itself; a test fails on a line that does, as it does today for `gh issue`.

### Requirement: The spec commands in the command list

lunamill SHALL behave as this line says: When `lunamill` prints its list of commands, "Your repository's commands" has `specs list`, `specs new N`, `specs check`, and `specs finish N`, and no `specs change-name N`.

#### Scenario: The spec commands in the command list

- **WHEN** `lunamill` prints its list of commands
- **THEN** "Your repository's commands" has `specs list`, `specs new N`, `specs check`, and `specs finish N`, and no `specs change-name N`.
