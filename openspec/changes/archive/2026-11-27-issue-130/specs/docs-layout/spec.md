## ADDED Requirements

### Requirement: The README is short

lunamill SHALL behave as this line says: When a reader opens `README.md`, it holds, in order, who lunamill is for and what it does, the early-use warning, "Install" with how to tell it worked, "Next" with links to https://www.lunamill.ai, its quick start, "Moving to lunamill", and "Developing", and "License", in 200 to 300 words, as `wc -w` counts the whole file.

#### Scenario: The README is short

- **WHEN** a reader opens `README.md`
- **THEN** it holds, in order, who lunamill is for and what it does, the early-use warning, "Install" with how to tell it worked, "Next" with links to https://www.lunamill.ai, its quick start, "Moving to lunamill", and "Developing", and "License", in 200 to 300 words, as `wc -w` counts the whole file.

## REMOVED Requirements

### Requirement: The README routes

**Reason**: The README is short, and links to the docs site.

**Migration**: None.
