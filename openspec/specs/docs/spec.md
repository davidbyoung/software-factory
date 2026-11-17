# docs Specification

## Purpose

What the docs say about the scheduled poller, the poller's published image, and `factory pr uncovered`.

## Requirements

### Requirement: The builds page

The factory SHALL behave as this line says: `docs/builds.md`: "A scheduled poller" loses its Planned mark and gives the cost per interval on a private repository and the 5 to 15 minute pickup. "The poller" shows the image, its four variables, and the optional one-line Dockerfile with the `.github/dependabot.yml` entry that keeps its version current.

#### Scenario: The builds page

- **WHEN** a reader opens `docs/builds.md`
- **THEN** `docs/builds.md`: "A scheduled poller" loses its Planned mark and gives the cost per interval on a private repository and the 5 to 15 minute pickup. "The poller" shows the image, its four variables, and the optional one-line Dockerfile with the `.github/dependabot.yml` entry that keeps its version current.

### Requirement: The configuration page

The factory SHALL behave as this line says: `docs/configuration.md` gives `builds.poll-minutes` with its values and default, and drops the Planned mark and the refusal from `builds.trigger`'s `github-action`.

#### Scenario: The configuration page

- **WHEN** a reader opens `docs/configuration.md`
- **THEN** `docs/configuration.md` gives `builds.poll-minutes` with its values and default, and drops the Planned mark and the refusal from `builds.trigger`'s `github-action`.

### Requirement: The CLI page and what is built

The factory SHALL behave as this line says: `docs/cli.md` marks `factory poller --once` Built, and "What is built" in `docs/developing.md` says Working for the row #12 names.

#### Scenario: The CLI page and what is built

- **WHEN** a reader opens `docs/cli.md` or "What is built"
- **THEN** `docs/cli.md` marks `factory poller --once` Built, and "What is built" in `docs/developing.md` says Working for the row #12 names.

### Requirement: The CLI page lists pr uncovered

The factory SHALL behave as this line says: `docs/cli.md` lists `factory pr uncovered [BASE] [LCOV]` under "Pull requests", and says what it prints, what `MISS` and `PART` mean, and what `BASE` and `LCOV` are when left out.

#### Scenario: The CLI page lists pr uncovered

- **WHEN** a reader opens `docs/cli.md`
- **THEN** `docs/cli.md` lists `factory pr uncovered [BASE] [LCOV]` under "Pull requests", and says what it prints, what `MISS` and `PART` mean, and what `BASE` and `LCOV` are when left out.
