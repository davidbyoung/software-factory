## ADDED Requirements

### Requirement: The credentials file

kodor SHALL behave as this line says: When kodor stores or reads a credential, the file is `$XDG_CONFIG_HOME/kodor/credentials.yaml`, or `~/.config/kodor/credentials.yaml` when it is not set, and the credentials guard watches that path. Jira's environment variables are `KODOR_JIRA_EMAIL` and `KODOR_JIRA_TOKEN`.

#### Scenario: The credentials file

- **WHEN** kodor stores or reads a credential
- **THEN** the file is `$XDG_CONFIG_HOME/kodor/credentials.yaml`, or `~/.config/kodor/credentials.yaml` when it is not set, and the credentials guard watches that path. Jira's environment variables are `KODOR_JIRA_EMAIL` and `KODOR_JIRA_TOKEN`.
