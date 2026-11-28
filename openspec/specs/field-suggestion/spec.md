# field-suggestion Specification

## Purpose

`lunamill init`'s field step: the coding agent suggests which of the tickets' text fields should hold each of Lunamill's fields a refined ticket has, and you accept, change, or refuse the suggestion before anything changes.

## Requirements

### Requirement: Init names the tickets' text fields

Lunamill SHALL behave as this line says: When `lunamill init` runs, the ticket system has the `fields` group, its tickets have at least one text field, and the settings name none of the four keys under `tickets.fields`, init prints `<repository>'s tickets have the text fields A, B, and C.`, with the names in the ticket system's order, joined by `listed` in `src/lib/listed.mts`: `A` for one, `A and B` for two. This comes after the column step and before the plan.

#### Scenario: Init names the tickets' text fields

- **WHEN** `lunamill init` runs, the ticket system has the `fields` group, its tickets have at least one text field, and the settings name none of the four keys under `tickets.fields`
- **THEN** Init prints `<repository>'s tickets have the text fields A, B, and C.`, with the names in the ticket system's order, joined by `listed` in `src/lib/listed.mts`: `A` for one, `A and B` for two. This comes after the column step and before the plan.

### Requirement: No field question otherwise

Lunamill SHALL behave as this line says: When the ticket system lacks the `fields` group, its tickets have no text field, or the settings name any of the four keys, init prints nothing about ticket fields, doesn't call the agent, and writes no ticket-side key. When reading the ticket fields fails, init stops before the plan, printing the ticket system's error and `Nothing changed.`, and exits 1, as it does when reading a board's columns fails.

#### Scenario: No field question otherwise

- **WHEN** the ticket system lacks the `fields` group, its tickets have no text field, or the settings name any of the four keys
- **THEN** Init prints nothing about ticket fields, doesn't call the agent, and writes no ticket-side key. When reading the ticket fields fails, init stops before the plan, printing the ticket system's error and `Nothing changed.`, and exits 1, as it does when reading a board's columns fails.

### Requirement: Init asks the agent for fields once

Lunamill SHALL behave as this line says: After line 1, init prints `Asking <label> which of them should hold each of lunamill's fields...` and asks the agent once. It sends only the text fields' names and descriptions and what each Lunamill field holds, and tells the agent to answer the description for a Lunamill field no ticket field clearly fits.

#### Scenario: Init asks the agent for fields once

- **WHEN** init has named the tickets' text fields
- **THEN** After line 1, init prints `Asking <label> which of them should hold each of lunamill's fields...` and asks the agent once. It sends only the text fields' names and descriptions and what each Lunamill field holds, and tells the agent to answer the description for a Lunamill field no ticket field clearly fits.

### Requirement: The field suggestion's table

Lunamill SHALL behave as this line says: When the answer is usable, init prints a table headed `lunamill field        Ticket field`, with one row each for Decisions, Spec, Acceptance criteria, and For the builder, in that order. The scenario gives the whole behavior.

#### Scenario: The field suggestion's table

- **WHEN** the answer is usable
- **THEN** Init prints a table headed `lunamill field        Ticket field`, with one row each for Decisions, Spec, Acceptance criteria, and For the builder, in that order. Each row shows the ticket field as the ticket system spells it, or `the description`. Then it prints `Your own text stays in the description.` and, when the ticket system shows a field's text as typed, `<ticket system's label> shows a field's text as typed, without Markdown formatting.`

### Requirement: Use these ticket fields

Lunamill SHALL behave as this line says: After the table of the agent's suggestion, init asks `Use these ticket fields?` with `Yes`, `Change some`, and `No: keep everything in the description`. `Yes` is selected first. After a table of fields chosen by hand, it asks with no `No`, as its own requirement says.

#### Scenario: Use these ticket fields

- **WHEN** init has printed the table of a suggestion the agent gave
- **THEN** Init asks `Use these ticket fields?` with `Yes`, `Change some`, and `No: keep everything in the description`. `Yes` is selected first.

### Requirement: Yes writes all four keys

Lunamill SHALL behave as this line says: When you choose `Yes`, init writes all four keys under `tickets.fields`: the ticket field's name, or `none` for the description. Comments already in the file are kept.

#### Scenario: Yes writes all four keys

- **WHEN** you choose `Yes`
- **THEN** Init writes all four keys under `tickets.fields`: the ticket field's name, or `none` for the description. Comments already in the file are kept.

### Requirement: Change some Lunamill fields

