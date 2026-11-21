## ADDED Requirements

### Requirement: The schema describes required columns

The factory SHALL behave as this line says: In `settings.schema.json`, no state under `tickets.columns` says `Default:`, and the block's description says that with a board all six states are required, from this file or a preset. The schema doesn't require them, since it reads one file and a preset can supply the block (line 5); the settings check does.

#### Scenario: The schema describes required columns

- **WHEN** `settings.schema.json` describes `tickets.columns`
- **THEN** no state under `tickets.columns` says `Default:`, and the block's description says that with a board all six states are required, from this file or a preset. The schema doesn't require them, since it reads one file and a preset can supply the block (line 5); the settings check does.
