## MODIFIED Requirements

### Requirement: The suggestion's table

The factory SHALL behave as this line says: When the agent's answer is usable, init prints a table headed `State      Column`, with one row per state in the order backlog, refining, ready, building, review, done. Each row shows the board's column, as the board spells it; `<factory name>, which init adds`; or, for no column, what `factory board check` prints: `none, shows in <column>`, or for ready, `none`.

#### Scenario: The suggestion's table

- **WHEN** the agent's answer is usable
- **THEN** init prints a table headed `State      Column`, with one row per state in the order backlog, refining, ready, building, review, done. Each row shows one of these:
  - the board's column, as the board spells it;
  - `<factory name>, which init adds`;
  - for no column, what `factory board check` prints: `none, shows in <column>`, or for ready, `none`.
