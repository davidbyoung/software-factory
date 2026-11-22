## MODIFIED Requirements

### Requirement: Default label names

The factory SHALL behave as this line says: When `.claude/factory.yaml` has no `tickets.labels` and no `code-host.labels`, the factory uses the names `spec`, `follow-up`, `factory`, `merge-automatic`, `merge-manual`, and `verdict-override`, and `factory config explain` shows each under `tickets.labels` or `code-host.labels` marked `# default`, such as `factory: factory  # default`.

#### Scenario: Default label names

- **WHEN** `.claude/factory.yaml` has no `tickets.labels` and no `code-host.labels`
- **THEN** the factory uses the names `spec`, `follow-up`, `factory`, `merge-automatic`, `merge-manual`, and `verdict-override`, and `factory config explain` shows each under `tickets.labels` or `code-host.labels` marked `# default`, such as `factory: factory  # default`.

### Requirement: Unknown label keys

The factory SHALL behave as this line says: When `tickets.labels` or `code-host.labels` has a key other than its own (`spec`, `follow-up`, and `factory`; `merge-automatic`, `merge-manual`, and `verdict-override`), `factory config check` fails naming the key, as it does for any unknown key.

#### Scenario: Unknown label keys

- **WHEN** `tickets.labels` or `code-host.labels` has a key other than its own (`spec`, `follow-up`, and `factory`; `merge-automatic`, `merge-manual`, and `verdict-override`)
- **THEN** `factory config check` fails naming the key, as it does for any unknown key.

### Requirement: Two labels with one name

The factory SHALL refuse two label keys whose names are equal ignoring case, naming the key the file sets, as the scenario says.

#### Scenario: Two labels with one name

- **WHEN** two keys give names equal ignoring case
- **THEN** `factory config check` fails with `.claude/factory.yaml: KEY: "NAME" is already OTHER. Give each label its own name`, such as `code-host.labels.merge-manual: "Spec" is already tickets.labels.spec`. A default name counts. KEY is a key the file sets: of two set keys, the later in the order `spec`, `follow-up`, `factory`, `merge-automatic`, `merge-manual`, `verdict-override`; of a set key and a default, the set one. So `tickets.labels.factory: spec` alone fails as `tickets.labels.factory: "spec" is already tickets.labels.spec`.

## ADDED Requirements

### Requirement: The factory label by its configured name

The factory SHALL behave as this line says: When `tickets.labels.factory` is set, every command, workflow, and the scheduled poller use that name; `factory config check` refuses it empty, or equal ignoring case to another label's name, with the messages it gives `spec` and `follow-up`.

#### Scenario: The factory label by its configured name

- **WHEN** `tickets.labels.factory` is set
- **THEN** every command, workflow, and the scheduled poller use that name; `factory config check` refuses it empty, or equal ignoring case to another label's name, with the messages it gives `spec` and `follow-up`.

### Requirement: Label commands take the factory key

The factory SHALL behave as this line says: When `factory ticket label N --add factory` or `--remove factory` is given the key `factory`, it acts on the name `tickets.labels.factory` gives, as it does for `spec`.

#### Scenario: Label commands take the factory key

- **WHEN** `factory ticket label N --add factory` or `--remove factory` is given the key `factory`
- **THEN** it acts on the name `tickets.labels.factory` gives, as it does for `spec`.
