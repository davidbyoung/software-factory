## ADDED Requirements

### Requirement: The presets docs

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The presets docs

- **WHEN** this ships
- **THEN** `docs/presets.md` reads as Proposed docs drafts it, `docs/configuration.md` has a `presets` entry and says under "How the file works" that every command reads the lock, `docs/cli.md` lists `factory preset add`, `remove`, `choices`, `choose`, `check`, and `changes`, `docs/updating.md` points preset updates to `docs/presets.md`, and `docs/glossary.md` has "Preset". `docs/configuration.md` stops saying `plugins` needs no sync.
