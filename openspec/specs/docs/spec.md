# docs Specification

## Purpose

What the docs say about the scheduled poller, the poller's published image, and `lunamill pr uncovered`.

## Requirements

### Requirement: The builds page

Lunamill SHALL behave as this line says: `docs/features/builds-from-the-board.md`: "A scheduled poller" loses its Planned mark and gives the cost per interval on a private repository and the 5 to 15 minute pickup. "The poller" shows the image, its four variables, and the optional one-line Dockerfile with the `.github/dependabot.yml` entry that keeps its version current.

#### Scenario: The builds page

- **WHEN** a reader opens `docs/features/builds-from-the-board.md`
- **THEN** `docs/features/builds-from-the-board.md`: "A scheduled poller" loses its Planned mark and gives the cost per interval on a private repository and the 5 to 15 minute pickup. "The poller" shows the image, its four variables, and the optional one-line Dockerfile with the `.github/dependabot.yml` entry that keeps its version current.

### Requirement: The configuration page

Lunamill SHALL behave as this line says: `docs/reference/settings/builds.md` gives `builds.poll-minutes` with its values and default, and drops the Planned mark and the refusal from `builds.trigger`'s `github-action`.

#### Scenario: The configuration page

- **WHEN** a reader opens `docs/reference/settings/builds.md`
- **THEN** `docs/reference/settings/builds.md` gives `builds.poll-minutes` with its values and default, and drops the Planned mark and the refusal from `builds.trigger`'s `github-action`.

### Requirement: The CLI page and what is built

Lunamill SHALL behave as this line says: `docs/reference/cli-internal.md` marks `lunamill poller --once` Built, and "What is built" in `docs/developing.md` says Working for the row #12 names.

#### Scenario: The CLI page and what is built

- **WHEN** a reader opens `docs/reference/cli-internal.md` or "What is built"
- **THEN** `docs/reference/cli-internal.md` marks `lunamill poller --once` Built, and "What is built" in `docs/developing.md` says Working for the row #12 names.

### Requirement: The CLI page lists pr uncovered

Lunamill SHALL behave as this line says: `docs/reference/cli-internal.md` lists `lunamill pr uncovered [BASE] [LCOV]` under "Pull requests", and says what it prints, what `MISS` and `PART` mean, and what `BASE` and `LCOV` are when left out.

#### Scenario: The CLI page lists pr uncovered

- **WHEN** a reader opens `docs/reference/cli-internal.md`
- **THEN** `docs/reference/cli-internal.md` lists `lunamill pr uncovered [BASE] [LCOV]` under "Pull requests", and says what it prints, what `MISS` and `PART` mean, and what `BASE` and `LCOV` are when left out.

### Requirement: The configuration page for version 2

Lunamill SHALL behave as this line says: the pages under `docs/reference/settings/` documents `commands` and each key under it, `specs.check` with its default, and `plugins` by phase, saying for each role whether it takes a skill or an agent, one or a list, `files` or `labels`, and what is used when it is left out. Its example settings files are version 1.

#### Scenario: The configuration page for version 2

- **WHEN** the docs are read
- **THEN** the pages under `docs/reference/settings/` documents `commands` and each key under it, `specs.check` with its default, and `plugins` by phase, saying for each role whether it takes a skill or an agent, one or a list, `files` or `labels`, and what is used when it is left out. Its example settings files are version 1.

### Requirement: The plugins page

Lunamill SHALL behave as this line says: `docs/customize/plugins.md` has one table for each role giving when it is called, what it is handed, what it returns, and what happens next. It lists what a `refiner` must deliver, what a `prover` must report, that `test.reviewers` is the whole list, that a resolver is read from the default branch's copy, that reviewers still run after a builder, and that extra refinement questions go in a "Refining: this repository" section of `CLAUDE.md`.

#### Scenario: The plugins page

- **WHEN** a reader opens the docs
- **THEN** `docs/customize/plugins.md` has one table for each role giving when it is called, what it is handed, what it returns, and what happens next. It lists what a `refiner` must deliver, what a `prover` must report, that `test.reviewers` is the whole list, that a resolver is read from the default branch's copy, that reviewers still run after a builder, and that extra refinement questions go in a "Refining: this repository" section of `CLAUDE.md`.

### Requirement: The updating page

Lunamill SHALL behave as this line says: `docs/maintain/upgrade-notes.md` has a section "Moving to settings version 2" that shows each key that moved or changed shape, before and after.

