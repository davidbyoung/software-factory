# labels-setting Specification

## Purpose

The names of the labels kodor adds to tickets and pull requests, under `tickets.labels` and `code-host.labels`: what `kodor config check` refuses in them, how the commands take a label's key, and how each reader finds a label by its configured name.

## Requirements

### Requirement: Default label names

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Default label names

- **WHEN** `.claude/kodor.yaml` has no `tickets.labels` and no `code-host.labels`
- **THEN** kodor uses the names `spec`, `kodor`, `merge-automatic`, `merge-manual`, `verdict-override`, and `policy-override`, and `kodor config explain` shows each under `tickets.labels` or `code-host.labels` marked `# default`, such as `factory: factory  # default`.

### Requirement: Configured names are used

kodor SHALL behave as this line says: When `tickets.labels` or `code-host.labels` sets a key, every kodor command, workflow, and hook that reads or adds that label uses the configured name, and a key left out keeps its default.

#### Scenario: Configured names are used

- **WHEN** `tickets.labels` or `code-host.labels` sets a key
- **THEN** every kodor command, workflow, and hook that reads or adds that label uses the configured name, and a key left out keeps its default.

### Requirement: Unknown label keys

kodor SHALL behave as this line says: When `tickets.labels` or `code-host.labels` has a key other than its own (`spec` and `kodor`; `merge-automatic`, `merge-manual`, and `verdict-override`), `kodor config check` fails naming the key, as it does for any unknown key, such as `.claude/kodor.yaml: tickets.labels.follow-up: unknown key`.

#### Scenario: Unknown label keys

- **WHEN** `tickets.labels` or `code-host.labels` has a key other than its own (`spec` and `kodor`; `merge-automatic`, `merge-manual`, and `verdict-override`)
- **THEN** `kodor config check` fails naming the key, as it does for any unknown key, such as `.claude/kodor.yaml: tickets.labels.follow-up: unknown key`.

### Requirement: An empty label name

kodor SHALL behave as this line says: When a configured name is empty or only spaces, `kodor config check` fails with `.claude/kodor.yaml: KEY: must not be empty`, where KEY is the full key, such as `tickets.labels.spec`.

#### Scenario: An empty label name

- **WHEN** a configured name is empty or only spaces
- **THEN** `kodor config check` fails with `.claude/kodor.yaml: KEY: must not be empty`, where KEY is the full key, such as `tickets.labels.spec`.

### Requirement: Two labels with one name

kodor SHALL refuse two label keys whose names are equal ignoring case, naming the key the file sets, as the scenario says.

#### Scenario: Two labels with one name

- **WHEN** two keys give names equal ignoring case
- **THEN** `kodor config check` fails with `.claude/kodor.yaml: KEY: "NAME" is already OTHER. Give each label its own name`, such as `code-host.labels.merge-manual: "Spec" is already tickets.labels.spec`. A default name counts. KEY is a key the file sets: of two set keys, the later in the order `spec`, `kodor`, `merge-automatic`, `merge-manual`, `verdict-override`; of a set key and a default, the set one. So `tickets.labels.kodor: spec` alone fails as `tickets.labels.kodor: "spec" is already tickets.labels.spec`.

### Requirement: Separate tools may share a name

kodor SHALL behave as this line says: When `tickets.type` and `code-host.type` name different tools, a ticket label and a pull request label may share a name; two ticket labels, or two pull request labels, still may not.

#### Scenario: Separate tools may share a name

- **WHEN** `tickets.type` and `code-host.type` name different tools
- **THEN** a ticket label and a pull request label may share a name; two ticket labels, or two pull request labels, still may not.

### Requirement: A name the adapter refuses

kodor SHALL behave as this line says: When a tool's adapter refuses a name, `kodor config check` fails with `.claude/kodor.yaml: KEY: ` followed by the adapter's reason. The GitHub adapters refuse only an empty name (line 4).

#### Scenario: A name the adapter refuses

- **WHEN** a tool's adapter refuses a name
- **THEN** `kodor config check` fails with `.claude/kodor.yaml: KEY: ` followed by the adapter's reason. The GitHub adapters refuse only an empty name (line 4).

### Requirement: The override's name in the verdict workflow

kodor SHALL behave as this line says: When `code-host.labels.verdict-override` is set, `kodor sync` writes that name into `.github/workflows/kodor.yml`, where the verdict's job starts on the label being added, and `kodor sync --check` fails while the file names another.

#### Scenario: The override's name in the verdict workflow

- **WHEN** `code-host.labels.verdict-override` is set
- **THEN** `kodor sync` writes that name into `.github/workflows/kodor.yml`, where the verdict's job starts on the label being added, and `kodor sync --check` fails while the file names another.

### Requirement: Init writes no labels

kodor SHALL behave as this line says: When a `kodor init` run writes `.claude/kodor.yaml`, it writes no `labels` key under `tickets` or `code-host`, and asks no question about labels.

#### Scenario: Init writes no labels

- **WHEN** a `kodor init` run writes `.claude/kodor.yaml`
- **THEN** it writes no `labels` key under `tickets` or `code-host`, and asks no question about labels.

### Requirement: Ticket commands take a key

kodor SHALL behave as this line says: When `kodor ticket label N --add KEY`, `--remove KEY`, or `--was-removed KEY` is given `spec`, it acts on the name `tickets.labels` gives that key; any other word is a label name, `follow-up` included. `kodor ticket open --label KEY` and `kodor ticket list --label KEY` translate the same way.

#### Scenario: Ticket commands take a key

