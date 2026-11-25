## ADDED Requirements

### Requirement: The second token

The factory SHALL behave as this line says: When a job reads or writes another of a ticket's repositories under the App, it makes a second token for those repositories alone, which may read contents and pull requests, write issues, and start runs, and nothing else. A pull request's verdict job's may only read.

#### Scenario: The second token

- **WHEN** a job reads or writes another of a ticket's repositories under the App
- **THEN** it makes a second token for those repositories alone, which may read contents and pull requests, write issues, and start runs, and nothing else. A pull request's verdict job's may only read.

### Requirement: The second token with no App

The factory SHALL behave as this line says: When no App's key reaches the run, the build token is used, and otherwise the board token.

#### Scenario: The second token with no App

- **WHEN** no App's key reaches the run
- **THEN** the build token is used, and otherwise the board token.