#### Scenario: The updating page

- **WHEN** a reader opens the docs
- **THEN** `docs/maintain/upgrade-notes.md` has a section "Moving to settings version 2" that shows each key that moved or changed shape, before and after.

### Requirement: The CLI page's new commands

Lunamill SHALL behave as this line says: `docs/reference/cli.md` and `docs/reference/cli-internal.md` has rows for `lunamill gate`, `lunamill test-one`, `lunamill end-to-end`, `lunamill specs check`, and `lunamill default-branch`, and names `--check` in the `lunamill ticket refined` row.

#### Scenario: The CLI page's new commands

- **WHEN** a reader opens the docs
- **THEN** `docs/reference/cli.md` and `docs/reference/cli-internal.md` has rows for `lunamill gate`, `lunamill test-one`, `lunamill end-to-end`, `lunamill specs check`, and `lunamill default-branch`, and names `--check` in the `lunamill ticket refined` row.

### Requirement: No migrate row

Lunamill SHALL behave as this line says: "What is built" in `docs/developing.md` has no `lunamill migrate` row.

#### Scenario: No migrate row

- **WHEN** a reader opens the docs
- **THEN** "What is built" in `docs/developing.md` has no `lunamill migrate` row.

### Requirement: What a plugin can replace

Lunamill SHALL behave as this line says: "The order of the workflow is fixed" in `docs/about/design.md`, and the line of the same name in `docs/about/limitations.md`, say which steps a plugin can replace and that the states and their order still cannot change. `docs/about/limitations.md` no longer says a build assumes `main`, if it does anywhere.

#### Scenario: What a plugin can replace

- **WHEN** a reader opens the docs
- **THEN** "The order of the workflow is fixed" in `docs/about/design.md`, and the line of the same name in `docs/about/limitations.md`, say which steps a plugin can replace and that the states and their order still cannot change. `docs/about/limitations.md` no longer says a build assumes `main`, if it does anywhere.

### Requirement: The quick start names the gate

Lunamill SHALL behave as this line says: `docs/get-started/quick-start.md` tells a new user to set `commands.gate` before the first build.

#### Scenario: The quick start names the gate

- **WHEN** a reader opens the docs
- **THEN** `docs/get-started/quick-start.md` tells a new user to set `commands.gate` before the first build.

### Requirement: The presets docs

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The presets docs

- **WHEN** this ships
- **THEN** the pages under `docs/reference/settings/` has a `presets` entry and says under "How the file works" that every command reads the lock, `docs/reference/cli.md` lists `lunamill preset add`, `remove`, `choices`, `choose`, `check`, and `changes`, `docs/maintain/updating.md` points preset updates to `docs/customize/presets.md`, and `docs/reference/glossary.md` has "Preset". the pages under `docs/reference/settings/` stops saying `plugins` needs no sync.

### Requirement: The private npm docs

Lunamill SHALL behave as this line says: When this ships, `docs/integrations/private-npm.md` has the section "Private npm packages", the row in the table of what `init` asks, and the changed sentence under "Changing it later"; `docs/about/limitations.md`, `docs/integrations/github-actions.md`, and `docs/integrations/github.md` change as "Other pages that change" shows, and no page marks a private preset's workflows _Planned_.

#### Scenario: The private npm docs

- **WHEN** this ships
- **THEN** `docs/integrations/private-npm.md` has the section "Private npm packages", the row in the table of what `init` asks, and the changed sentence under "Changing it later"; `docs/about/limitations.md`, `docs/integrations/github-actions.md`, and `docs/integrations/github.md` change as "Other pages that change" shows, and no page marks a private preset's workflows _Planned_.

### Requirement: The docs require every column

Lunamill SHALL behave as this line says: the pages under `docs/reference/settings/`, `docs/features/board.md`, `docs/maintain/upgrade-notes.md`, and `docs/features/builds-from-the-board.md` read as "The docs pages" under Proposed docs shows them, and `docs/workflow/README.md`, `docs/integrations/github-projects.md`, and `docs/customize/presets.md` change as "The docs that change" says.

#### Scenario: The docs require every column

- **WHEN** the docs describe `tickets.columns`, the poller's variables, and updating
- **THEN** the pages under `docs/reference/settings/`, `docs/features/board.md`, `docs/maintain/upgrade-notes.md`, and `docs/features/builds-from-the-board.md` read as "The docs pages" under Proposed docs shows them, and `docs/workflow/README.md`, `docs/integrations/github-projects.md`, and `docs/customize/presets.md` change as "The docs that change" says.

