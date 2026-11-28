# ticket-repositories Specification

## Purpose

The repositories a ticket names and the order they merge in: the section that holds them, the command that records them, and what the other ticket commands do with them.

## Requirements

### Requirement: The list printed

kodor SHALL behave as this line says: When `kodor ticket repositories N` runs on a ticket whose body has a `## Repositories` section, it prints `#12 repositories`, then one line for each repository in the section's order, and exits 0 when every line starts `✓` and 1 otherwise.

#### Scenario: The list printed

- **WHEN** `kodor ticket repositories N` runs on a ticket whose body has a `## Repositories` section
- **THEN** it prints `#12 repositories`, then one line for each repository in the section's order, and exits 0 when every line starts `✓` and 1 otherwise.

### Requirement: No list

kodor SHALL behave as this line says: When it runs on a ticket with no such section, it prints `#12 builds in acme/api.`, the ticket's own repository, and exits 0.

#### Scenario: No list

- **WHEN** it runs on a ticket with no such section
- **THEN** it prints `#12 builds in acme/api.`, the ticket's own repository, and exits 0.

### Requirement: A repository set up

kodor SHALL behave as this line says: When a repository's default branch has a `.claude/kodor.lock` whose `settings.tickets.fields` has a `repositories` key, its line is `✓ acme/api   set up`, the names padded to one width.

#### Scenario: A repository set up

- **WHEN** a repository's default branch has a `.claude/kodor.lock` whose `settings.tickets.fields` has a `repositories` key
- **THEN** its line is `✓ acme/api   set up`, the names padded to one width.

### Requirement: A repository not set up

kodor SHALL behave as this line says: When the repository has no lock there, its line is `✗ acme/web   not set up: run kodor init in acme/web before building`.

#### Scenario: A repository not set up

- **WHEN** the repository has no lock there
- **THEN** its line is `✗ acme/web   not set up: run kodor init in acme/web before building`.

### Requirement: A factory too old

kodor SHALL behave as this line says: When its lock has no such key, its line is `✗ acme/web   on kodor 0.9.0, which can't build a ticket from another repository: run kodor update in acme/web`, with the lock's version.

#### Scenario: A factory too old

- **WHEN** its lock has no such key
- **THEN** its line is `✗ acme/web   on kodor 0.9.0, which can't build a ticket from another repository: run kodor update in acme/web`, with the lock's version.

### Requirement: Setting the list

kodor SHALL behave as this line says: When `--set REPO...` is given and nothing is refused, the body's section becomes one `- owner/name` line for each repository in the order given, with `, after owner/name` for each `--after LATER=EARLIER`, several joined by `, after`; the lines of 1 are printed, then `Recorded on #12.` and, for each pair, ` acme/web merges after acme/api.` on the same line; it exits 0 whatever the marks are.

#### Scenario: Setting the list

- **WHEN** `--set REPO...` is given and nothing is refused
- **THEN** the body's section becomes one `- owner/name` line for each repository in the order given, with `, after owner/name` for each `--after LATER=EARLIER`, several joined by `, after`; the lines of 1 are printed, then `Recorded on #12.` and, for each pair, ` acme/web merges after acme/api.` on the same line; it exits 0 whatever the marks are.

### Requirement: Adding to the list

kodor SHALL behave as this line says: When `--add REPO...` is given, the repositories and pairs are added to the section, which starts with the ticket's own repository where there was none, and the rest is as line 6.

#### Scenario: Adding to the list

- **WHEN** `--add REPO...` is given
- **THEN** the repositories and pairs are added to the section, which starts with the ticket's own repository where there was none, and the rest is as line 6.

### Requirement: Back to the ticket's own

kodor SHALL behave as this line says: When `--set` names only the ticket's own repository, the section is removed and `#12 builds in acme/api.` is printed.

#### Scenario: Back to the ticket's own

- **WHEN** `--set` names only the ticket's own repository
- **THEN** the section is removed and `#12 builds in acme/api.` is printed.

### Requirement: A repository not found

kodor SHALL behave as this line says: When a repository given does not exist or the sign-in cannot see it, its line is `✗ acme/wbe   not found, or you can't see it`, nothing is recorded, and it exits 1.

#### Scenario: A repository not found

- **WHEN** a repository given does not exist or the sign-in cannot see it
- **THEN** its line is `✗ acme/wbe   not found, or you can't see it`, nothing is recorded, and it exits 1.

### Requirement: Another owner

kodor SHALL behave as this line says: When a repository given has another owner than the ticket's own, its line is `✗ other/web   another owner than acme/api: a ticket's repositories have one owner`, nothing is recorded, and it exits 1.

#### Scenario: Another owner

- **WHEN** a repository given has another owner than the ticket's own
- **THEN** its line is `✗ other/web   another owner than acme/api: a ticket's repositories have one owner`, nothing is recorded, and it exits 1.

### Requirement: An order that cannot be

kodor SHALL behave as this line says: When the pairs go in a circle, it prints `✗ acme/api and acme/web each merge after the other`, or for a longer circle `✗ The order goes in a circle: A, B, C`, records nothing, and exits 1. A pair that names a repository not in the list prints `✗ --after names acme/ios, which is not one of #12's repositories`, records nothing, and exits 1.

