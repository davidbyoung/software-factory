# poller-image Specification

## Purpose

The container image each release publishes, so a repository that hosts the poller runs it without writing a Dockerfile of its own.

## Requirements

### Requirement: The image is published

Lunamill SHALL behave as this line says: When a version is released, the release workflow publishes `ghcr.io/lunamill-ai/lunamill-poller` tagged with the version and `latest`, after the npm package publishes, and built from that published version.

#### Scenario: The image is published

- **WHEN** a version is released
- **THEN** the release workflow publishes `ghcr.io/lunamill-ai/lunamill-poller` tagged with the version and `latest`, after the npm package publishes, and built from that published version.

### Requirement: The image runs the poller

Lunamill SHALL behave as this line says: When the image runs with `LUNAMILL_REPOSITORY` and `LUNAMILL_BOARD_TOKEN`, it runs that version's hosted poller.

#### Scenario: The image runs the poller

- **WHEN** the image runs with `LUNAMILL_REPOSITORY` and `LUNAMILL_BOARD_TOKEN`
- **THEN** it runs that version's hosted poller.

### Requirement: The image is public

Lunamill SHALL behave as this line says: When anyone pulls the image, no sign-in is needed.

#### Scenario: The image is public

- **WHEN** anyone pulls the image
- **THEN** no sign-in is needed.

### Requirement: The image names its source

Lunamill SHALL behave as this line says: The image carries the `org.opencontainers.image.source` label naming this repository, so Dependabot can read its versions.

#### Scenario: The image names its source

- **WHEN** the image is built
- **THEN** The image carries the `org.opencontainers.image.source` label naming this repository, so Dependabot can read its versions.

### Requirement: The poller's image

Lunamill SHALL behave as this line says: When a release publishes the poller's image, it is `ghcr.io/lunamill-ai/lunamill-poller:VERSION` and `:latest`, and the poller reads `LUNAMILL_REPOSITORY` and `LUNAMILL_BOARD_TOKEN`.

#### Scenario: The poller's image

- **WHEN** a release publishes the poller's image
- **THEN** it is `ghcr.io/lunamill-ai/lunamill-poller:VERSION` and `:latest`, and the poller reads `LUNAMILL_REPOSITORY` and `LUNAMILL_BOARD_TOKEN`.
