# poller-image Specification

## Purpose

The container image each release publishes, so a repository that hosts the poller runs it without writing a Dockerfile of its own.

## Requirements

### Requirement: The image is published

The factory SHALL behave as this line says: When a version is released, the release workflow publishes `ghcr.io/davidbyoung/software-factory-poller` tagged with the version and `latest`, after the npm package publishes, and built from that published version.

#### Scenario: The image is published

- **WHEN** a version is released
- **THEN** the release workflow publishes `ghcr.io/davidbyoung/software-factory-poller` tagged with the version and `latest`, after the npm package publishes, and built from that published version.

### Requirement: The image runs the poller

The factory SHALL behave as this line says: When the image runs with `FACTORY_REPOSITORY`, `FACTORY_BOARD_OWNER`, `FACTORY_BOARD_NUMBER`, `FACTORY_BOARD_TOKEN`, and `FACTORY_READY_COLUMN`, it runs that version's hosted poller.

#### Scenario: The image runs the poller

- **WHEN** the image runs with `FACTORY_REPOSITORY`, `FACTORY_BOARD_OWNER`, `FACTORY_BOARD_NUMBER`, `FACTORY_BOARD_TOKEN`, and `FACTORY_READY_COLUMN`
- **THEN** it runs that version's hosted poller.

### Requirement: The image is public

The factory SHALL behave as this line says: When anyone pulls the image, no sign-in is needed.

#### Scenario: The image is public

- **WHEN** anyone pulls the image
- **THEN** no sign-in is needed.

### Requirement: The image names its source

The factory SHALL behave as this line says: The image carries the `org.opencontainers.image.source` label naming this repository, so Dependabot can read its versions.

#### Scenario: The image names its source

- **WHEN** the image is built
- **THEN** The image carries the `org.opencontainers.image.source` label naming this repository, so Dependabot can read its versions.
