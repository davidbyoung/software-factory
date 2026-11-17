## ADDED Requirements

### Requirement: The CLI page lists pr uncovered

The factory SHALL behave as this line says: `docs/cli.md` lists `factory pr uncovered [BASE] [LCOV]` under "Pull requests", and says what it prints, what `MISS` and `PART` mean, and what `BASE` and `LCOV` are when left out.

#### Scenario: The CLI page lists pr uncovered

- **WHEN** a reader opens `docs/cli.md`
- **THEN** `docs/cli.md` lists `factory pr uncovered [BASE] [LCOV]` under "Pull requests", and says what it prints, what `MISS` and `PART` mean, and what `BASE` and `LCOV` are when left out.