### Requirement: The configuration page's code-host

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The configuration page's code-host

- **WHEN** a reader opens `docs/reference/settings/code-host.md`
- **THEN** its `code-host` section reads as "The docs page" under Proposed docs shows it, with its `branch-name` entry also saying what "The docs on an organization's branch names" says; "How the file works" names `version`, `repository`, and `code-host.branch-name` as required and `commands.gate` before any build; and "The shortest file" and the three complete files each hold the `code-host` block with `branch-name: "{ticket}"`.

### Requirement: The CLI page's branch commands

Lunamill SHALL behave as this line says: When a reader opens `docs/reference/cli-internal.md`, it lists `lunamill ticket branch N` under Tickets and `lunamill pr for-branch BRANCH` under Pull requests, and "Your repository's commands" in `docs/reference/cli.md` has rows for the four `lunamill specs` commands, `list`, `new N`, `check`, and `finish N`, the note after the table, and no `lunamill specs change-name N` row, as Proposed docs shows.

#### Scenario: The CLI page's branch commands

- **WHEN** a reader opens `docs/reference/cli-internal.md`
- **THEN** it lists `lunamill ticket branch N` under Tickets and `lunamill pr for-branch BRANCH` under Pull requests, and "Your repository's commands" in `docs/reference/cli.md` has rows for the four `lunamill specs` commands, `list`, `new N`, `check`, and `finish N`, the note after the table, and no `lunamill specs change-name N` row, as Proposed docs shows.

### Requirement: The updating and presets pages

Lunamill SHALL behave as this line says: When a reader opens `docs/maintain/upgrade-notes.md`, it says the update that brings this in stops until `lunamill init` adds `branch-name`, beside #53's columns, and `docs/customize/writing-a-preset.md` names `code-host.branch-name` as a setting a preset can share.

#### Scenario: The updating and presets pages

- **WHEN** a reader opens `docs/maintain/upgrade-notes.md`
- **THEN** it says the update that brings this in stops until `lunamill init` adds `branch-name`, beside #53's columns, and `docs/customize/writing-a-preset.md` names `code-host.branch-name` as a setting a preset can share.

### Requirement: No approvers setting in the docs

Lunamill SHALL behave as this line says: When a reader opens the pages under `docs/reference/settings/`, it has no `approvers` section, and "What is built" in `docs/developing.md` has no row for it.

#### Scenario: No approvers setting in the docs

- **WHEN** a reader opens the pages under `docs/reference/settings/`
- **THEN** it has no `approvers` section, and "What is built" in `docs/developing.md` has no row for it.

### Requirement: The glossary's approver

Lunamill SHALL behave as this line says: When a reader opens `docs/reference/glossary.md`, it defines an approver as a person whose account can write to the repository, and says the board's access decides who can approve a ticket for building.

#### Scenario: The glossary's approver

- **WHEN** a reader opens `docs/reference/glossary.md`
- **THEN** it defines an approver as a person whose account can write to the repository, and says the board's access decides who can approve a ticket for building.

### Requirement: The limitations page's approvers

Lunamill SHALL behave as this line says: When a reader opens `docs/about/limitations.md`, it no longer says Lunamill is written for one approver or that trust "rests on one account's login". It says who is an approver, and that review by teams, required reviewers for a folder, and a number of approvals are the code host's to enforce.

#### Scenario: The limitations page's approvers

- **WHEN** a reader opens `docs/about/limitations.md`
- **THEN** it no longer says Lunamill is written for one approver or that trust "rests on one account's login". It says who is an approver, and that review by teams, required reviewers for a folder, and a number of approvals are the code host's to enforce.

### Requirement: The existing-repo page's team

Lunamill SHALL behave as this line says: When a reader opens `docs/setup/team.md`, it no longer says only the repository's owner is obeyed, and "A team" says anyone who can write to the repository is, with nothing to list.

#### Scenario: The existing-repo page's team

- **WHEN** a reader opens `docs/setup/team.md`
- **THEN** it no longer says only the repository's owner is obeyed, and "A team" says anyone who can write to the repository is, with nothing to list.

### Requirement: The CLI page's approver commands

