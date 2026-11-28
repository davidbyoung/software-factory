# trace-skill Specification

## Purpose

The `kodor-trace` skill: one fresh agent tracing a change to the process through every kind of change the repository gets.

## Requirements

### Requirement: Sync writes the trace skill

kodor SHALL behave as this line says: When `kodor sync` runs, it writes `.claude/skills/kodor-trace/SKILL.md` into every repository.

#### Scenario: Sync writes the trace skill

- **WHEN** `kodor sync` runs
- **THEN** it writes `.claude/skills/kodor-trace/SKILL.md` into every repository.

### Requirement: The trace starts one fresh agent

kodor SHALL behave as this line says: When the skill runs on a branch, it starts one fresh agent, giving it only the branch, its base, and `.claude/change-types.md`, to trace each kind of change in that file through the rules, skills, and agents as the branch leaves them.

#### Scenario: The trace starts one fresh agent

- **WHEN** the skill runs on a branch
- **THEN** it starts one fresh agent, giving it only the branch, its base, and `.claude/change-types.md`, to trace each kind of change in that file through the rules, skills, and agents as the branch leaves them.

### Requirement: The trace report

kodor SHALL behave as this line says: Its report lists each kind as unchanged, heavier, lighter, or ambiguous, with the rule that makes it so, then any two rules that now disagree, quoting both.

#### Scenario: The trace report

- **WHEN** the fresh agent has traced each kind
- **THEN** its report lists each kind as unchanged, heavier, lighter, or ambiguous, with the rule that makes it so, then any two rules that now disagree, quoting both.

### Requirement: Where the report goes

kodor SHALL behave as this line says: When the branch has an open pull request, the skill posts the report on it with `kodor pr comment`; otherwise it gives it in the session.

#### Scenario: Where the report goes

- **WHEN** the branch has an open pull request
- **THEN** the skill posts the report on it with `kodor pr comment`; otherwise it gives it in the session.

### Requirement: No change-types file

kodor SHALL behave as this line says: When `.claude/change-types.md` is missing, it starts no agent, says so, and shows the file's shape: a table of kinds, each with a real example.

#### Scenario: No change-types file

- **WHEN** `.claude/change-types.md` is missing
- **THEN** it starts no agent, says so, and shows the file's shape: a table of kinds, each with a real example.

### Requirement: The rules call the trace

kodor SHALL behave as this line says: "Changing the process" in `rules.md` tells a session to run `kodor-trace` before marking the pull request ready, where it now describes the fresh agent's read.

#### Scenario: The rules call the trace

- **WHEN** a pull request changes a process rule
- **THEN** "Changing the process" in `rules.md` tells a session to run `kodor-trace` before marking the pull request ready, where it now describes the fresh agent's read.
