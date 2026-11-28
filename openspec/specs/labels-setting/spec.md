# labels-setting Specification

## Purpose

The names of the labels lunamill adds to tickets and pull requests, under `tickets.labels` and `code-host.labels`: what `lunamill config check` refuses in them, how the commands take a label's key, and how each reader finds a label by its configured name.

## Requirements

### Requirement: Default label names

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Default label names

- **WHEN** `.claude/lunamill.yaml` has no `tickets.labels` and no `code-host.labels`
- **THEN** lunamill uses the names `spec`, `lunamill`, `merge-automatic`, `merge-manual`, `verdict-override`, and `policy-override`, and `lunamill config explain` shows each under `tickets.labels` or `code-host.labels` marked `# default`, such as `factory: factory  # default`.

### Requirement: Configured names are used

lunamill SHALL behave as this line says: When `tickets.labels` or `code-host.labels` sets a key, every lunamill command, workflow, and hook that reads or adds that label uses the configured name, and a key left out keeps its default.

#### Scenario: Configured names are used

- **WHEN** `tickets.labels` or `code-host.labels` sets a key
- **THEN** every lunamill command, workflow, and hook that reads or adds that label uses the configured name, and a key left out keeps its default.

### Requirement: Unknown label keys

lunamill SHALL behave as this line says: When `tickets.labels` or `code-host.labels` has a key other than its own (`spec` and `lunamill`; `merge-automatic`, `merge-manual`, and `verdict-override`), `lunamill config check` fails naming the key, as it does for any unknown key, such as `.claude/lunamill.yaml: tickets.labels.follow-up: unknown key`.

#### Scenario: Unknown label keys

- **WHEN** `tickets.labels` or `code-host.labels` has a key other than its own (`spec` and `lunamill`; `merge-automatic`, `merge-manual`, and `verdict-override`)
- **THEN** `lunamill config check` fails naming the key, as it does for any unknown key, such as `.claude/lunamill.yaml: tickets.labels.follow-up: unknown key`.

### Requirement: An empty label name

lunamill SHALL behave as this line says: When a configured name is empty or only spaces, `lunamill config check` fails with `.claude/lunamill.yaml: KEY: must not be empty`, where KEY is the full key, such as `tickets.labels.spec`.

#### Scenario: An empty label name

- **WHEN** a configured name is empty or only spaces
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: KEY: must not be empty`, where KEY is the full key, such as `tickets.labels.spec`.

### Requirement: Two labels with one name

lunamill SHALL refuse two label keys whose names are equal ignoring case, naming the key the file sets, as the scenario says.

#### Scenario: Two labels with one name

- **WHEN** two keys give names equal ignoring case
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: KEY: "NAME" is already OTHER. Give each label its own name`, such as `code-host.labels.merge-manual: "Spec" is already tickets.labels.spec`. A default name counts. KEY is a key the file sets: of two set keys, the later in the order `spec`, `lunamill`, `merge-automatic`, `merge-manual`, `verdict-override`; of a set key and a default, the set one. So `tickets.labels.lunamill: spec` alone fails as `tickets.labels.lunamill: "spec" is already tickets.labels.spec`.

### Requirement: Separate tools may share a name

lunamill SHALL behave as this line says: When `tickets.type` and `code-host.type` name different tools, a ticket label and a pull request label may share a name; two ticket labels, or two pull request labels, still may not.

#### Scenario: Separate tools may share a name

- **WHEN** `tickets.type` and `code-host.type` name different tools
- **THEN** a ticket label and a pull request label may share a name; two ticket labels, or two pull request labels, still may not.

### Requirement: A name the adapter refuses

lunamill SHALL behave as this line says: When a tool's adapter refuses a name, `lunamill config check` fails with `.claude/lunamill.yaml: KEY: ` followed by the adapter's reason. The GitHub adapters refuse only an empty name (line 4).

#### Scenario: A name the adapter refuses

