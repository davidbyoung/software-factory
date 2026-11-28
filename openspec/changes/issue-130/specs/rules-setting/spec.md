## ADDED Requirements

### Requirement: The files sync writes

kodor SHALL behave as this line says: When `kodor sync` writes a repository's files, it writes the rules to `.claude/kodor/rules.md`, adds the line `@.claude/kodor/rules.md` to `CLAUDE.md` when it is missing, writes each skill to `.claude/skills/kodor-NAME/SKILL.md` and each agent to `.claude/agents/kodor-NAME.md`, and the review instructions to `.github/kodor-review.md`.

#### Scenario: The files sync writes

- **WHEN** `kodor sync` writes a repository's files
- **THEN** it writes the rules to `.claude/kodor/rules.md`, adds the line `@.claude/kodor/rules.md` to `CLAUDE.md` when it is missing, writes each skill to `.claude/skills/kodor-NAME/SKILL.md` and each agent to `.claude/agents/kodor-NAME.md`, and the review instructions to `.github/kodor-review.md`.

### Requirement: The hooks and the work folder

kodor SHALL behave as this line says: When `kodor sync` writes `.claude/settings.json`, each hook runs `kodor`, and the folder it adds for a session is `~/.local/share/kodor/work`.

#### Scenario: The hooks and the work folder

- **WHEN** `kodor sync` writes `.claude/settings.json`
- **THEN** each hook runs `kodor`, and the folder it adds for a session is `~/.local/share/kodor/work`.
