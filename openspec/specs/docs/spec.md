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
- **THEN** `docs/configuration.md` has a `presets` entry and says under "How the file works" that every command reads the lock, `docs/cli.md` lists `factory preset add`, `remove`, `choices`, `choose`, `check`, and `changes`, `docs/updating.md` points preset updates to `docs/presets.md`, and `docs/glossary.md` has "Preset". `docs/configuration.md` stops saying `plugins` needs no sync.

### Requirement: The private npm docs

The factory SHALL behave as this line says: When this ships, `docs/github/setup.md` has the section "Private npm packages", the row in the table of what `init` asks, and the changed sentence under "Changing it later"; `docs/limitations.md`, `docs/github/reference.md`, and `docs/github/by-hand.md` change as "Other pages that change" shows, and no page marks a private preset's workflows _Planned_.

#### Scenario: The private npm docs

- **WHEN** this ships
- **THEN** `docs/github/setup.md` has the section "Private npm packages", the row in the table of what `init` asks, and the changed sentence under "Changing it later"; `docs/limitations.md`, `docs/github/reference.md`, and `docs/github/by-hand.md` change as "Other pages that change" shows, and no page marks a private preset's workflows _Planned_.

### Requirement: The docs require every column

The factory SHALL behave as this line says: `docs/configuration.md`, `docs/existing-repo.md`, `docs/updating.md`, and `docs/builds.md` read as "The docs pages" under Proposed docs shows them, and `docs/workflow.md`, `docs/github/by-hand.md`, and `docs/presets.md` change as "The docs that change" says. The `docker run` example in `docs/builds.md`, under the poller image, gains `-e FACTORY_READY_COLUMN=Ready \` after `-e FACTORY_BOARD_TOKEN \`.

#### Scenario: The docs require every column

- **WHEN** the docs describe `tickets.columns`, the poller's variables, and updating
- **THEN** `docs/configuration.md`, `docs/existing-repo.md`, `docs/updating.md`, and `docs/builds.md` read as "The docs pages" under Proposed docs shows them, and `docs/workflow.md`, `docs/github/by-hand.md`, and `docs/presets.md` change as "The docs that change" says. The `docker run` example in `docs/builds.md`, under the poller image, gains `-e FACTORY_READY_COLUMN=Ready \` after `-e FACTORY_BOARD_TOKEN \`.

### Requirement: The configuration page's code-host

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The configuration page's code-host

- **WHEN** a reader opens `docs/configuration.md`
- **THEN** its `code-host` section reads as "The docs page" under Proposed docs shows it, with its `branch-name` entry also saying what "The docs on an organization's branch names" says; "How the file works" names `version`, `repository`, and `code-host.branch-name` as required and `commands.gate` before any build; and "The shortest file" and the three complete files each hold the `code-host` block with `branch-name: "{ticket}"`.

### Requirement: The CLI page's branch commands

The factory SHALL behave as this line says: When a reader opens `docs/cli.md`, it lists `factory ticket branch N` under Tickets and `factory pr for-branch BRANCH` under Pull requests, and its "Your repository's commands" has rows for `factory specs list`, `factory specs new N`, `factory specs check`, and `factory specs finish N`, the note after the table, and no row for `factory specs change-name N`, worded as "The sections that change" under Proposed docs shows.

#### Scenario: The CLI page's branch commands

- **WHEN** a reader opens `docs/cli.md`
- **THEN** it lists `factory ticket branch N` under Tickets and `factory pr for-branch BRANCH` under Pull requests, and its "Your repository's commands" has rows for `factory specs list`, `factory specs new N`, `factory specs check`, and `factory specs finish N`, the note after the table, and no row for `factory specs change-name N`, worded as "The sections that change" under Proposed docs shows.

### Requirement: The updating and presets pages

The factory SHALL behave as this line says: When a reader opens `docs/updating.md`, it says the update that brings this in stops until `factory init` adds `branch-name`, beside #53's columns, and `docs/presets.md` names `code-host.branch-name` as a setting a preset can share.

#### Scenario: The updating and presets pages

- **WHEN** a reader opens `docs/updating.md`
- **THEN** it says the update that brings this in stops until `factory init` adds `branch-name`, beside #53's columns, and `docs/presets.md` names `code-host.branch-name` as a setting a preset can share.

### Requirement: No approvers setting in the docs

The factory SHALL behave as this line says: When a reader opens `docs/configuration.md`, it has no `approvers` section, and "What is built" in `docs/developing.md` has no row for it.

#### Scenario: No approvers setting in the docs

- **WHEN** a reader opens `docs/configuration.md`
- **THEN** it has no `approvers` section, and "What is built" in `docs/developing.md` has no row for it.

### Requirement: The glossary's approver

The factory SHALL behave as this line says: When a reader opens `docs/glossary.md`, it defines an approver as a person whose account can write to the repository, and says the board's access decides who can approve a ticket for building.

#### Scenario: The glossary's approver

- **WHEN** a reader opens `docs/glossary.md`
- **THEN** it defines an approver as a person whose account can write to the repository, and says the board's access decides who can approve a ticket for building.

### Requirement: The limitations page's approvers

The factory SHALL behave as this line says: When a reader opens `docs/limitations.md`, it no longer says the factory is written for one approver or that trust "rests on one account's login". It says who is an approver, and that review by teams, required reviewers for a folder, and a number of approvals are the code host's to enforce.

#### Scenario: The limitations page's approvers

- **WHEN** a reader opens `docs/limitations.md`
- **THEN** it no longer says the factory is written for one approver or that trust "rests on one account's login". It says who is an approver, and that review by teams, required reviewers for a folder, and a number of approvals are the code host's to enforce.

### Requirement: The existing-repo page's team

The factory SHALL behave as this line says: When a reader opens `docs/existing-repo.md`, it no longer says only the repository's owner is obeyed, and "A team" says anyone who can write to the repository is, with nothing to list.

#### Scenario: The existing-repo page's team

- **WHEN** a reader opens `docs/existing-repo.md`
- **THEN** it no longer says only the repository's owner is obeyed, and "A team" says anyone who can write to the repository is, with nothing to list.

### Requirement: The CLI page's approver commands

The factory SHALL behave as this line says: When a reader opens `docs/cli.md`, it has a row for `factory ticket answers N`, names `--from-approvers` in the `factory pr comments N` row, and says "an approver's review" in the `factory pr review-pending` row.

#### Scenario: The CLI page's approver commands

- **WHEN** a reader opens `docs/cli.md`
- **THEN** it has a row for `factory ticket answers N`, names `--from-approvers` in the `factory pr comments N` row, and says "an approver's review" in the `factory pr review-pending` row.

### Requirement: The builds page's agent account

The factory SHALL behave as this line says: When a reader opens `docs/builds.md`, under "Who it acts as" it says an agent account counts as an approver and that a session never takes a comment carrying the factory's mark as an instruction.

#### Scenario: The builds page's agent account

- **WHEN** a reader opens `docs/builds.md`
- **THEN** under "Who it acts as" it says an agent account counts as an approver and that a session never takes a comment carrying the factory's mark as an instruction.

### Requirement: The configuration page's specs sections

The factory SHALL behave as this line says: When a reader opens `docs/configuration.md`, its `specs` and `specs.check` sections read as "The sections that change" under Proposed docs shows.

#### Scenario: The configuration page's specs sections

- **WHEN** a reader opens `docs/configuration.md`
- **THEN** its `specs` and `specs.check` sections read as "The sections that change" under Proposed docs shows.

### Requirement: The workflow page's spec section

The factory SHALL behave as this line says: When a reader opens `docs/workflow.md`, its "A change your users will see" section reads as "The sections that change" under Proposed docs shows.

#### Scenario: The workflow page's spec section

- **WHEN** a reader opens `docs/workflow.md`
- **THEN** its "A change your users will see" section reads as "The sections that change" under Proposed docs shows.

### Requirement: The setup page's spec tool question

The factory SHALL behave as this line says: When a reader opens `docs/github/setup.md`, "Run `factory init`" shows the spec tool question and says init skips either question the settings or a preset answer, as "The sections that change" under Proposed docs shows.

#### Scenario: The setup page's spec tool question

- **WHEN** a reader opens `docs/github/setup.md`
- **THEN** "Run `factory init`" shows the spec tool question and says init skips either question the settings or a preset answer, as "The sections that change" under Proposed docs shows.

### Requirement: The developing page's spec tools

The factory SHALL behave as this line says: When a reader opens `docs/developing.md`, its "What is built" table has the row "Another spec tool, such as Spec Kit", "Not planned. An adapter under `src/specs/` adds one".

#### Scenario: The developing page's spec tools

- **WHEN** a reader opens `docs/developing.md`
- **THEN** its "What is built" table has the row "Another spec tool, such as Spec Kit", "Not planned. An adapter under `src/specs/` adds one".

### Requirement: The glossary's Spec entry

The factory SHALL behave as this line says: When a reader opens `docs/glossary.md`, its Spec entry reads as Proposed docs §6 shows.

#### Scenario: The glossary's Spec entry

- **WHEN** a reader opens `docs/glossary.md`
- **THEN** its Spec entry reads as Proposed docs §6 shows.

### Requirement: Adding a spec tool

The factory SHALL behave as this line says: When a reader opens `docs/developing.md`, it has a section "Adding a spec tool", beside "Adding a ticket system", with the table of what an adapter gives from Proposed docs §5.

#### Scenario: Adding a spec tool

- **WHEN** a reader opens `docs/developing.md`
- **THEN** it has a section "Adding a spec tool", beside "Adding a ticket system", with the table of what an adapter gives from Proposed docs §5.

### Requirement: Label settings and the shortest file in the docs

The factory SHALL behave as this line says: `docs/configuration.md` documents `tickets.labels` and `code-host.labels` as `## Proposed docs` above shows them, and its "The shortest file" section shows `version`, `repository`, `code-host.branch-name`, and `commands.gate`, and, with a board, `tickets.board` and all six `tickets.columns`.

