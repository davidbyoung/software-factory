## MODIFIED Requirements

### Requirement: Doctor is unchanged with today's tools

The factory SHALL behave as this line says: `factory doctor` prints the same checks as before this change with today's tools, sorted and worded as lines 20 to 25 and 33 say.

#### Scenario: Doctor is unchanged with today's tools

- **WHEN** `factory doctor` runs with today's tools
- **THEN** `factory doctor` prints the same checks as before this change with today's tools, sorted and worded as lines 20 to 25 and 33 say.

### Requirement: A tool's secret not set

The factory SHALL behave as this line says: When a secret a tool needs is not set, `doctor` fails `NAME is not set, for PARTS` with the fix `Run factory init`.

#### Scenario: A tool's secret not set

- **WHEN** a secret a tool needs is not set
- **THEN** `doctor` fails `NAME is not set, for PARTS` with the fix `Run factory init`.

### Requirement: Init is unchanged with today's tools

The factory SHALL behave as this line says: `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, and its fixes, as line 25 says.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, and its fixes, as line 25 says.

### Requirement: A secret left for later

The factory SHALL behave as this line says: When nothing is pasted for a tool's secret, `init` prints the tool's line for that, followed by `Run factory init again to add it.`

#### Scenario: A secret left for later

- **WHEN** nothing is pasted for a tool's secret
- **THEN** `init` prints the tool's line for that, followed by `Run factory init again to add it.`
