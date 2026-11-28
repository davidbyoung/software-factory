## ADDED Requirements

### Requirement: The credentials file

Lunamill SHALL behave as this line says: When Lunamill stores or reads a credential, the file is `$XDG_CONFIG_HOME/lunamill/credentials.yaml`, or `~/.config/lunamill/credentials.yaml` when it is not set, and the credentials guard watches that path. Jira's environment variables are `LUNAMILL_JIRA_EMAIL` and `LUNAMILL_JIRA_TOKEN`.

#### Scenario: The credentials file

- **WHEN** Lunamill stores or reads a credential
- **THEN** the file is `$XDG_CONFIG_HOME/lunamill/credentials.yaml`, or `~/.config/lunamill/credentials.yaml` when it is not set, and the credentials guard watches that path. Jira's environment variables are `LUNAMILL_JIRA_EMAIL` and `LUNAMILL_JIRA_TOKEN`.
