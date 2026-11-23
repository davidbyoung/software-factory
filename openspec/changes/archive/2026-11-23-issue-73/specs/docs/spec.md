## ADDED Requirements

### Requirement: The presets and updating pages as drafted

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The presets and updating pages as drafted

- **WHEN** a reader opens `docs/presets.md` or `docs/updating.md`
- **THEN** `docs/presets.md` and `docs/updating.md`, down to "Moving to settings version 2", read as the comment "The docs pages, as drafted", corrected wherever the build had to differ.

### Requirement: The other pages and one install

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The other pages and one install

- **WHEN** a reader opens the docs
- **THEN** Each page in that comment's "The other pages" changes as its row says, and no page tells a reader to install the factory in a repository or to run `npm ci` for it.

## MODIFIED Requirements

### Requirement: The presets docs

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The presets docs

- **WHEN** this ships
- **THEN** `docs/configuration.md` has a `presets` entry and says under "How the file works" that every command reads the lock, `docs/cli.md` lists `factory preset add`, `remove`, `choices`, `choose`, `check`, and `changes`, `docs/updating.md` points preset updates to `docs/presets.md`, and `docs/glossary.md` has "Preset". `docs/configuration.md` stops saying `plugins` needs no sync.

### Requirement: The private npm docs

The factory SHALL behave as this line says: When this ships, `docs/github/setup.md` has the section "Private npm packages", the row in the table of what `init` asks, and the changed sentence under "Changing it later"; `docs/limitations.md`, `docs/github/reference.md`, and `docs/github/by-hand.md` change as "Other pages that change" shows, and no page marks a private preset's workflows _Planned_.

#### Scenario: The private npm docs

- **WHEN** this ships
- **THEN** `docs/github/setup.md` has the section "Private npm packages", the row in the table of what `init` asks, and the changed sentence under "Changing it later"; `docs/limitations.md`, `docs/github/reference.md`, and `docs/github/by-hand.md` change as "Other pages that change" shows, and no page marks a private preset's workflows _Planned_.
