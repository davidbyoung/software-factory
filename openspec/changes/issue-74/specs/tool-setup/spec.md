## MODIFIED Requirements

### Requirement: Init is unchanged with today's tools

The factory SHALL behave as this line says: `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, the question that asks for `code-host.branch-name` when the settings in effect have none, the spec tool's question and install that #37's lines 17 to 24 add, what #73's lines 20 and 46 add and take away, and what #74's lines 27 to 54 add and take away.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, the question that asks for `code-host.branch-name` when the settings in effect have none, the spec tool's question and install that #37's lines 17 to 24 add, what #73's lines 20 and 46 add and take away, and what #74's lines 27 to 54 add and take away.

### Requirement: Left to do names the gate

The factory SHALL behave as this line says: When `commands.gate` is empty and `init`'s question for the gate was left empty, `init`'s "Left to do" includes `Add the commands that check a change, under commands.gate in .claude/factory.yaml`.

#### Scenario: Left to do names the gate

- **WHEN** `commands.gate` is empty and `init`'s question for the gate was left empty
- **THEN** `init`'s "Left to do" includes `Add the commands that check a change, under commands.gate in .claude/factory.yaml`.

### Requirement: An unsupported code host

`init` SHALL name every code host it supports when no remote is on one of
them.

#### Scenario: An unsupported code host

- **WHEN** no remote is on a code host the factory supports
- **THEN** `init` says so and names every one it supports, as a list ("A, B, and C").
