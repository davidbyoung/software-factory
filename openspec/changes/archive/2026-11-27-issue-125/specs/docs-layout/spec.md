## ADDED Requirements

### Requirement: The README routes

The factory SHALL behave as this line says: When a reader opens `README.md`, it holds, in order, the early-use warning, what the factory does, "What you need", "Install", "Three commands in a session", "Every day", "What it works with", "What it holds to", "The docs" with one line per section, and "License", as "The pages" in Proposed docs shows, in 800 to 1,000 words, as `wc -w` counts the whole file.

#### Scenario: The README routes

- **WHEN** a reader opens `README.md`
- **THEN** It holds, in order, the early-use warning, what the factory does, "What you need", "Install", "Three commands in a session", "Every day", "What it works with", "What it holds to", "The docs" with one line per section, and "License", as "The pages" in Proposed docs shows, in 800 to 1,000 words, as `wc -w` counts the whole file.

### Requirement: The docs folders

The factory SHALL behave as this line says: When a reader lists `docs/`, it holds `developing.md` and the ten folders `get-started`, `setup`, `workflow`, `features`, `customize`, `integrations`, `security`, `maintain`, `reference`, and `about`, each holding the pages the sidebar in Proposed docs names, and no other page.

#### Scenario: The docs folders

- **WHEN** a reader lists `docs/`
- **THEN** It holds `developing.md` and the ten folders `get-started`, `setup`, `workflow`, `features`, `customize`, `integrations`, `security`, `maintain`, `reference`, and `about`, each holding the pages the sidebar in Proposed docs names, and no other page.

### Requirement: The three overview pages

The factory SHALL behave as this line says: When a reader opens `docs/setup/README.md`, `docs/features/README.md`, or `docs/integrations/README.md`, it reads as "The pages" in Proposed docs shows.

#### Scenario: The three overview pages

- **WHEN** a reader opens `docs/setup/README.md`
- **THEN** `docs/features/README.md`, or `docs/integrations/README.md`, it reads as "The pages" in Proposed docs shows.

### Requirement: Nothing in today's docs is lost

The factory SHALL behave as this line says: When a section of today's docs is looked for, its text is on the page "Where today's pages go" names, so no fact in today's docs is missing from the new pages.

#### Scenario: Nothing in today's docs is lost

- **WHEN** a section of today's docs is looked for
- **THEN** Its text is on the page "Where today's pages go" names, so no fact in today's docs is missing from the new pages.

### Requirement: How it works

The factory SHALL behave as this line says: When a reader opens `docs/get-started/how-it-works.md`, it holds one diagram of a ticket's path, the two steps that are the reader's, what runs on their machine and what in the cloud, and the kinds of tool the factory works through, in one screen.

#### Scenario: How it works

- **WHEN** a reader opens `docs/get-started/how-it-works.md`
- **THEN** It holds one diagram of a ticket's path, the two steps that are the reader's, what runs on their machine and what in the cloud, and the kinds of tool the factory works through, in one screen.

### Requirement: The quick start in an organization

The factory SHALL behave as this line says: When a reader opens `docs/get-started/quick-start.md`, its first lines say that nothing on the page changes when the repository belongs to an organization, and to ask an owner before turning on a feature that runs in the cloud, linking `docs/setup/README.md`.

#### Scenario: The quick start in an organization

- **WHEN** a reader opens `docs/get-started/quick-start.md`
- **THEN** Its first lines say that nothing on the page changes when the repository belongs to an organization, and to ask an owner before turning on a feature that runs in the cloud, linking `docs/setup/README.md`.

### Requirement: What each developer does next

The factory SHALL behave as this line says: When a reader opens `docs/setup/organization.md`, it has a heading "What each developer does next".

#### Scenario: What each developer does next

- **WHEN** a reader opens `docs/setup/organization.md`
- **THEN** It has a heading "What each developer does next".

### Requirement: A feature page ends on its tools

The factory SHALL behave as this line says: When a reader opens a page under `docs/features/` other than its `README.md`, its last heading is "On your tools", with one link to each page under `docs/integrations/` the feature depends on.

#### Scenario: A feature page ends on its tools

- **WHEN** a reader opens a page under `docs/features/` other than its `README.md`
- **THEN** Its last heading is "On your tools", with one link to each page under `docs/integrations/` the feature depends on.

### Requirement: Troubleshooting

The factory SHALL behave as this line says: When a reader opens `docs/maintain/troubleshooting.md`, it starts with reading `factory doctor`, then has one heading per symptom in the reader's words, each linking to the page that owns the fix.

#### Scenario: Troubleshooting

- **WHEN** a reader opens `docs/maintain/troubleshooting.md`
- **THEN** It starts with reading `factory doctor`, then has one heading per symptom in the reader's words, each linking to the page that owns the fix.

### Requirement: Upgrade notes

The factory SHALL behave as this line says: When a reader opens `docs/maintain/upgrade-notes.md`, it holds the by-hand steps of each release, newest first, one heading per change, from "Moving to one install on your machine" to "Grouped checks" in today's `docs/updating.md`.

#### Scenario: Upgrade notes

- **WHEN** a reader opens `docs/maintain/upgrade-notes.md`
- **THEN** It holds the by-hand steps of each release, newest first, one heading per change, from "Moving to one install on your machine" to "Grouped checks" in today's `docs/updating.md`.

### Requirement: A setting links to its page

The factory SHALL behave as this line says: When a page first names a setting, it links to the setting's entry on its page under `docs/reference/settings/`, such as `reference/settings/tickets.md#ticketsfields`.

#### Scenario: A setting links to its page

- **WHEN** a page first names a setting
- **THEN** It links to the setting's entry on its page under `docs/reference/settings/`, such as `reference/settings/tickets.md#ticketsfields`.

### Requirement: The rules for a page

The factory SHALL behave as this line says: When a reader opens "A page a reader follows" in `docs/developing.md`, it holds rules 2 and 5 of "Rules that keep it tidy".

#### Scenario: The rules for a page

- **WHEN** a reader opens "A page a reader follows" in `docs/developing.md`
- **THEN** It holds rules 2 and 5 of "Rules that keep it tidy".
