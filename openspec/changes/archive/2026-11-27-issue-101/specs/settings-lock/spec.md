## MODIFIED Requirements

### Requirement: Commands read the lock

The factory SHALL behave as this line says: When any command reads the settings, it reads the lock's `settings`, never `.claude/factory.yaml` or a preset's file. `factory init`, `sync`, `config check`, `remove`, `doctor`, and the `preset` commands are the exceptions: they read the files the lock is made from. Two more read others: a command that looks up the default branch reads the `repository` line from `.claude/factory.yaml`, and the organization's poller reads what org-poller says it reads.

#### Scenario: Commands read the lock

- **WHEN** any command reads the settings
- **THEN** it reads the lock's `settings`, never `.claude/factory.yaml` or a preset's file. `factory init`, `sync`, `config check`, `remove`, `doctor`, and the `preset` commands are the exceptions: they read the files the lock is made from. Two more read others: a command that looks up the default branch reads the `repository` line from `.claude/factory.yaml`, and the organization's poller reads what org-poller says it reads.
