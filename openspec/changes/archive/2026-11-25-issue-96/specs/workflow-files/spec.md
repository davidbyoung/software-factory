## ADDED Requirements

### Requirement: The job that opens the ticked tickets

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The job that opens the ticked tickets

- **WHEN** a pull request from this repository merges with a list in its description, whether or not a box is ticked
- **THEN** `run.yml`'s job "Open the ticked tickets" runs `factory pr follow-ups --event` with the event's file, and the board's sync for that event waits for it. On any other event, and for any other pull request, the job is skipped.
