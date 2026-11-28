## ADDED Requirements

### Requirement: The poller's image

Lunamill SHALL behave as this line says: When a release publishes the poller's image, it is `ghcr.io/lunamill-ai/lunamill-poller:VERSION` and `:latest`, and the poller reads `LUNAMILL_REPOSITORY` and `LUNAMILL_BOARD_TOKEN`.

#### Scenario: The poller's image

- **WHEN** a release publishes the poller's image
- **THEN** it is `ghcr.io/lunamill-ai/lunamill-poller:VERSION` and `:latest`, and the poller reads `LUNAMILL_REPOSITORY` and `LUNAMILL_BOARD_TOKEN`.
