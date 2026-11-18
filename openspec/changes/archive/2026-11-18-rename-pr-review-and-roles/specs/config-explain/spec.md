## MODIFIED Requirements

### Requirement: Parts that are off and empty defaults print as comments

The factory SHALL behave as this line says: When an optional part is off, or a setting's default is no value, it prints a comment line in its place, such as `# pr-review: off` or `# board: none (default)`. The scenario lists each one.

#### Scenario: Parts that are off and empty defaults print as comments

- **WHEN** an optional part is off (`pr-review` or `site`), or a setting's default is no value (`tickets.board`, `site.pages`, `site.design-guide`, `commands.test-one`, `commands.end-to-end`, `commands.coverage`, or a mockups plugin where there is none)
- **THEN** it prints a comment line in its place: `# pr-review: off`, `# board: none (default)`, `# pages: found by the factory (default)`, `# design-guide: none (default)`, `# test-one: none (default)`, `# end-to-end: none (default)`, `# coverage: none (default)`, or `# mockups: none (default)`.

### Requirement: Explain prints plugins by phase

The factory SHALL behave as this line says: When `factory config explain` runs, it prints `plugins` grouped by phase, with `refiner`, `prover`, `mockups`, and `test.reviewers` filled in with what `factory plugins` prints for the role and marked `# default` when the settings do not set them, an empty list for `builders`, `build.reviewers`, and `resolvers` that are not set, and the comment `# mockups: none (default)` where there is no mockups plugin.

#### Scenario: Explain prints plugins by phase

- **WHEN** `factory config explain` runs
- **THEN** it prints `plugins` grouped by phase, with `refiner`, `prover`, `mockups`, and `test.reviewers` filled in with what `factory plugins` prints for the role and marked `# default` when the settings do not set them, an empty list for `builders`, `build.reviewers`, and `resolvers` that are not set, and the comment `# mockups: none (default)` where there is no mockups plugin.