#### Scenario: Label settings and the shortest file in the docs

- **WHEN** the docs are read
- **THEN** `docs/configuration.md` documents `tickets.labels` and `code-host.labels` as `## Proposed docs` above shows them, and its "The shortest file" section shows `version`, `repository`, `code-host.branch-name`, and `commands.gate`, and, with a board, `tickets.board` and all six `tickets.columns`.

### Requirement: No docs page names the old pull request labels

The factory SHALL behave as this line says: No page under `docs/` or `README.md` names `merge: automatic`, `merge: manual`, or `verdict: override`; each names `merge-automatic`, `merge-manual`, or `verdict-override`.

#### Scenario: No docs page names the old pull request labels

- **WHEN** the docs are read
- **THEN** No page under `docs/` or `README.md` names `merge: automatic`, `merge: manual`, or `verdict: override`; each names `merge-automatic`, `merge-manual`, or `verdict-override`.

### Requirement: The presets and updating pages as drafted

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The presets and updating pages as drafted

- **WHEN** a reader opens `docs/presets.md` or `docs/updating.md`
- **THEN** `docs/presets.md` and `docs/updating.md`, down to "Moving to settings version 2", read as the comment "The docs pages, as drafted", corrected wherever the build had to differ.

### Requirement: The other pages and one install

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The other pages and one install

