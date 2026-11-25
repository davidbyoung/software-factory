## MODIFIED Requirements

### Requirement: A field answer that can't be used

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A field answer that can't be used

- **WHEN** the answer can't be used
- **THEN** Init does not stop: it prints `<label>'s answer could not be used: <reason>.`, with the reason worded as today, then `Choose where each of the factory's fields goes yourself.` It does not print `Run factory init again, or write tickets.fields in .claude/factory.yaml yourself.` or `Nothing changed.`, and it does not ask the agent again.

### Requirement: Use these ticket fields

The factory SHALL behave as this line says: After the table of the agent's suggestion, init asks `Use these ticket fields?` with `Yes`, `Change some`, and `No: keep everything in the description`. `Yes` is selected first. After a table of fields chosen by hand, it asks with no `No`, as its own requirement says.

#### Scenario: Use these ticket fields

- **WHEN** init has printed the table of a suggestion the agent gave
- **THEN** Init asks `Use these ticket fields?` with `Yes`, `Change some`, and `No: keep everything in the description`. `Yes` is selected first.

## ADDED Requirements

### Requirement: What each factory field holds

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What each factory field holds

- **WHEN** init has said the answer can't be used and to choose by hand
- **THEN** It prints a blank line and a table headed `Factory field         What it holds`, with a row each for Decisions, Spec, Acceptance criteria, and For the builder, in that order, each with what it holds as the agent is told it. Then it prints a blank line, `A ticket has a Spec or Acceptance criteria, never both, so the two can share a ticket field.`, and a blank line.

### Requirement: A ticket field asked for each factory field

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A ticket field asked for each factory field

- **WHEN** init has printed what each factory field holds
- **THEN** It asks `Where does <heading> go?` once for each of the four, in the table's order, offering `The description` and then the text fields in the ticket system's order, with `The description` selected.

### Requirement: A ticket field chosen twice by hand

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A ticket field chosen twice by hand

- **WHEN** a ticket field picked by hand already holds a factory field chosen before it
- **THEN** Init prints `<field> already holds <other heading>. Pick another ticket field for <heading>.` and asks the same question again, with `The description` selected. Spec and Acceptance criteria in one ticket field is not a clash.

### Requirement: Use these ticket fields by hand

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Use these ticket fields by hand

- **WHEN** each of the four is chosen by hand
- **THEN** Init prints the `Factory field         Ticket field` table, `Your own text stays in the description.`, and the line on a field's text shown as typed, spaced as after a suggestion, then asks `Use these ticket fields?` with `Yes` and `Change some`, `Yes` selected, and no `No`.

### Requirement: Yes by hand writes all four keys

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Yes by hand writes all four keys

- **WHEN** you choose `Yes` to the table of fields chosen by hand
- **THEN** Init writes all four keys under `tickets.fields`, `none` for the description, and goes on to the plan.

### Requirement: Change some by hand

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Change some by hand

- **WHEN** you choose `Change some` after the table of fields chosen by hand
- **THEN** It goes as after a suggestion, and `Use these ticket fields?` then offers `Yes` and `Change some` again.

### Requirement: The look of what each factory field holds

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The look of what each factory field holds

- **WHEN** the table of what each factory field holds prints to a terminal
- **THEN** Its column names are bold underlined and each factory field's name is bold, as in the `Ticket field` table, and the text around it is plain.
