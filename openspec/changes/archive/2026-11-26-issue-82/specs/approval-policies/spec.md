## ADDED Requirements

### Requirement: An agent's prompt on standard input

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An agent's prompt on standard input

- **WHEN** an agent check runs
- **THEN** its prompt goes on standard input, so an input of any size starts it.

### Requirement: An agent handed only what its command found

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An agent handed only what its command found

- **WHEN** a policy has both `run` and `agent`
- **THEN** the agent's input holds only the files the command's findings name, a renamed file's entry included, and their diff, not the whole change.

### Requirement: An agent can't read /proc

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An agent can't read /proc

- **WHEN** an agent check runs
- **THEN** it is denied `Read` of `/proc`, as a session in the cloud is.

### Requirement: An agent's model

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An agent's model

- **WHEN** an agent's file names `model:` in its front matter
- **THEN** the agent runs with that model.

### Requirement: What a cleared change's Details list

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What a cleared change's Details list

- **WHEN** an agent clears what its command found
- **THEN** the status's Details list those findings, each as `file:line` and its title, under a heading `NAME: cleared by AGENT, not a person`.

### Requirement: The docs example with a script and an agent

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The docs example with a script and an agent

- **WHEN** an approval policy's docs example combines a script and an agent
- **THEN** it is named `raw-sql`.