Lunamill SHALL behave as this line says: When a reader opens `docs/reference/cli-internal.md`, it has a row for `lunamill ticket answers N`, names `--from-approvers` in the `lunamill pr comments N` row, and says "an approver's review" in the `lunamill pr review-pending` row.

#### Scenario: The CLI page's approver commands

- **WHEN** a reader opens `docs/reference/cli-internal.md`
- **THEN** it has a row for `lunamill ticket answers N`, names `--from-approvers` in the `lunamill pr comments N` row, and says "an approver's review" in the `lunamill pr review-pending` row.

### Requirement: The builds page's agent account

Lunamill SHALL behave as this line says: When a reader opens `docs/features/cloud-builds.md`, under "Who it acts as" it says an agent account counts as an approver and that a session never takes a comment carrying Lunamill's mark as an instruction.

#### Scenario: The builds page's agent account

- **WHEN** a reader opens `docs/features/cloud-builds.md`
- **THEN** under "Who it acts as" it says an agent account counts as an approver and that a session never takes a comment carrying Lunamill's mark as an instruction.

### Requirement: The configuration page's specs sections

Lunamill SHALL behave as this line says: When a reader opens `docs/reference/settings/specs.md`, its `specs` and `specs.check` sections read as "The sections that change" under Proposed docs shows.

#### Scenario: The configuration page's specs sections

- **WHEN** a reader opens `docs/reference/settings/specs.md`
- **THEN** its `specs` and `specs.check` sections read as "The sections that change" under Proposed docs shows.

### Requirement: The workflow page's spec section

Lunamill SHALL behave as this line says: When a reader opens `docs/features/specs.md`, its "A change your users will see" section reads as "The sections that change" under Proposed docs shows.

#### Scenario: The workflow page's spec section

- **WHEN** a reader opens `docs/features/specs.md`
- **THEN** its "A change your users will see" section reads as "The sections that change" under Proposed docs shows.

### Requirement: The setup page's spec tool question

Lunamill SHALL behave as this line says: When a reader opens `docs/setup/repository.md`, "Run `lunamill init`" shows the spec tool question and says init skips either question the settings or a preset answer, as "The sections that change" under Proposed docs shows.

#### Scenario: The setup page's spec tool question

- **WHEN** a reader opens `docs/setup/repository.md`
- **THEN** "Run `lunamill init`" shows the spec tool question and says init skips either question the settings or a preset answer, as "The sections that change" under Proposed docs shows.

### Requirement: The developing page's spec tools

Lunamill SHALL behave as this line says: When a reader opens `docs/developing.md`, its "What is built" table has the row "Another spec tool, such as Spec Kit", "Not planned. An adapter under `src/specs/` adds one".

#### Scenario: The developing page's spec tools

- **WHEN** a reader opens `docs/developing.md`
- **THEN** its "What is built" table has the row "Another spec tool, such as Spec Kit", "Not planned. An adapter under `src/specs/` adds one".

### Requirement: The glossary's Spec entry

Lunamill SHALL behave as this line says: When a reader opens `docs/reference/glossary.md`, its Spec entry reads as Proposed docs §6 shows.

#### Scenario: The glossary's Spec entry

- **WHEN** a reader opens `docs/reference/glossary.md`
- **THEN** its Spec entry reads as Proposed docs §6 shows.

### Requirement: Adding a spec tool

Lunamill SHALL behave as this line says: When a reader opens `docs/developing.md`, it has a section "Adding a spec tool", beside "Adding a ticket system", with the table of what an adapter gives from Proposed docs §5.

#### Scenario: Adding a spec tool

- **WHEN** a reader opens `docs/developing.md`
- **THEN** it has a section "Adding a spec tool", beside "Adding a ticket system", with the table of what an adapter gives from Proposed docs §5.

### Requirement: Label settings and the shortest file in the docs

Lunamill SHALL behave as this line says: the pages under `docs/reference/settings/` documents `tickets.labels` and `code-host.labels` as `## Proposed docs` above shows them, and its "The shortest file" section shows `version`, `repository`, `code-host.branch-name`, and `commands.gate`, and, with a board, `tickets.board` and all six `tickets.columns`.

#### Scenario: Label settings and the shortest file in the docs

- **WHEN** the docs are read
- **THEN** the pages under `docs/reference/settings/` documents `tickets.labels` and `code-host.labels` as `## Proposed docs` above shows them, and its "The shortest file" section shows `version`, `repository`, `code-host.branch-name`, and `commands.gate`, and, with a board, `tickets.board` and all six `tickets.columns`.

