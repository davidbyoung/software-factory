## ADDED Requirements

### Requirement: Default label names

The factory SHALL behave as this line says: When `.claude/factory.yaml` has no `tickets.labels` and no `code-host.labels`, the factory uses the names `spec`, `follow-up`, `merge-automatic`, `merge-manual`, and `verdict-override`, and `factory config explain` shows each under `tickets.labels` or `code-host.labels` marked `# default`.

#### Scenario: Default label names

- **WHEN** `.claude/factory.yaml` has no `tickets.labels` and no `code-host.labels`
- **THEN** the factory uses the names `spec`, `follow-up`, `merge-automatic`, `merge-manual`, and `verdict-override`, and `factory config explain` shows each under `tickets.labels` or `code-host.labels` marked `# default`.

### Requirement: Configured names are used

The factory SHALL behave as this line says: When `tickets.labels` or `code-host.labels` sets a key, every factory command, workflow, and hook that reads or adds that label uses the configured name, and a key left out keeps its default.

#### Scenario: Configured names are used

- **WHEN** `tickets.labels` or `code-host.labels` sets a key
- **THEN** every factory command, workflow, and hook that reads or adds that label uses the configured name, and a key left out keeps its default.

### Requirement: Unknown label keys

The factory SHALL behave as this line says: When `tickets.labels` or `code-host.labels` has a key other than its own (`spec` and `follow-up`; `merge-automatic`, `merge-manual`, and `verdict-override`), `factory config check` fails naming the key, as it does for any unknown key.

#### Scenario: Unknown label keys

- **WHEN** `tickets.labels` or `code-host.labels` has a key other than its own (`spec` and `follow-up`; `merge-automatic`
- **THEN** `merge-manual`, and `verdict-override`), `factory config check` fails naming the key, as it does for any unknown key.

### Requirement: An empty label name

The factory SHALL behave as this line says: When a configured name is empty or only spaces, `factory config check` fails with `.claude/factory.yaml: KEY: must not be empty`, where KEY is the full key, such as `tickets.labels.spec`.

#### Scenario: An empty label name

- **WHEN** a configured name is empty or only spaces
- **THEN** `factory config check` fails with `.claude/factory.yaml: KEY: must not be empty`, where KEY is the full key, such as `tickets.labels.spec`.

### Requirement: Two labels with one name

The factory SHALL refuse two label keys whose names are equal ignoring case, naming the key the file sets, as the scenario says.

#### Scenario: Two labels with one name

- **WHEN** two keys give names equal ignoring case
- **THEN** `factory config check` fails with `.claude/factory.yaml: KEY: "NAME" is already OTHER. Give each label its own name`, such as `code-host.labels.merge-manual: "Spec" is already tickets.labels.spec`. A default name counts. KEY is a key the file sets: of two set keys, the later in the order `spec`, `follow-up`, `merge-automatic`, `merge-manual`, `verdict-override`; of a set key and a default, the set one. So `tickets.labels.spec: follow-up` alone fails as `tickets.labels.spec: "follow-up" is already tickets.labels.follow-up`.

### Requirement: Separate tools may share a name

The factory SHALL behave as this line says: When `tickets.type` and `code-host.type` name different tools, a ticket label and a pull request label may share a name; two ticket labels, or two pull request labels, still may not.

#### Scenario: Separate tools may share a name

- **WHEN** `tickets.type` and `code-host.type` name different tools
- **THEN** a ticket label and a pull request label may share a name; two ticket labels, or two pull request labels, still may not.

### Requirement: A name the adapter refuses

The factory SHALL behave as this line says: When a tool's adapter refuses a name, `factory config check` fails with `.claude/factory.yaml: KEY: ` followed by the adapter's reason. The GitHub adapters refuse only an empty name (line 4).

#### Scenario: A name the adapter refuses

- **WHEN** a tool's adapter refuses a name
- **THEN** `factory config check` fails with `.claude/factory.yaml: KEY: ` followed by the adapter's reason. The GitHub adapters refuse only an empty name (line 4).

### Requirement: The override's name in the verdict workflow

The factory SHALL behave as this line says: When `code-host.labels.verdict-override` is set, `factory sync` writes that name into `.github/workflows/factory-review-verdict.yml`, where the workflow starts on the label being added, and `factory sync --check` fails while the workflow names another.

#### Scenario: The override's name in the verdict workflow

- **WHEN** `code-host.labels.verdict-override` is set
- **THEN** `factory sync` writes that name into `.github/workflows/factory-review-verdict.yml`, where the workflow starts on the label being added, and `factory sync --check` fails while the workflow names another.

### Requirement: Init writes no labels

The factory SHALL behave as this line says: When a `factory init` run writes `.claude/factory.yaml`, it writes no `labels` key under `tickets` or `code-host`, and asks no question about labels.

#### Scenario: Init writes no labels

