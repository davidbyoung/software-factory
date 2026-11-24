## ADDED Requirements

### Requirement: The GitHub setup and credentials pages as drafted

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The GitHub setup and credentials pages as drafted

- **WHEN** a reader opens `docs/github/setup.md` or `docs/credentials.md`
- **THEN** `docs/github/setup.md`, down to "Optional: tune it", and "On GitHub" in `docs/credentials.md` read as the comment "The docs pages, as drafted", corrected wherever the build had to differ.

### Requirement: The other pages and the App

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The other pages and the App

- **WHEN** a reader opens the docs
- **THEN** Each page in that comment's "The other pages" changes as its row says. No page tells a reader to install Claude's GitHub App, or says a token from a GitHub App is not supported.
