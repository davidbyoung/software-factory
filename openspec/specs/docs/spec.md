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

### Requirement: The configuration page for version 2

The factory SHALL behave as this line says: `docs/configuration.md` documents `commands` and each key under it, `specs.check` with its default, and `plugins` by phase, saying for each role whether it takes a skill or an agent, one or a list, `files` or `labels`, and what is used when it is left out. Its example settings files are version 2.

#### Scenario: The configuration page for version 2

- **WHEN** a reader opens the docs
- **THEN** `docs/configuration.md` documents `commands` and each key under it, `specs.check` with its default, and `plugins` by phase, saying for each role whether it takes a skill or an agent, one or a list, `files` or `labels`, and what is used when it is left out. Its example settings files are version 2.

### Requirement: The plugins page

The factory SHALL behave as this line says: `docs/plugins.md` has one table for each role giving when it is called, what it is handed, what it returns, and what happens next. It lists what a `refiner` must deliver, what a `prover` must report, that `test.reviewers` is the whole list, that a resolver is read from the default branch's copy, that reviewers still run after a builder, and that extra refinement questions go in a "Refining: this repository" section of `CLAUDE.md`.

#### Scenario: The plugins page

- **WHEN** a reader opens the docs
- **THEN** `docs/plugins.md` has one table for each role giving when it is called, what it is handed, what it returns, and what happens next. It lists what a `refiner` must deliver, what a `prover` must report, that `test.reviewers` is the whole list, that a resolver is read from the default branch's copy, that reviewers still run after a builder, and that extra refinement questions go in a "Refining: this repository" section of `CLAUDE.md`.

### Requirement: The updating page

The factory SHALL behave as this line says: `docs/updating.md` has a section "Moving to settings version 2" that shows each key that moved or changed shape, before and after.

#### Scenario: The updating page

- **WHEN** a reader opens the docs
- **THEN** `docs/updating.md` has a section "Moving to settings version 2" that shows each key that moved or changed shape, before and after.

### Requirement: The CLI page's new commands

The factory SHALL behave as this line says: `docs/cli.md` has rows for `factory gate`, `factory test-one`, `factory end-to-end`, `factory specs check`, and `factory default-branch`, and names `--check` in the `factory ticket refined` row.

#### Scenario: The CLI page's new commands

- **WHEN** a reader opens the docs
- **THEN** `docs/cli.md` has rows for `factory gate`, `factory test-one`, `factory end-to-end`, `factory specs check`, and `factory default-branch`, and names `--check` in the `factory ticket refined` row.

### Requirement: No migrate row

The factory SHALL behave as this line says: "What is built" in `docs/developing.md` has no `factory migrate` row.

#### Scenario: No migrate row

- **WHEN** a reader opens the docs
- **THEN** "What is built" in `docs/developing.md` has no `factory migrate` row.

### Requirement: What a plugin can replace

The factory SHALL behave as this line says: "The order of the workflow is fixed" in `docs/design.md`, and the line of the same name in `docs/limitations.md`, say which steps a plugin can replace and that the states and their order still cannot change. `docs/limitations.md` no longer says a build assumes `main`, if it does anywhere.

#### Scenario: What a plugin can replace

- **WHEN** a reader opens the docs
- **THEN** "The order of the workflow is fixed" in `docs/design.md`, and the line of the same name in `docs/limitations.md`, say which steps a plugin can replace and that the states and their order still cannot change. `docs/limitations.md` no longer says a build assumes `main`, if it does anywhere.

### Requirement: The quick start names the gate

The factory SHALL behave as this line says: `docs/quick-start.md` tells a new user to set `commands.gate` before the first build.

#### Scenario: The quick start names the gate

- **WHEN** a reader opens the docs
- **THEN** `docs/quick-start.md` tells a new user to set `commands.gate` before the first build.

### Requirement: The presets docs

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The presets docs

- **WHEN** this ships
- **THEN** `docs/presets.md` reads as Proposed docs drafts it, `docs/configuration.md` has a `presets` entry and says under "How the file works" that every command reads the lock, `docs/cli.md` lists `factory preset add`, `remove`, `choices`, `choose`, `check`, and `changes`, `docs/updating.md` points preset updates to `docs/presets.md`, and `docs/glossary.md` has "Preset". `docs/configuration.md` stops saying `plugins` needs no sync.

### Requirement: The private npm docs

The factory SHALL behave as this line says: When this ships, `docs/github/setup.md` has the section "Private npm packages" as Proposed docs drafts it, the row in the table of what `init` asks, and the changed sentence under "Changing it later"; `docs/presets.md`, `docs/limitations.md`, `docs/github/reference.md`, and `docs/github/by-hand.md` change as "Other pages that change" shows, and no page marks a private preset's workflows _Planned_.

#### Scenario: The private npm docs

- **WHEN** this ships
- **THEN** `docs/github/setup.md` has the section "Private npm packages" as Proposed docs drafts it, the row in the table of what `init` asks, and the changed sentence under "Changing it later"; `docs/presets.md`, `docs/limitations.md`, `docs/github/reference.md`, and `docs/github/by-hand.md` change as "Other pages that change" shows, and no page marks a private preset's workflows _Planned_.

### Requirement: The docs require every column