- **WHEN** a `factory init` run writes `.claude/factory.yaml`
- **THEN** it writes no `labels` key under `tickets` or `code-host`, and asks no question about labels.

### Requirement: Ticket commands take a key

The factory SHALL behave as this line says: When `factory ticket label N --add KEY`, `--remove KEY`, or `--was-removed KEY` is given `spec` or `follow-up`, it acts on the name `tickets.labels` gives that key; any other word is a label name, as today. `factory ticket open --label KEY` and `factory ticket list --label KEY` translate the same way.

#### Scenario: Ticket commands take a key

- **WHEN** `factory ticket label N --add KEY`, `--remove KEY`, or `--was-removed KEY` is given `spec` or `follow-up`
- **THEN** it acts on the name `tickets.labels` gives that key; any other word is a label name, as today. `factory ticket open --label KEY` and `factory ticket list --label KEY` translate the same way.

### Requirement: Pull request commands take a key

The factory SHALL behave as this line says: When `factory pr label N --add KEY` or `--remove KEY` is given `merge-automatic`, `merge-manual`, or (for `--remove` only) `verdict-override`, it acts on the name `code-host.labels` gives that key. `factory ticket label N --remove` and `--was-removed` translate `verdict-override` the same way.

#### Scenario: Pull request commands take a key

- **WHEN** `factory pr label N --add KEY` or `--remove KEY` is given `merge-automatic`, `merge-manual`, or (for `--remove` only) `verdict-override`
- **THEN** it acts on the name `code-host.labels` gives that key. `factory ticket label N --remove` and `--was-removed` translate `verdict-override` the same way.

### Requirement: The override is never added by an agent

The factory SHALL behave as this line says: When `factory pr label` or `factory ticket label` is asked to add `verdict-override`, or the name `code-host.labels.verdict-override` gives it, ignoring case, it refuses, as it refuses `verdict: override` today, and the guard hook refuses a `gh` command that adds the configured name.

#### Scenario: The override is never added by an agent

- **WHEN** `factory pr label` or `factory ticket label` is asked to add `verdict-override`, or the name `code-host.labels.verdict-override` gives it, ignoring case
- **THEN** it refuses, as it refuses `verdict: override` today, and the guard hook refuses a `gh` command that adds the configured name.

### Requirement: A renamed label shows its key

The factory SHALL behave as this line says: When a ticket carries a label whose configured name differs from its key, `factory ticket view N` prints it on the `labels:` line as `NAME (KEY)`, such as `labels: enhancement, needs-spec (spec)`; `factory ticket view N --field labels` and `factory ticket list` print it the same way. A label whose name equals its key prints as today. `--json` output keeps the raw names, since the factory's own code reads it.

#### Scenario: A renamed label shows its key

- **WHEN** a ticket carries a label whose configured name differs from its key
- **THEN** `factory ticket view N` prints it on the `labels:` line as `NAME (KEY)`, such as `labels: enhancement, needs-spec (spec)`; `factory ticket view N --field labels` and `factory ticket list` print it the same way. A label whose name equals its key prints as today. `--json` output keeps the raw names, since the factory's own code reads it.

### Requirement: The follow-ups ticket by its configured name

The factory SHALL behave as this line says: When `tickets.labels.follow-up` is set, `factory follow-up` finds the open follow-ups ticket by that name, and opens a new one with that name when none carries it. `factory status`, the board sync, the refined check, and the ticket-fields split find the follow-ups ticket by the same name.

#### Scenario: The follow-ups ticket by its configured name

- **WHEN** `tickets.labels.follow-up` is set
- **THEN** `factory follow-up` finds the open follow-ups ticket by that name, and opens a new one with that name when none carries it. `factory status`, the board sync, the refined check, and the ticket-fields split find the follow-ups ticket by the same name.

### Requirement: The spec track by its configured name

The factory SHALL behave as this line says: When `tickets.labels.spec` is set, the refined check, the ticket-fields split, and `factory specs new` read a ticket as on the spec track when it carries that name.

#### Scenario: The spec track by its configured name

- **WHEN** `tickets.labels.spec` is set
- **THEN** the refined check, the ticket-fields split, and `factory specs new` read a ticket as on the spec track when it carries that name.

### Requirement: A name that needs quotes

The factory SHALL say a label value with an unquoted `: ` needs quotes, in place of js-yaml's error, as the scenario says.

#### Scenario: A name that needs quotes

- **WHEN** `.claude/factory.yaml` can't be read because a line `KEY: VALUE` has an unquoted `: ` in VALUE
- **THEN** the settings reader in `src/config.mts`, which `factory config check`, `factory sync`, `factory config explain`, and every other command reading `.claude/factory.yaml` call, prints `.claude/factory.yaml: line N: KEY: VALUE needs quotes around the name, such as KEY: "VALUE"` in place of js-yaml's `bad indentation of a mapping entry`. Any other YAML error is reported as today.