Lunamill SHALL behave as this line says: When you choose `Change some`, init asks `Which Lunamill fields do you want to change?`, listing each as `<heading> The scenario gives the whole behavior.

#### Scenario: Change some Lunamill fields

- **WHEN** you choose `Change some`
- **THEN** Init asks `Which Lunamill fields do you want to change?`, listing each as `<heading>: <its ticket field, or the description>`. No Lunamill field starts picked, and picking none goes back to the table and `Use these ticket fields?`. For each one picked, in table order, it asks `Where does <heading> go?`, with the current choice selected, offering `The description` and then the text fields in the ticket system's order. Then it shows the table and asks `Use these ticket fields?` again.

### Requirement: One ticket field for two Lunamill fields

Lunamill SHALL behave as this line says: When a ticket field picked for a Lunamill field already holds another in the table as it stands, init prints `<field> already holds <other heading>. Pick another ticket field for <heading>.`. It keeps that Lunamill field's earlier choice and the choices made before it in the same pass, then asks `Which Lunamill fields do you want to change?` again with every Lunamill field still picked. Spec and Acceptance criteria in one ticket field is not a clash.

#### Scenario: One ticket field for two Lunamill fields

- **WHEN** a ticket field picked for a Lunamill field already holds another in the table as it stands
- **THEN** Init prints `<field> already holds <other heading>. Pick another ticket field for <heading>.`. It keeps that Lunamill field's earlier choice and the choices made before it in the same pass, then asks `Which Lunamill fields do you want to change?` again with every Lunamill field still picked. Spec and Acceptance criteria in one ticket field is not a clash.

### Requirement: No keeps everything in the description

Lunamill SHALL behave as this line says: When you choose `No`, init writes all four keys as `none`.

#### Scenario: No keeps everything in the description

- **WHEN** you choose `No`
- **THEN** Init writes all four keys as `none`.

### Requirement: A field answer that can't be used

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A field answer that can't be used

- **WHEN** the answer can't be used
- **THEN** Init does not stop: it prints `<label>'s answer could not be used: <reason>.`, with the reason worded as today, then `Choose where each of lunamill's fields goes yourself.` It does not print `Run lunamill init again, or write tickets.fields in .claude/lunamill.yaml yourself.` or `Nothing changed.`, and it does not ask the agent again.

### Requirement: Each field reason has its own wording

Lunamill SHALL behave as this line says: Each reason in line 10 has its own wording. The scenario gives the whole behavior.

#### Scenario: Each field reason has its own wording

- **WHEN** the agent's answer can't be used
- **THEN** Each reason in line 10 has its own wording. When several apply, the first in this list is printed:
  - the command exits non-zero: `it failed: <first line of its error output>`, or `it failed with exit code <N>` when it printed no error;
  - no answer within 60 seconds: `it took longer than 60 seconds`;
  - a field the tickets don't have: `it named <field>, which <repository>'s tickets don't have`;
  - one ticket field for two Lunamill fields, other than Spec and Acceptance criteria: `it put <field> in both <heading> and <heading>`;
  - a Lunamill field missing: `it left out <heading>`;
  - output with no answer in the form asked for: `it did not answer in the form asked for`.

### Requirement: Field lines name the agent and the ticket system by label

Lunamill SHALL behave as this line says: Every line of the step names the agent and the ticket system by their registered labels. With the test registry's Fake Agent and memory ticket system, no line contains "Claude Code" or "GitHub".

#### Scenario: Field lines name the agent and the ticket system by label

- **WHEN** the field step runs with the test registry's Fake Agent and memory ticket system
- **THEN** Every line of the step names the agent and the ticket system by their registered labels. With the test registry's Fake Agent and memory ticket system, no line contains "Claude Code" or "GitHub".

### Requirement: What each Lunamill field holds

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What each Lunamill field holds

- **WHEN** init has said the answer can't be used and to choose by hand
- **THEN** It prints a blank line and a table headed `lunamill field        What it holds`, with a row each for Decisions, Spec, Acceptance criteria, and For the builder, in that order, each with what it holds as the agent is told it. Then it prints a blank line, `A ticket has a Spec or Acceptance criteria, never both, so the two can share a ticket field.`, and a blank line.

### Requirement: A ticket field asked for each Lunamill field

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A ticket field asked for each Lunamill field

- **WHEN** init has printed what each Lunamill field holds
- **THEN** It asks `Where does <heading> go?` once for each of the four, in the table's order, offering `The description` and then the text fields in the ticket system's order, with `The description` selected.

### Requirement: A ticket field chosen twice by hand

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A ticket field chosen twice by hand

- **WHEN** a ticket field picked by hand already holds a Lunamill field chosen before it
- **THEN** Init prints `<field> already holds <other heading>. Pick another ticket field for <heading>.` and asks the same question again, with `The description` selected. Spec and Acceptance criteria in one ticket field is not a clash.

### Requirement: Use these ticket fields by hand

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Use these ticket fields by hand

- **WHEN** each of the four is chosen by hand
- **THEN** Init prints the `lunamill field        Ticket field` table, `Your own text stays in the description.`, and the line on a field's text shown as typed, spaced as after a suggestion, then asks `Use these ticket fields?` with `Yes` and `Change some`, `Yes` selected, and no `No`.

### Requirement: Yes by hand writes all four keys

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Yes by hand writes all four keys

- **WHEN** you choose `Yes` to the table of fields chosen by hand
- **THEN** Init writes all four keys under `tickets.fields`, `none` for the description, and goes on to the plan.

### Requirement: Change some by hand

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Change some by hand

- **WHEN** you choose `Change some` after the table of fields chosen by hand
- **THEN** It goes as after a suggestion, and `Use these ticket fields?` then offers `Yes` and `Change some` again.

### Requirement: The look of what each Lunamill field holds

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The look of what each Lunamill field holds

- **WHEN** the table of what each Lunamill field holds prints to a terminal
- **THEN** Its column names are bold underlined and each Lunamill field's name is bold, as in the `Ticket field` table, and the text around it is plain.