- **WHEN** a tool's adapter refuses a name
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: KEY: ` followed by the adapter's reason. The GitHub adapters refuse only an empty name (line 4).

### Requirement: The override's name in the verdict workflow

lunamill SHALL behave as this line says: When `code-host.labels.verdict-override` is set, `lunamill sync` writes that name into `.github/workflows/lunamill.yml`, where the verdict's job starts on the label being added, and `lunamill sync --check` fails while the file names another.

#### Scenario: The override's name in the verdict workflow

- **WHEN** `code-host.labels.verdict-override` is set
- **THEN** `lunamill sync` writes that name into `.github/workflows/lunamill.yml`, where the verdict's job starts on the label being added, and `lunamill sync --check` fails while the file names another.

### Requirement: Init writes no labels

lunamill SHALL behave as this line says: When a `lunamill init` run writes `.claude/lunamill.yaml`, it writes no `labels` key under `tickets` or `code-host`, and asks no question about labels.

#### Scenario: Init writes no labels

- **WHEN** a `lunamill init` run writes `.claude/lunamill.yaml`
- **THEN** it writes no `labels` key under `tickets` or `code-host`, and asks no question about labels.

### Requirement: Ticket commands take a key

lunamill SHALL behave as this line says: When `lunamill ticket label N --add KEY`, `--remove KEY`, or `--was-removed KEY` is given `spec`, it acts on the name `tickets.labels` gives that key; any other word is a label name, `follow-up` included. `lunamill ticket open --label KEY` and `lunamill ticket list --label KEY` translate the same way.

#### Scenario: Ticket commands take a key

- **WHEN** `lunamill ticket label N --add KEY`, `--remove KEY`, or `--was-removed KEY` is given `spec`
- **THEN** it acts on the name `tickets.labels` gives that key; any other word is a label name, `follow-up` included. `lunamill ticket open --label KEY` and `lunamill ticket list --label KEY` translate the same way.

### Requirement: Pull request commands take a key

lunamill SHALL behave as this line says: When `lunamill pr label N --add KEY` or `--remove KEY` is given `merge-automatic`, `merge-manual`, or (for `--remove` only) `verdict-override`, it acts on the name `code-host.labels` gives that key. `lunamill ticket label N --remove` and `--was-removed` translate `verdict-override` the same way.

#### Scenario: Pull request commands take a key

- **WHEN** `lunamill pr label N --add KEY` or `--remove KEY` is given `merge-automatic`, `merge-manual`, or (for `--remove` only) `verdict-override`
- **THEN** it acts on the name `code-host.labels` gives that key. `lunamill ticket label N --remove` and `--was-removed` translate `verdict-override` the same way.

### Requirement: The override is never added by an agent

lunamill SHALL behave as this line says: When `lunamill pr label` or `lunamill ticket label` is asked to add `verdict-override`, or the name `code-host.labels.verdict-override` gives it, ignoring case, it refuses, as it refuses `verdict: override` today, and the guard hook refuses a `gh` command that adds the configured name.

#### Scenario: The override is never added by an agent

- **WHEN** `lunamill pr label` or `lunamill ticket label` is asked to add `verdict-override`, or the name `code-host.labels.verdict-override` gives it, ignoring case
- **THEN** it refuses, as it refuses `verdict: override` today, and the guard hook refuses a `gh` command that adds the configured name.

### Requirement: A renamed label shows its key

lunamill SHALL behave as this line says: When a ticket carries a label whose configured name differs from its key, `lunamill ticket view N` prints it on the `labels:` line as `NAME (KEY)`, such as `labels: enhancement, needs-spec (spec)`; `lunamill ticket view N --field labels` and `lunamill ticket list` print it the same way. A label whose name equals its key prints as today. `--json` output keeps the raw names, since lunamill's own code reads it.

#### Scenario: A renamed label shows its key

- **WHEN** a ticket carries a label whose configured name differs from its key
- **THEN** `lunamill ticket view N` prints it on the `labels:` line as `NAME (KEY)`, such as `labels: enhancement, needs-spec (spec)`; `lunamill ticket view N --field labels` and `lunamill ticket list` print it the same way. A label whose name equals its key prints as today. `--json` output keeps the raw names, since lunamill's own code reads it.

### Requirement: The spec track by its configured name

lunamill SHALL behave as this line says: When `tickets.labels.spec` is set, the refined check, the ticket-fields split, and `lunamill specs new` read a ticket as on the spec track when it carries that name.

#### Scenario: The spec track by its configured name

- **WHEN** `tickets.labels.spec` is set
- **THEN** the refined check, the ticket-fields split, and `lunamill specs new` read a ticket as on the spec track when it carries that name.

### Requirement: A name that needs quotes

lunamill SHALL say a label value with an unquoted `: ` needs quotes, in place of js-yaml's error, as the scenario says.

#### Scenario: A name that needs quotes

- **WHEN** `.claude/lunamill.yaml` can't be read because a line `KEY: VALUE` has an unquoted `: ` in VALUE
- **THEN** the settings reader in `src/config.mts`, which `lunamill config check`, `lunamill sync`, `lunamill config explain`, and every other command reading `.claude/lunamill.yaml` call, prints `.claude/lunamill.yaml: line N: KEY: VALUE needs quotes around the name, such as KEY: "VALUE"` in place of js-yaml's `bad indentation of a mapping entry`. Any other YAML error is reported as today.

### Requirement: The lunamill label by its configured name

lunamill SHALL behave as this line says: When `tickets.labels.lunamill` is set, every command, workflow, and the scheduled poller use that name; `lunamill config check` refuses it empty, or equal ignoring case to another label's name, with the messages it gives `spec`.

#### Scenario: The lunamill label by its configured name

- **WHEN** `tickets.labels.lunamill` is set
- **THEN** every command, workflow, and the scheduled poller use that name; `lunamill config check` refuses it empty, or equal ignoring case to another label's name, with the messages it gives `spec`.

### Requirement: Label commands take lunamill key

lunamill SHALL behave as this line says: When `lunamill ticket label N --add factory` or `--remove factory` is given the key `lunamill`, it acts on the name `tickets.labels.lunamill` gives, as it does for `spec`.

#### Scenario: Label commands take lunamill key

- **WHEN** `lunamill ticket label N --add factory` or `--remove factory` is given the key `lunamill`
- **THEN** it acts on the name `tickets.labels.lunamill` gives, as it does for `spec`.

### Requirement: The policy override's name in the workflow

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The policy override's name in the workflow

- **WHEN** `code-host.labels` names `policy-override`
- **THEN** `lunamill sync` writes that name into `.github/workflows/lunamill.yml`, where the approval policies job starts on it being added, and `lunamill sync --check` fails while the file names another.

### Requirement: The policy override is never added by an agent

lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The policy override is never added by an agent

- **WHEN** `lunamill pr label N --add` or `lunamill ticket label N --add` is given `policy-override`, by key or by its configured name
- **THEN** it refuses, as it refuses `verdict-override`, and the guard hook refuses a `gh` command that adds the configured name.

### Requirement: The label's key

lunamill SHALL behave as this line says: When the settings name the label of the tickets lunamill works on, its key is `lunamill` under `tickets.labels`, and its default value is `lunamill`. A key `factory` there is an unknown key.

#### Scenario: The label's key

- **WHEN** the settings name the label of the tickets lunamill works on
- **THEN** its key is `lunamill` under `tickets.labels`, and its default value is `lunamill`. A key `factory` there is an unknown key.
