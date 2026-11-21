## Purpose

What `tickets.fields`' ticket-side keys mean: `factory ticket view` joins a ticket's description and its ticket fields into one document, `edit` splits it, and the settings and doctor check the fields named.

## ADDED Requirements

### Requirement: View joins the ticket fields

The factory SHALL behave as this line says: When `tickets.fields` names a ticket field for a ticket-side key, `factory ticket view N`, with or without `--field body`, prints the description with that field's text under the key's heading. The scenario gives the whole behavior.

#### Scenario: View joins the ticket fields

- **WHEN** `tickets.fields` names a ticket field for a ticket-side key
- **THEN** `factory ticket view N`, with or without `--field body`, prints the description with that field's text under the key's heading. Each such section goes before the description's first level-two heading that comes later in this order, or at the end when none does: the repository's own keys in settings order, Decisions, Spec, Acceptance criteria, Mockups, For the builder. A ticket field with no text adds nothing.

### Requirement: A field Spec and Acceptance criteria share

The factory SHALL behave as this line says: When `spec` and `acceptance-criteria` name the same ticket field, `view` puts its text under `## Spec` on a ticket with the `spec` label when it is read, and under `## Acceptance criteria` otherwise.

#### Scenario: A field Spec and Acceptance criteria share

- **WHEN** `spec` and `acceptance-criteria` name the same ticket field
- **THEN** `view` puts its text under `## Spec` on a ticket with the `spec` label when it is read, and under `## Acceptance criteria` otherwise.

### Requirement: Edit splits into ticket fields

The factory SHALL behave as this line says: When `factory ticket edit N --body-file FILE` writes a ticket, each level-two section whose heading matches a ticket-side key that names a field goes into that field without its heading, and the description holds the rest. The scenario gives the whole behavior.

#### Scenario: Edit splits into ticket fields

- **WHEN** `factory ticket edit N --body-file FILE` writes a ticket
- **THEN** Each level-two section whose heading matches a ticket-side key that names a field goes into that field without its heading, and the description holds the rest. A section runs from its heading to the next level-two heading that is a factory field's, `## Mockups`, or a named key's, outside fenced code, or to the end. A ticket field is cleared when no key that names it has a section in the file, so a field Spec and Acceptance criteria share keeps the one section the file has. `edit` makes every check of lines 18, 19, 25, and 27 before writing anything, then writes the ticket fields, and writes the description last. A heading matches a key when it is the key with hyphens read as spaces, ignoring capitals.

### Requirement: Commands read the joined ticket

The factory SHALL behave as this line says: Every command that reads one ticket reads it as `view` prints it, so `factory ticket refined N` passes a ticket whose Decisions, Spec, or For the builder sit in ticket fields.

#### Scenario: Commands read the joined ticket

- **WHEN** a command reads one ticket whose factory fields sit in ticket fields
- **THEN** Every command that reads one ticket reads it as `view` prints it, so `factory ticket refined N` passes a ticket whose Decisions, Spec, or For the builder sit in ticket fields.

### Requirement: The follow-ups ticket stays whole

The factory SHALL behave as this line says: The follow-ups ticket, labeled `follow-up`, is read and written whole in its description, whatever `tickets.fields` names.

#### Scenario: The follow-ups ticket stays whole

- **WHEN** a ticket labeled `follow-up` is read or written while `tickets.fields` names ticket fields
- **THEN** The follow-ups ticket, labeled `follow-up`, is read and written whole in its description, whatever `tickets.fields` names.

### Requirement: A named ticket field that doesn't exist

The factory SHALL behave as this line says: When a ticket field that `tickets.fields` names doesn't exist, `factory ticket edit` prints `<repository>'s tickets have no field called <field>, which tickets.fields.<key> names.` and exits 1, writing nothing.

#### Scenario: A named ticket field that doesn't exist

- **WHEN** a ticket field that `tickets.fields` names doesn't exist
- **THEN** `factory ticket edit` prints `<repository>'s tickets have no field called <field>, which tickets.fields.<key> names.` and exits 1, writing nothing.

### Requirement: A named ticket field that doesn't hold text

The factory SHALL behave as this line says: When a ticket field that `tickets.fields` names doesn't hold text, `factory ticket edit` prints `<field>, which tickets.fields.<key> names, doesn't hold text.` and exits 1, writing nothing.

#### Scenario: A named ticket field that doesn't hold text

- **WHEN** a ticket field that `tickets.fields` names doesn't hold text
- **THEN** `factory ticket edit` prints `<field>, which tickets.fields.<key> names, doesn't hold text.` and exits 1, writing nothing.

### Requirement: Two keys name one ticket field

The factory SHALL behave as this line says: When two ticket-side keys name the same ticket field, other than `spec` and `acceptance-criteria`, `factory config check` fails with `.claude/factory.yaml: tickets.fields.<key>: names the same field as <other key>`.

#### Scenario: Two keys name one ticket field

