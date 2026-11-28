## ADDED Requirements

### Requirement: The poller's image

kodor SHALL behave as this line says: When a release publishes the poller's image, it is `ghcr.io/kodor-ai/kodor-poller:VERSION` and `:latest`, and the poller reads `KODOR_REPOSITORY` and `KODOR_BOARD_TOKEN`.

#### Scenario: The poller's image

- **WHEN** a release publishes the poller's image
- **THEN** it is `ghcr.io/kodor-ai/kodor-poller:VERSION` and `:latest`, and the poller reads `KODOR_REPOSITORY` and `KODOR_BOARD_TOKEN`.
