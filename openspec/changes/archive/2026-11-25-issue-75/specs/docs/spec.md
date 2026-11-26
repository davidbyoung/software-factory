## ADDED Requirements

### Requirement: The existing-repo page's monorepo section

The factory SHALL behave as this line says: When the docs are read, `docs/existing-repo.md` has the section "A monorepo" as `##`, after "A repository that is not JavaScript" and before "You already have a board", and its first sentence names several packages in one repository as the comment's Proposed docs words it.

#### Scenario: The existing-repo page's monorepo section

- **WHEN** When the docs are read
- **THEN** `docs/existing-repo.md` has the section "A monorepo" as `##`, after "A repository that is not JavaScript" and before "You already have a board", and its first sentence names several packages in one repository as the comment's Proposed docs words it.

### Requirement: The configuration page's commands for some folders

The factory SHALL behave as this line says: When the docs are read, `docs/configuration.md` has the comment's changes at the levels the real page uses (`### commands`, `#### Commands for some folders`, `#### commands.ignore`), `README.md`'s row for the existing-repo page names a monorepo, `docs/presets.md` has the folder preset's row and `--in`, and `docs/cli.md` lists `factory coverage`, `factory relock`, `factory build-setup`, and the new flags.

#### Scenario: The configuration page's commands for some folders

- **WHEN** When the docs are read
- **THEN** `docs/configuration.md` has the comment's changes at the levels the real page uses (`### commands`, `#### Commands for some folders`, `#### commands.ignore`), `README.md`'s row for the existing-repo page names a monorepo, `docs/presets.md` has the folder preset's row and `--in`, and `docs/cli.md` lists `factory coverage`, `factory relock`, `factory build-setup`, and the new flags.
