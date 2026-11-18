## ADDED Requirements

### Requirement: Explain prints commands

The factory SHALL behave as this line says: When `factory config explain` runs, it prints a `commands` block holding `build-setup`, `before-commit`, `gate`, and `relock`, and a comment line in place of each of `test-one`, `end-to-end`, and `coverage` that is not set: `# test-one: none (default)`, `# end-to-end: none (default)`, `# coverage: none (default)`.

#### Scenario: Explain prints commands

- **WHEN** `factory config explain` runs
- **THEN** it prints a `commands` block holding `build-setup`, `before-commit`, `gate`, and `relock`, and a comment line in place of each of `test-one`, `end-to-end`, and `coverage` that is not set: `# test-one: none (default)`, `# end-to-end: none (default)`, `# coverage: none (default)`.

### Requirement: Explain prints specs

The factory SHALL behave as this line says: When `specs.type` is `openspec`, `factory config explain` prints `specs` as a block with `type` and `check`; otherwise it prints `specs: none`.

#### Scenario: Explain prints specs

- **WHEN** `specs.type` is `openspec`
- **THEN** `factory config explain` prints `specs` as a block with `type` and `check`; otherwise it prints `specs: none`.

### Requirement: Explain prints plugins by phase

The factory SHALL behave as this line says: When `factory config explain` runs, it prints `plugins` grouped by phase, with `refiner`, `prover`, `mockups`, and `test.reviewers` filled in with what `factory plugins` prints for the slot and marked `# default` when the settings do not set them, an empty list for `builders`, `build.reviewers`, and `resolvers` that are not set, and the comment `# mockups: none (default)` where there is no mockups plug-in.

#### Scenario: Explain prints plugins by phase

- **WHEN** `factory config explain` runs
- **THEN** it prints `plugins` grouped by phase, with `refiner`, `prover`, `mockups`, and `test.reviewers` filled in with what `factory plugins` prints for the slot and marked `# default` when the settings do not set them, an empty list for `builders`, `build.reviewers`, and `resolvers` that are not set, and the comment `# mockups: none (default)` where there is no mockups plug-in.

## MODIFIED Requirements

### Requirement: Parts that are off and empty defaults print as comments

The factory SHALL behave as this line says: When an optional part is off (`ci-review` or `site`), or a setting's default is no value (`tickets.board`, `site.pages`, `site.design-guide`, `commands.test-one`, `commands.end-to-end`, `commands.coverage`, or a mockups plug-in where there is none), it prints a comment line in its place: `# ci-review: off`, `# board: none (default)`, `# pages: found by the factory (default)`, `# design-guide: none (default)`, `# test-one: none (default)`, `# end-to-end: none (default)`, `# coverage: none (default)`, or `# mockups: none (default)`.

#### Scenario: Parts that are off and empty defaults print as comments

- **WHEN** an optional part is off (`ci-review` or `site`), or a setting's default is no value (`tickets.board`, `site.pages`, `site.design-guide`, `commands.test-one`, `commands.end-to-end`, `commands.coverage`, or a mockups plug-in where there is none)
- **THEN** it prints a comment line in its place: `# ci-review: off`, `# board: none (default)`, `# pages: found by the factory (default)`, `# design-guide: none (default)`, `# test-one: none (default)`, `# end-to-end: none (default)`, `# coverage: none (default)`, or `# mockups: none (default)`.
