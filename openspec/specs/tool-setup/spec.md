# tool-setup Specification

## Purpose

What `factory init`, `factory doctor`, and `factory config check` ask of each tool (code host, ticket system, runner, and coding agent) to set it up and check its secrets, so a new tool needs no edit to them.

## Requirements

### Requirement: Init is unchanged with today's tools

`factory init` SHALL print the same lines and ask the same questions, in
the same order, as before this change when it runs with GitHub, GitHub
Issues, GitHub Actions, and Claude Code.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** it prints the same lines and asks the same questions, in the same order, as before this change. This holds for a first run with every part chosen, a re-run with every part on and every secret set, and each case the existing tests in `tests/init.test.ts` cover, except the one edge under Decisions. An existing test of the old behavior there takes 1.3's expectation. The `Checks` that `init` ends with also show line 25's configuration lines.

### Requirement: A ticket system's value

`init` SHALL ask for a value the ticket system in use declares, and write
it under `tickets` in `.claude/factory.yaml`.

#### Scenario: A ticket system's value

- **WHEN** the ticket system in use declares a value it needs, such as a site address
- **THEN** `init` asks for it after the parts are chosen and writes it under `tickets` in `.claude/factory.yaml`. The plan's `Write` line for the settings file is there.

### Requirement: A value already set

`init` SHALL NOT ask again for a value already in the settings.

#### Scenario: A value already set

- **WHEN** a re-run finds that value already in the settings
- **THEN** `init` does not ask for it.

### Requirement: A tool's secret

`init` SHALL get a secret a tool needs the way the tool says, and store it
through the runner under each name the tool gives.

#### Scenario: A tool's secret

- **WHEN** a tool needs a secret that is not set
- **THEN** `init` prints the tool's introduction, opens the tool's page and prints its address, or runs the tool's command attached to the terminal, then reads the value in a masked prompt with the tool's prompt text. It stores the value through the runner under each name the tool gives. The plan's `Secrets` line lists those names before anything changes.

### Requirement: A refused secret

`init` SHALL print a tool's reason for refusing a pasted secret and ask
again.

#### Scenario: A refused secret

- **WHEN** a tool checks a pasted secret and refuses it
- **THEN** `init` prints the tool's reason, as the tool words it, and asks again.

### Requirement: A secret left for later

`init` SHALL store nothing when nothing is pasted for a tool's secret.

#### Scenario: A secret left for later

- **WHEN** nothing is pasted for a tool's secret
- **THEN** `init` stores nothing and prints the tool's line for that, followed by `Run npx --no-install factory init again to add it.`

### Requirement: A secret already set

`init` SHALL ask for a tool's secret that is already set only when told to
replace the secrets.

#### Scenario: A secret already set

- **WHEN** a re-run finds a tool's secret already set
- **THEN** `init` counts it in "N secrets these parts read are already set. Replace them?" and asks for it only when the answer is yes.

### Requirement: Choosing among tools

`init` SHALL ask which ticket system or runner to use only when more than
one is available.

#### Scenario: Choosing among tools

- **WHEN** more than one ticket system or runner is available
- **THEN** `init` asks which, right after `Found`, with the one the settings name chosen by default, and writes its name to `tickets.type` or `builds.runner`. With one available, it asks nothing and names it under `Found`, as today.

### Requirement: An unsupported code host

`init` SHALL name every code host it supports when the origin remote is on
none of them.

#### Scenario: An unsupported code host

- **WHEN** the origin remote is on no code host the factory supports
- **THEN** `init` says so and names every one it supports, as a list ("A, B, and C").

### Requirement: Doctor is unchanged with today's tools

`factory doctor` SHALL print the same lines as before this change with
today's tools, plus the configuration lines.

#### Scenario: Doctor is unchanged with today's tools

- **WHEN** `factory doctor` runs with today's tools
- **THEN** its lines are the same as before this change, plus line 25's configuration lines.

### Requirement: A tool's secret not set

`doctor` SHALL fail on a secret a tool needs that is not set.

#### Scenario: A tool's secret not set

- **WHEN** a secret a tool always needs, or needs for a part that is on, is not set
- **THEN** `doctor` fails with `NAME is not set, for <the part, or the tool's name>` and the fix `Run npx --no-install factory init`.

### Requirement: A tool's own check

`doctor` SHALL print a tool's failing check in the tool's words and exit
non-zero.

#### Scenario: A tool's own check

- **WHEN** a tool's own check fails, such as a site that cannot be reached
- **THEN** `doctor` prints the failure and fix in the tool's words, and exits non-zero.

### Requirement: The names of tools

`factory config check` SHALL accept exactly the names of each kind's
available tools.

#### Scenario: The names of tools

- **WHEN** `factory config check` reads `tickets.type`, `code-host.type`, or `builds.runner`
- **THEN** it accepts exactly the names of that kind's available tools, and refuses any other with today's message, naming those that are built.

### Requirement: A ticket system's keys

`config check` SHALL refuse a key under `tickets` that the chosen ticket
system does not declare.

#### Scenario: A ticket system's keys

- **WHEN** the settings have a key under `tickets` that is neither one of today's keys nor declared by the chosen ticket system
- **THEN** `config check` refuses it as it refuses an unknown key today.