- **WHEN** two ticket-side keys name the same ticket field, other than `spec` and `acceptance-criteria`
- **THEN** `factory config check` fails with `.claude/factory.yaml: tickets.fields.<key>: names the same field as <other key>`.

### Requirement: Ticket-side keys need no board

The factory SHALL behave as this line says: The ticket-side keys are valid without `tickets.board`. `session`, `runs-in`, and `cost` still fail without it, as today.

#### Scenario: Ticket-side keys need no board

- **WHEN** `tickets.fields` has ticket-side keys, with or without `tickets.board`
- **THEN** The ticket-side keys are valid without `tickets.board`. `session`, `runs-in`, and `cost` still fail without it, as today.

### Requirement: A key of the repository's own heading

The factory SHALL behave as this line says: A key under `tickets.fields` other than the seven the factory knows is the repository's own heading. When it isn't lowercase words joined by hyphens, `factory config check` fails with `.claude/factory.yaml: tickets.fields.<key>: must be a heading in lowercase, with hyphens for spaces`.

#### Scenario: A key of the repository's own heading

- **WHEN** `tickets.fields` has a key other than the seven the factory knows
- **THEN** A key under `tickets.fields` other than the seven the factory knows is the repository's own heading. When it isn't lowercase words joined by hyphens, `factory config check` fails with `.claude/factory.yaml: tickets.fields.<key>: must be a heading in lowercase, with hyphens for spaces`.

### Requirement: Doctor checks the ticket fields

The factory SHALL behave as this line says: When the settings name at least one ticket field, `factory doctor` and init's closing checks print `✓ <repository>'s tickets have every field the settings name` when each exists and holds text. The scenario gives the whole behavior.

#### Scenario: Doctor checks the ticket fields

- **WHEN** the settings name at least one ticket field
- **THEN** `factory doctor` and init's closing checks print `✓ <repository>'s tickets have every field the settings name` when each exists and holds text. Otherwise they print a `✗` line for each that fails: `<repository>'s tickets have no field called <field>, which tickets.fields.<key> names`, or `<field>, which tickets.fields.<key> names, doesn't hold text`. With none named, neither prints a line about ticket fields.

### Requirement: GitHub Issues has ticket fields

The factory SHALL behave as this line says: `factory ticket supports fields` prints `yes` with GitHub Issues. Its ticket fields are the repository's issue fields of the text type; a board's fields are never offered or written as ticket fields.

#### Scenario: GitHub Issues has ticket fields

- **WHEN** `factory ticket supports fields` runs with GitHub Issues
- **THEN** `factory ticket supports fields` prints `yes` with GitHub Issues. Its ticket fields are the repository's issue fields of the text type; a board's fields are never offered or written as ticket fields.

### Requirement: Ticket fields named without the fields group

The factory SHALL behave as this line says: When `tickets.fields` names a ticket field and the ticket system lacks the `fields` group, `factory ticket view` and `edit` exit 1 with the message a command gives for a group its ticket system lacks, naming `fields`, and write nothing. `factory doctor` prints `✗ <ticket system's label> has no ticket fields, which tickets.fields names`.

#### Scenario: Ticket fields named without the fields group

- **WHEN** `tickets.fields` names a ticket field and the ticket system lacks the `fields` group
- **THEN** `factory ticket view` and `edit` exit 1 with the message a command gives for a group its ticket system lacks, naming `fields`, and write nothing. `factory doctor` prints `✗ <ticket system's label> has no ticket fields, which tickets.fields names`.

### Requirement: Reading or writing ticket fields fails

The factory SHALL behave as this line says: When reading or writing a ticket's fields fails, `factory ticket view` and `edit` print the ticket system's error and exit 1. `edit` leaves the description as it was; a ticket field written before the failure keeps its new text, and running `edit` again writes the rest. `factory doctor` prints a `✗` line with the error's first line in place of line 23's.

#### Scenario: Reading or writing ticket fields fails

- **WHEN** reading or writing a ticket's fields fails
- **THEN** `factory ticket view` and `edit` print the ticket system's error and exit 1. `edit` leaves the description as it was; a ticket field written before the failure keeps its new text, and running `edit` again writes the rest. `factory doctor` prints a `✗` line with the error's first line in place of line 23's.

### Requirement: Spec and Acceptance criteria both in a shared field

The factory SHALL behave as this line says: When `spec` and `acceptance-criteria` name the same ticket field and the file `edit` writes has both a `## Spec` and an `## Acceptance criteria` section, `edit` prints `Spec and Acceptance criteria both go in <field>, and the file has both: keep one.` and exits 1, writing nothing.

#### Scenario: Spec and Acceptance criteria both in a shared field

- **WHEN** `spec` and `acceptance-criteria` name the same ticket field and the file `edit` writes has both a `## Spec` and an `## Acceptance criteria` section
- **THEN** `edit` prints `Spec and Acceptance criteria both go in <field>, and the file has both: keep one.` and exits 1, writing nothing.
