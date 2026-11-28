## ADDED Requirements

### Requirement: The files sync writes

Lunamill SHALL behave as this line says: When `lunamill sync` writes a repository's files, it writes the rules to `.claude/lunamill/rules.md`, adds the line `@.claude/lunamill/rules.md` to `CLAUDE.md` when it is missing, writes each skill to `.claude/skills/lunamill-NAME/SKILL.md` and each agent to `.claude/agents/lunamill-NAME.md`, and the review instructions to `.github/lunamill-review.md`.

#### Scenario: The files sync writes

- **WHEN** `lunamill sync` writes a repository's files
- **THEN** it writes the rules to `.claude/lunamill/rules.md`, adds the line `@.claude/lunamill/rules.md` to `CLAUDE.md` when it is missing, writes each skill to `.claude/skills/lunamill-NAME/SKILL.md` and each agent to `.claude/agents/lunamill-NAME.md`, and the review instructions to `.github/lunamill-review.md`.

### Requirement: The hooks and the work folder

Lunamill SHALL behave as this line says: When `lunamill sync` writes `.claude/settings.json`, each hook runs `lunamill`, and the folder it adds for a session is `~/.local/share/lunamill/work`.

#### Scenario: The hooks and the work folder

- **WHEN** `lunamill sync` writes `.claude/settings.json`
- **THEN** each hook runs `lunamill`, and the folder it adds for a session is `~/.local/share/lunamill/work`.