### Requirement: No docs page names the old pull request labels

Lunamill SHALL behave as this line says: No page under `docs/` or `README.md` names `merge: automatic`, `merge: manual`, or `verdict: override`; each names `merge-automatic`, `merge-manual`, or `verdict-override`.

#### Scenario: No docs page names the old pull request labels

- **WHEN** the docs are read
- **THEN** No page under `docs/` or `README.md` names `merge: automatic`, `merge: manual`, or `verdict: override`; each names `merge-automatic`, `merge-manual`, or `verdict-override`.

### Requirement: The presets and updating pages as drafted

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The presets and updating pages as drafted

- **WHEN** a reader opens `docs/customize/presets.md` and `docs/customize/writing-a-preset.md` or `docs/maintain/updating.md` and `docs/maintain/upgrade-notes.md`
- **THEN** `docs/customize/presets.md` and `docs/customize/writing-a-preset.md` and `docs/maintain/updating.md` and `docs/maintain/upgrade-notes.md`, down to "Moving to settings version 2", read as the comment "The docs pages, as drafted", corrected wherever the build had to differ.

### Requirement: The other pages and one install

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The other pages and one install

- **WHEN** a reader opens the docs
- **THEN** Each page in that comment's "The other pages" changes as its row says, and no page tells a reader to install Lunamill in a repository or to run `npm ci` for it.

### Requirement: The GitHub setup and credentials pages as drafted

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The GitHub setup and credentials pages as drafted

- **WHEN** a reader opens `docs/setup/repository.md` and `docs/setup/organization.md` or `docs/security/credentials.md`
- **THEN** `docs/setup/repository.md` and `docs/setup/organization.md`, down to "Optional: tune it", and "On GitHub" in `docs/security/credentials.md` read as the comment "The docs pages, as drafted", corrected wherever the build had to differ.

### Requirement: The other pages and the App

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The other pages and the App

- **WHEN** a reader opens the docs
- **THEN** Each page in that comment's "The other pages" changes as its row says. No page tells a reader to install Claude's GitHub App, or says a token from a GitHub App is not supported.

### Requirement: The pages on a run in the cloud

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The pages on a run in the cloud

- **WHEN** a reader opens the docs
- **THEN** `docs/features/cloud-builds.md` and `docs/security/cloud-runs.md`, `docs/security/cloud-runs.md`, `docs/about/limitations.md`, the pages under `docs/reference/settings/`, `docs/setup/repository.md`, `docs/integrations/github-actions.md`, and `docs/integrations/github-actions.md` say what "A run in the cloud" says, with a diagram of it in `docs/features/cloud-builds.md` and `docs/security/cloud-runs.md`.

### Requirement: The docs on an organization's branch names

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The docs on an organization's branch names

- **WHEN** this ships
- **THEN** `docs/setup/organization.md` says that `lunamill init --org` asks how a build names its branch and that the preset holds the answer, the `branch-name` entry in the pages under `docs/reference/settings/` says the same beside `lunamill init`, and "Naming build branches" in `docs/maintain/upgrade-notes.md` says how an organization set up earlier adds the lines to its preset. The rest of `code-host` in the pages under `docs/reference/settings/` reads as before.

### Requirement: The docs on tickets across repositories

Lunamill SHALL behave as this line says: When the docs are read, they say what "Proposed docs" holds: the page `docs/workflow/across-repositories.md`, and each other page as its lines there say.

#### Scenario: The docs on tickets across repositories

- **WHEN** the docs are read
- **THEN** they say what "Proposed docs" holds: the page `docs/workflow/across-repositories.md`, and each other page as its lines there say.

### Requirement: The existing-repo page's ticket fields

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The existing-repo page's ticket fields

- **WHEN** a reader opens "Your tickets already have fields" in `docs/features/board.md`
- **THEN** The passage that starts "Init stops, and changes nothing, when it can't use the answer" is replaced by the one under "6. The docs" in Proposed docs, and no other page says init stops there.

### Requirement: The existing-repo page's monorepo section

Lunamill SHALL behave as this line says: When the docs are read, `docs/customize/monorepo.md` is the page for several packages in one repository, and its first sentence names them as the comment's Proposed docs words it.

#### Scenario: The existing-repo page's monorepo section