#### Scenario: An order that cannot be

- **WHEN** the pairs go in a circle
- **THEN** it prints `✗ acme/api and acme/web each merge after the other`, or for a longer circle `✗ The order goes in a circle: A, B, C`, records nothing, and exits 1. A pair that names a repository not in the list prints `✗ --after names acme/ios, which is not one of #12's repositories`, records nothing, and exits 1.

### Requirement: A section that cannot be read

kodor SHALL behave as this line says: When a line of the section is not `- owner/name` with any `, after owner/name`, every command that reads the section prints `✗ #12's Repositories section: can't read "- acme web"`, with that line, and exits 1.

#### Scenario: A section that cannot be read

- **WHEN** a line of the section is not `- owner/name` with any `, after owner/name`
- **THEN** every command that reads the section prints `✗ #12's Repositories section: can't read "- acme web"`, with that line, and exits 1.

### Requirement: An edit keeps the section

kodor SHALL behave as this line says: When `kodor ticket edit N --body-file` is given a body without the section and the ticket has one, the edited body keeps the ticket's section. From a cloud session, it keeps the ticket's whatever the body has, and adds none.

#### Scenario: An edit keeps the section

- **WHEN** `kodor ticket edit N --body-file` is given a body without the section and the ticket has one
- **THEN** the edited body keeps the ticket's section. From a cloud session, it keeps the ticket's whatever the body has, and adds none.

### Requirement: An open pull request that closes the ticket

kodor SHALL behave as this line says: When `--add` names a repository and an open pull request of the ticket's own repository says it closes the ticket, the link line in its body becomes the one `kodor ticket link` prints, `Part of`.

#### Scenario: An open pull request that closes the ticket

- **WHEN** `--add` names a repository and an open pull request of the ticket's own repository says it closes the ticket
- **THEN** the link line in its body becomes the one `kodor ticket link` prints, `Part of`.

### Requirement: A list changed during a build

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A list changed during a build

- **WHEN** `--set` or `--add` runs while a claim is live and a repository of the ticket has no pull request yet
- **THEN** it prints `✗ #12 is being built: wait for it, or stop that build first`, records nothing, and exits 1. When `--add` runs otherwise and a pull request of the ticket counts (line 52), its claim ends, a note on the ticket says `acme/mobile was added. The card stays In progress, waiting on you.` and the ticket is In progress, "Waiting on you".

### Requirement: A dropped repository's pull request

kodor SHALL behave as this line says: When `--set` drops a repository with an open pull request for the ticket, it prints `? acme/web#41 is still open: close it, or merge it knowing that #12 does not wait for it`, and exits as line 6.

#### Scenario: A dropped repository's pull request

- **WHEN** `--set` drops a repository with an open pull request for the ticket
- **THEN** it prints `? acme/web#41 is still open: close it, or merge it knowing that #12 does not wait for it`, and exits as line 6.

### Requirement: A claim on a ticket not ready

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A claim on a ticket not ready

- **WHEN** `kodor ticket claim N` runs and a repository's line is not `✓`
- **THEN** it posts nothing and prints `✗ #12 names acme/web, which is not set up: run kodor init in acme/web`, or for line 5's case `✗ #12 names acme/web, whose factory is too old: run kodor update in acme/web`, or for line 9's `✗ #12 names acme/web, which was not found, or you can't see it`, and exits 1. In a run in the cloud it stops the ticket with the same words as the reason.

### Requirement: A claim from another checkout

kodor SHALL behave as this line says: When a claim runs in a checkout whose repository the ticket does not name, it posts nothing, prints `✗ This checkout, acme/docs, is not one of #12's repositories: acme/api, acme/web`, and exits 1.

#### Scenario: A claim from another checkout

- **WHEN** a claim runs in a checkout whose repository the ticket does not name
- **THEN** it posts nothing, prints `✗ This checkout, acme/docs, is not one of #12's repositories: acme/api, acme/web`, and exits 1.

### Requirement: The link lines

kodor SHALL behave as this line says: When `kodor ticket link N` runs for a ticket that names another repository, it prints `Part of #12` in the ticket's own repository and `Part of acme/api#12` in another, then one `Depends-On: acme/api#88` line for each repository this one merges after that has an open or merged pull request for the ticket.

#### Scenario: The link lines

- **WHEN** `kodor ticket link N` runs for a ticket that names another repository
- **THEN** it prints `Part of #12` in the ticket's own repository and `Part of acme/api#12` in another, then one `Depends-On: acme/api#88` line for each repository this one merges after that has an open or merged pull request for the ticket.

### Requirement: The refined check

kodor SHALL behave as this line says: When `kodor ticket refined N --check` or `refined` runs on a ticket with a section line 13 refuses, it prints `missing: a Repositories section that can be read: "- acme web"`, with that line.

#### Scenario: The refined check

- **WHEN** `kodor ticket refined N --check` or `refined` runs on a ticket with a section line 13 refuses
- **THEN** it prints `missing: a Repositories section that can be read: "- acme web"`, with that line.