The factory SHALL behave as this line says: `docs/configuration.md`, `docs/existing-repo.md`, `docs/updating.md`, and `docs/builds.md` read as "The docs pages" under Proposed docs shows them, and `docs/workflow.md`, `docs/github/by-hand.md`, and `docs/presets.md` change as "The docs that change" says. The `docker run` example in `docs/builds.md`, under the poller image, gains `-e FACTORY_READY_COLUMN=Ready \` after `-e FACTORY_BOARD_TOKEN \`.

#### Scenario: The docs require every column

- **WHEN** the docs describe `tickets.columns`, the poller's variables, and updating
- **THEN** `docs/configuration.md`, `docs/existing-repo.md`, `docs/updating.md`, and `docs/builds.md` read as "The docs pages" under Proposed docs shows them, and `docs/workflow.md`, `docs/github/by-hand.md`, and `docs/presets.md` change as "The docs that change" says. The `docker run` example in `docs/builds.md`, under the poller image, gains `-e FACTORY_READY_COLUMN=Ready \` after `-e FACTORY_BOARD_TOKEN \`.

### Requirement: The configuration page's code-host

The factory SHALL behave as this line says: When a reader opens `docs/configuration.md`, its `code-host` section reads as "The docs page" under Proposed docs shows it; "How the file works" names `version`, `repository`, and `code-host.branch-name` as required and `commands.gate` before any build; and "The shortest file" and the three complete files each hold the `code-host` block with `branch-name: "{ticket}"`.

#### Scenario: The configuration page's code-host

- **WHEN** a reader opens `docs/configuration.md`
- **THEN** its `code-host` section reads as "The docs page" under Proposed docs shows it; "How the file works" names `version`, `repository`, and `code-host.branch-name` as required and `commands.gate` before any build; and "The shortest file" and the three complete files each hold the `code-host` block with `branch-name: "{ticket}"`.

### Requirement: The CLI page's branch commands

The factory SHALL behave as this line says: When a reader opens `docs/cli.md`, it lists `factory ticket branch N` under Tickets and `factory pr for-branch BRANCH` under Pull requests, and its "Your repository's commands" has rows for `factory specs list`, `factory specs new N`, `factory specs check`, and `factory specs finish N`, the note after the table, and no row for `factory specs change-name N`, worded as "The sections that change" under Proposed docs shows.

#### Scenario: The CLI page's branch commands

- **WHEN** a reader opens `docs/cli.md`
- **THEN** It lists `factory ticket branch N` under Tickets and `factory pr for-branch BRANCH` under Pull requests, and its "Your repository's commands" has rows for `factory specs list`, `factory specs new N`, `factory specs check`, and `factory specs finish N`, the note after the table, and no row for `factory specs change-name N`, worded as "The sections that change" under Proposed docs shows.

### Requirement: The updating and presets pages

The factory SHALL behave as this line says: When a reader opens `docs/updating.md`, it says the update that brings this in stops until `factory init` adds `branch-name`, beside #53's columns, and `docs/presets.md` names `code-host.branch-name` as a setting a preset can share.

#### Scenario: The updating and presets pages

- **WHEN** a reader opens `docs/updating.md`
- **THEN** it says the update that brings this in stops until `factory init` adds `branch-name`, beside #53's columns, and `docs/presets.md` names `code-host.branch-name` as a setting a preset can share.

### Requirement: The configuration page's specs sections

The factory SHALL behave as this line says: When a reader opens `docs/configuration.md`, its `specs` and `specs.check` sections read as "The sections that change" under Proposed docs shows.

#### Scenario: The configuration page's specs sections

- **WHEN** a reader opens `docs/configuration.md`
- **THEN** Its `specs` and `specs.check` sections read as "The sections that change" under Proposed docs shows.

### Requirement: The workflow page's spec section

The factory SHALL behave as this line says: When a reader opens `docs/workflow.md`, its "A change your users will see" section reads as "The sections that change" under Proposed docs shows.

#### Scenario: The workflow page's spec section

- **WHEN** a reader opens `docs/workflow.md`
- **THEN** Its "A change your users will see" section reads as "The sections that change" under Proposed docs shows.

### Requirement: The setup page's spec tool question

The factory SHALL behave as this line says: When a reader opens `docs/github/setup.md`, "Run `factory init`" shows the spec tool question and says init skips either question the settings or a preset answer, as "The sections that change" under Proposed docs shows.

#### Scenario: The setup page's spec tool question

- **WHEN** a reader opens `docs/github/setup.md`
- **THEN** "Run `factory init`" shows the spec tool question and says init skips either question the settings or a preset answer, as "The sections that change" under Proposed docs shows.

### Requirement: The limitations page's spec tools

The factory SHALL behave as this line says: When a reader opens `docs/limitations.md`, its table of what is built has the row "Another spec tool, such as Spec Kit", "Not planned. An adapter under `src/specs/` adds one".

#### Scenario: The limitations page's spec tools

- **WHEN** a reader opens `docs/limitations.md`
- **THEN** Its table of what is built has the row "Another spec tool, such as Spec Kit", "Not planned. An adapter under `src/specs/` adds one".

### Requirement: The glossary's Spec entry

The factory SHALL behave as this line says: When a reader opens `docs/glossary.md`, its Spec entry reads as Proposed docs §6 shows.

#### Scenario: The glossary's Spec entry

- **WHEN** a reader opens `docs/glossary.md`
- **THEN** Its Spec entry reads as Proposed docs §6 shows.

### Requirement: Adding a spec tool

The factory SHALL behave as this line says: When a reader opens `docs/developing.md`, it has a section "Adding a spec tool", beside "Adding a ticket system", with the table of what an adapter gives from Proposed docs §5.

#### Scenario: Adding a spec tool

- **WHEN** a reader opens `docs/developing.md`
- **THEN** It has a section "Adding a spec tool", beside "Adding a ticket system", with the table of what an adapter gives from Proposed docs §5.