- **WHEN** `kodor ticket label N --add KEY`, `--remove KEY`, or `--was-removed KEY` is given `spec`
- **THEN** it acts on the name `tickets.labels` gives that key; any other word is a label name, `follow-up` included. `kodor ticket open --label KEY` and `kodor ticket list --label KEY` translate the same way.

### Requirement: Pull request commands take a key

kodor SHALL behave as this line says: When `kodor pr label N --add KEY` or `--remove KEY` is given `merge-automatic`, `merge-manual`, or (for `--remove` only) `verdict-override`, it acts on the name `code-host.labels` gives that key. `kodor ticket label N --remove` and `--was-removed` translate `verdict-override` the same way.

#### Scenario: Pull request commands take a key

- **WHEN** `kodor pr label N --add KEY` or `--remove KEY` is given `merge-automatic`, `merge-manual`, or (for `--remove` only) `verdict-override`
- **THEN** it acts on the name `code-host.labels` gives that key. `kodor ticket label N --remove` and `--was-removed` translate `verdict-override` the same way.

### Requirement: The override is never added by an agent

kodor SHALL behave as this line says: When `kodor pr label` or `kodor ticket label` is asked to add `verdict-override`, or the name `code-host.labels.verdict-override` gives it, ignoring case, it refuses, as it refuses `verdict: override` today, and the guard hook refuses a `gh` command that adds the configured name.

#### Scenario: The override is never added by an agent

- **WHEN** `kodor pr label` or `kodor ticket label` is asked to add `verdict-override`, or the name `code-host.labels.verdict-override` gives it, ignoring case
- **THEN** it refuses, as it refuses `verdict: override` today, and the guard hook refuses a `gh` command that adds the configured name.

### Requirement: A renamed label shows its key

kodor SHALL behave as this line says: When a ticket carries a label whose configured name differs from its key, `kodor ticket view N` prints it on the `labels:` line as `NAME (KEY)`, such as `labels: enhancement, needs-spec (spec)`; `kodor ticket view N --field labels` and `kodor ticket list` print it the same way. A label whose name equals its key prints as today. `--json` output keeps the raw names, since kodor's own code reads it.

#### Scenario: A renamed label shows its key

- **WHEN** a ticket carries a label whose configured name differs from its key
- **THEN** `kodor ticket view N` prints it on the `labels:` line as `NAME (KEY)`, such as `labels: enhancement, needs-spec (spec)`; `kodor ticket view N --field labels` and `kodor ticket list` print it the same way. A label whose name equals its key prints as today. `--json` output keeps the raw names, since kodor's own code reads it.

### Requirement: The spec track by its configured name

kodor SHALL behave as this line says: When `tickets.labels.spec` is set, the refined check, the ticket-fields split, and `kodor specs new` read a ticket as on the spec track when it carries that name.

#### Scenario: The spec track by its configured name

- **WHEN** `tickets.labels.spec` is set
- **THEN** the refined check, the ticket-fields split, and `kodor specs new` read a ticket as on the spec track when it carries that name.

### Requirement: A name that needs quotes

kodor SHALL say a label value with an unquoted `: ` needs quotes, in place of js-yaml's error, as the scenario says.

#### Scenario: A name that needs quotes

- **WHEN** `.claude/kodor.yaml` can't be read because a line `KEY: VALUE` has an unquoted `: ` in VALUE
- **THEN** the settings reader in `src/config.mts`, which `kodor config check`, `kodor sync`, `kodor config explain`, and every other command reading `.claude/kodor.yaml` call, prints `.claude/kodor.yaml: line N: KEY: VALUE needs quotes around the name, such as KEY: "VALUE"` in place of js-yaml's `bad indentation of a mapping entry`. Any other YAML error is reported as today.

### Requirement: The kodor label by its configured name

kodor SHALL behave as this line says: When `tickets.labels.kodor` is set, every command, workflow, and the scheduled poller use that name; `kodor config check` refuses it empty, or equal ignoring case to another label's name, with the messages it gives `spec`.

#### Scenario: The kodor label by its configured name

- **WHEN** `tickets.labels.kodor` is set
- **THEN** every command, workflow, and the scheduled poller use that name; `kodor config check` refuses it empty, or equal ignoring case to another label's name, with the messages it gives `spec`.

### Requirement: Label commands take kodor key

kodor SHALL behave as this line says: When `kodor ticket label N --add factory` or `--remove factory` is given the key `kodor`, it acts on the name `tickets.labels.kodor` gives, as it does for `spec`.

#### Scenario: Label commands take kodor key

- **WHEN** `kodor ticket label N --add factory` or `--remove factory` is given the key `kodor`
- **THEN** it acts on the name `tickets.labels.kodor` gives, as it does for `spec`.

### Requirement: The policy override's name in the workflow

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The policy override's name in the workflow

- **WHEN** `code-host.labels` names `policy-override`
- **THEN** `kodor sync` writes that name into `.github/workflows/kodor.yml`, where the approval policies job starts on it being added, and `kodor sync --check` fails while the file names another.

### Requirement: The policy override is never added by an agent

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The policy override is never added by an agent

- **WHEN** `kodor pr label N --add` or `kodor ticket label N --add` is given `policy-override`, by key or by its configured name
- **THEN** it refuses, as it refuses `verdict-override`, and the guard hook refuses a `gh` command that adds the configured name.

### Requirement: The label's key

kodor SHALL behave as this line says: When the settings name the label of the tickets kodor works on, its key is `kodor` under `tickets.labels`, and its default value is `kodor`. A key `factory` there is an unknown key.

#### Scenario: The label's key

- **WHEN** the settings name the label of the tickets kodor works on
- **THEN** its key is `kodor` under `tickets.labels`, and its default value is `kodor`. A key `factory` there is an unknown key.