- **WHEN** the docs are read
- **THEN** `docs/customize/monorepo.md` is the page for several packages in one repository, and its first sentence names them as the comment's Proposed docs words it.

### Requirement: The configuration page's commands for some folders

Lunamill SHALL behave as this line says: When the docs are read, the pages under `docs/reference/settings/` has the comment's changes at the levels the real page uses (`### commands`, `#### Commands for some folders`, `#### commands.ignore`), `README.md`'s row for the existing-repo page names a monorepo, `docs/customize/writing-a-preset.md` has the folder preset's row and `--in`, and `docs/reference/cli.md` lists `lunamill coverage`, `lunamill relock`, `lunamill build-setup`, and the new flags.

#### Scenario: The configuration page's commands for some folders

- **WHEN** When the docs are read
- **THEN** the pages under `docs/reference/settings/` has the comment's changes at the levels the real page uses (`### commands`, `#### Commands for some folders`, `#### commands.ignore`), `README.md`'s row for the existing-repo page names a monorepo, `docs/customize/writing-a-preset.md` has the folder preset's row and `--in`, and `docs/reference/cli.md` lists `lunamill coverage`, `lunamill relock`, `lunamill build-setup`, and the new flags.

### Requirement: The approval policies docs

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The approval policies docs

- **WHEN** the docs are read
- **THEN** `docs/features/approval-policies.md` is the page under "Proposed docs", and the pages under `docs/reference/settings/`, `docs/customize/presets.md`, `docs/customize/plugins.md`, `docs/reference/cli.md`, `docs/workflow/README.md`, and `docs/about/limitations.md` change as "What changes elsewhere in the docs" lists.

### Requirement: The credentials policy docs

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The credentials policy docs

- **WHEN** the docs are read
- **THEN** `docs/features/credentials-policy.md` is the page under "Proposed docs", `docs/workflow/refine.md` changes as it shows, the pages under `docs/reference/settings/`'s `approval-policies` entry says "Lunamill adds one policy of its own, `credentials` ([Lunamill's own policy](approval-policies.md#the-factorys-own-policy)), which `off: true` turns off.", and the page gives the widened rule's measured counts.

### Requirement: The docs on the poller reading the settings

Lunamill SHALL behave as this line says: `docs/features/builds-from-the-board.md`, from "The poller" to "No trigger", and the section "The poller reads your settings" in `docs/maintain/upgrade-notes.md`, read as "The pages as they would read" under Proposed docs shows them; the pages under `docs/reference/settings/` and the rest of `docs/maintain/upgrade-notes.md` change as "The docs that change" says.

#### Scenario: The docs on the poller reading the settings

- **WHEN** this ships
- **THEN** `docs/features/builds-from-the-board.md`, from "The poller" to "No trigger", and the section "The poller reads your settings" in `docs/maintain/upgrade-notes.md`, read as "The pages as they would read" under Proposed docs shows them; the pages under `docs/reference/settings/` and the rest of `docs/maintain/upgrade-notes.md` change as "The docs that change" says.

### Requirement: A printed docs address

Lunamill SHALL behave as this line says: When a command prints the address of a docs page, it is `https://github.com/lunamill-ai/lunamill/blob/vVERSION/docs/PAGE`, or `/blob/main/` for a version that is not a release.

#### Scenario: A printed docs address

- **WHEN** a command prints the address of a docs page
- **THEN** it is `https://github.com/lunamill-ai/lunamill/blob/vVERSION/docs/PAGE`, or `/blob/main/` for a version that is not a release.

### Requirement: The README and Moving to Lunamill

Lunamill SHALL behave as this line says: When the docs are read, `README.md` and the section "Moving to Lunamill" at the top of `docs/maintain/upgrade-notes.md` read as "The pages" under Proposed docs shows them.

#### Scenario: The README and Moving to Lunamill

- **WHEN** the docs are read
- **THEN** `README.md` and the section "Moving to Lunamill" at the top of `docs/maintain/upgrade-notes.md` read as "The pages" under Proposed docs shows them.

### Requirement: The example settings files

Lunamill SHALL behave as this line says: When the docs are read, every example settings file under `docs/` says `version: 1`, except in the upgrade notes below "Moving to Lunamill".

#### Scenario: The example settings files

- **WHEN** the docs are read
- **THEN** every example settings file under `docs/` says `version: 1`, except in the upgrade notes below "Moving to Lunamill".