- **WHEN** a reader opens the docs
- **THEN** Each page in that comment's "The other pages" changes as its row says, and no page tells a reader to install the factory in a repository or to run `npm ci` for it.

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

### Requirement: The pages on a run in the cloud

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The pages on a run in the cloud

- **WHEN** a reader opens the docs
- **THEN** `docs/builds.md`, `docs/credentials.md`, `docs/limitations.md`, `docs/configuration.md`, `docs/github/setup.md`, `docs/github/by-hand.md`, and `docs/github/reference.md` say what "A run in the cloud" says, with a diagram of it in `docs/builds.md`.

### Requirement: The docs on an organization's branch names

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The docs on an organization's branch names

- **WHEN** this ships
- **THEN** `docs/github/setup.md` says that `factory init --org` asks how a build names its branch and that the preset holds the answer, the `branch-name` entry in `docs/configuration.md` says the same beside `factory init`, and "Naming build branches" in `docs/updating.md` says how an organization set up earlier adds the lines to its preset. The rest of `code-host` in `docs/configuration.md` reads as before.

### Requirement: The docs on tickets across repositories

The factory SHALL behave as this line says: When the docs are read, they say what "Proposed docs" holds: the page `docs/across-repositories.md`, and each other page as its lines there say.

#### Scenario: The docs on tickets across repositories

- **WHEN** the docs are read
- **THEN** they say what "Proposed docs" holds: the page `docs/across-repositories.md`, and each other page as its lines there say.

### Requirement: The existing-repo page's ticket fields

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The existing-repo page's ticket fields

- **WHEN** a reader opens "Your tickets already have fields" in `docs/existing-repo.md`
- **THEN** The passage that starts "Init stops, and changes nothing, when it can't use the answer" is replaced by the one under "6. The docs" in Proposed docs, and no other page says init stops there.

### Requirement: The existing-repo page's monorepo section

The factory SHALL behave as this line says: When the docs are read, `docs/existing-repo.md` has the section "A monorepo" as `##`, after "A repository that is not JavaScript" and before "You already have a board", and its first sentence names several packages in one repository as the comment's Proposed docs words it.

#### Scenario: The existing-repo page's monorepo section

- **WHEN** When the docs are read
- **THEN** `docs/existing-repo.md` has the section "A monorepo" as `##`, after "A repository that is not JavaScript" and before "You already have a board", and its first sentence names several packages in one repository as the comment's Proposed docs words it.

### Requirement: The configuration page's commands for some folders

The factory SHALL behave as this line says: When the docs are read, `docs/configuration.md` has the comment's changes at the levels the real page uses (`### commands`, `#### Commands for some folders`, `#### commands.ignore`), `README.md`'s row for the existing-repo page names a monorepo, `docs/presets.md` has the folder preset's row and `--in`, and `docs/cli.md` lists `factory coverage`, `factory relock`, `factory build-setup`, and the new flags.

#### Scenario: The configuration page's commands for some folders

- **WHEN** When the docs are read
- **THEN** `docs/configuration.md` has the comment's changes at the levels the real page uses (`### commands`, `#### Commands for some folders`, `#### commands.ignore`), `README.md`'s row for the existing-repo page names a monorepo, `docs/presets.md` has the folder preset's row and `--in`, and `docs/cli.md` lists `factory coverage`, `factory relock`, `factory build-setup`, and the new flags.
