## ADDED Requirements

### Requirement: What is left by hand, by tool

The factory SHALL behave as this line says: When `factory remove` lists what is left by hand, it prints each tool's lines under the tool's label, indented two spaces, in the order code host, ticket system, runner, and coding agent, then `Then`, holding the `npm uninstall` lines and the line to commit; a tool with no lines has no heading, and the steps are numbered straight through the groups.

#### Scenario: What is left by hand, by tool

- **WHEN** `factory remove` lists what is left by hand
- **THEN** it prints each tool's lines under the tool's label, indented two spaces, in the order code host, ticket system, runner, and coding agent, then `Then`, holding the `npm uninstall` lines and the line to commit; a tool with no lines has no heading, and the steps are numbered straight through the groups.

### Requirement: The code host's leftovers

The factory SHALL behave as this line says: When the code host is GitHub, its group holds the ruleset line; one line `Delete the secrets NAMES` for its tokens and `FACTORY_SIGNING_KEY` among those set, ending ` if set` when the secrets cannot be listed, as today; and `Delete whichever of the labels merge: automatic, merge: manual, and verdict: override exist, if you do not want their history: deleting one takes it off every pull request`.

#### Scenario: The code host's leftovers

- **WHEN** the code host is GitHub
- **THEN** its group holds the ruleset line; one line `Delete the secrets NAMES` for its tokens and `FACTORY_SIGNING_KEY` among those set, ending ` if set` when the secrets cannot be listed, as today; and `Delete whichever of the labels merge: automatic, merge: manual, and verdict: override exist, if you do not want their history: deleting one takes it off every pull request`.

### Requirement: GitHub Issues' leftovers

The factory SHALL behave as this line says: When the ticket system is GitHub's, its group holds `Delete whichever of the labels follow-up and spec exist, if you do not want their history: deleting one takes it off every ticket`, then the board's fields line it has today.

#### Scenario: GitHub Issues' leftovers

- **WHEN** the ticket system is GitHub's
- **THEN** its group holds `Delete whichever of the labels follow-up and spec exist, if you do not want their history: deleting one takes it off every ticket`, then the board's fields line it has today.

### Requirement: The credential's leftovers

The factory SHALL list, when the ticket system in use keeps a credential on the machine, the secrets that hold it and the file's entry for the site under the ticket system's group of what `factory remove` leaves by hand.

#### Scenario: The credential's leftovers

- **WHEN** the ticket system in use keeps a credential on the machine
- **THEN** its group holds `Delete the secrets NAMES` for the credential's names among those set, as line 28 words it, and, when the file holds an entry for the site, `Delete SITE from PATH, unless another repository on that site uses it`, with `, and revoke the token at PAGE` before the full stop when the tool names a page. When the file cannot be read, that line ends `, if it is there`. When the settings cannot be read, there is no site, and no such line.

## REMOVED Requirements

### Requirement: What is left by hand

**Reason**: The labels are no longer listed as one line: the pull requests' labels are under the code host and the tickets' under the ticket system, each by its configured name.

**Migration**: See "What is left by hand, by tool", "The code host's leftovers", and "GitHub Issues' leftovers".
