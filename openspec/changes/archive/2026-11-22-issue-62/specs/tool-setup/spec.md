## ADDED Requirements

### Requirement: A credential of several parts

The factory SHALL behave as this line says: When a ticket system's credential has more than one part, `factory init` asks for each in the tool's order with the tool's prompt, masked only where the tool says, then checks them together with the tool's check.

#### Scenario: A credential of several parts

- **WHEN** a ticket system's credential has more than one part
- **THEN** `factory init` asks for each in the tool's order with the tool's prompt, masked only where the tool says, then checks them together with the tool's check.

### Requirement: A refused credential at setup

The factory SHALL behave as this line says: When the ticket system answers the check with `401`, `init` prints the tool's refusal line with REASON, such as `Jira refused that email and token: 401 Unauthorized. Paste another.`, and asks again from the first masked part. Any other failure prints the tool's message, and asks again the same way.

#### Scenario: A refused credential at setup

- **WHEN** the ticket system answers the check with `401`
- **THEN** `init` prints the tool's refusal line with REASON, such as `Jira refused that email and token: 401 Unauthorized. Paste another.`, and asks again from the first masked part. Any other failure prints the tool's message, and asks again the same way.

### Requirement: The plan stores the credential

The factory SHALL behave as this line says: When `init` will store a credential kept on the machine, its plan has the row `Store    your LABEL credential on this machine, in PATH`, after the `Secrets` row.

#### Scenario: The plan stores the credential

- **WHEN** `init` will store a credential kept on the machine
- **THEN** its plan has the row `Store    your LABEL credential on this machine, in PATH`, after the `Secrets` row.

### Requirement: A pasted credential is stored in both places

The factory SHALL behave as this line says: When a credential is pasted on a first setup, `init` stores it under each of its secret names through the runner and in the file, and prints `It belongs to ACCOUNT. Stored as NAMES, and on this machine.`, ACCOUNT being what the tool's check names.

#### Scenario: A pasted credential is stored in both places

- **WHEN** a credential is pasted on a first setup
- **THEN** `init` stores it under each of its secret names through the runner and in the file, and prints `It belongs to ACCOUNT. Stored as NAMES, and on this machine.`, ACCOUNT being what the tool's check names.

### Requirement: A credential copied from this machine

The factory SHALL behave as this line says: When the file already holds a credential for the site on a first setup and the tool's check accepts it, `init` stores those values as the repository's secrets with no prompt, and prints `It belongs to ACCOUNT. Stored as NAMES, from this machine.` When the check refuses it, `init` asks as in line 15.

#### Scenario: A credential copied from this machine

- **WHEN** the file already holds a credential for the site on a first setup and the tool's check accepts it
- **THEN** `init` stores those values as the repository's secrets with no prompt, and prints `It belongs to ACCOUNT. Stored as NAMES, from this machine.` When the check refuses it, `init` asks as in line 15.

### Requirement: The file's modes

The factory SHALL behave as this line says: When `init` writes the file, the folder is created `700`, or set to `700` when it is looser, the file is `600` before any value is in it, every other entry is kept, and the file is replaced whole, so a failed write leaves the old one.

#### Scenario: The file's modes

- **WHEN** `init` writes the file
- **THEN** the folder is created `700`, or set to `700` when it is looser, the file is `600` before any value is in it, every other entry is kept, and the file is replaced whole, so a failed write leaves the old one.

### Requirement: This machine's row

The factory SHALL behave as this line says: When `.claude/factory.yaml` exists and the ticket system in use keeps a credential on the machine, `Found` ends with a `This machine` row reading `LABEL credential for SITE`, `no LABEL credential for SITE`, or `LABEL refused the credential for SITE`.

#### Scenario: This machine's row

- **WHEN** `.claude/factory.yaml` exists and the ticket system in use keeps a credential on the machine
- **THEN** `Found` ends with a `This machine` row reading `LABEL credential for SITE`, `no LABEL credential for SITE`, or `LABEL refused the credential for SITE`.

### Requirement: An unreadable file stops init

The factory SHALL behave as this line says: When the file can be read by others, or is not valid YAML, `init` prints line 4's message, or `PATH is not valid YAML: REASON. Fix or delete it, then run factory init again.`, right after `Found`, asks nothing, and exits 1.

#### Scenario: An unreadable file stops init

- **WHEN** the file can be read by others, or is not valid YAML
- **THEN** `init` prints line 4's message, or `PATH is not valid YAML: REASON. Fix or delete it, then run factory init again.`, right after `Found`, asks nothing, and exits 1.

### Requirement: Init asks for this machine's credential

The factory SHALL behave as this line says: When line 18's row reads missing or refused, `init` asks for the credential right after `Found`, before it lists the repository's secrets, stores it in the file only, prints `It belongs to ACCOUNT. Stored on this machine.`, then asks `Change which parts are on?`, defaulting to no. When a part is left empty, it prints the tool's line for that and `Run factory init again to add it.` in place of the stored line, and still asks.

#### Scenario: Init asks for this machine's credential

- **WHEN** line 18's row reads missing, or refused for a credential read from the file (one read from the environment is refused with line 6's message, and nothing is asked, since the variables would still win)
- **THEN** `init` asks for the credential right after `Found`, before it lists the repository's secrets, stores it in the file only, prints `It belongs to ACCOUNT. Stored on this machine.`, then asks `Change which parts are on?`, defaulting to no. When a part is left empty, it prints the tool's line for that and `Run factory init again to add it.` in place of the stored line, and still asks.

### Requirement: No change to the parts

The factory SHALL behave as this line says: When the answer to line 20's question is no, `init` prints `Nothing else changed.` and exits 0, writing nothing else and changing no secret.

#### Scenario: No change to the parts

- **WHEN** the answer to line 20's question is no
- **THEN** `init` prints `Nothing else changed.` and exits 0, writing nothing else and changing no secret.

### Requirement: A change to the parts

The factory SHALL behave as this line says: When the answer is yes, `init` carries on from listing the secrets as it does today.

#### Scenario: A change to the parts

- **WHEN** the answer is yes
- **THEN** `init` carries on from listing the secrets as it does today.

### Requirement: Secrets that cannot be listed after this machine's credential

The factory SHALL behave as this line says: When `init` cannot list the repository's secrets after line 20, it prints `Could not list the repository's secrets, so the parts are left as they are: REASON` and exits 0.

#### Scenario: Secrets that cannot be listed after this machine's credential

- **WHEN** `init` cannot list the repository's secrets after line 20
- **THEN** it prints `Could not list the repository's secrets, so the parts are left as they are: REASON` and exits 0.

### Requirement: No machine credential with GitHub's tickets

The factory SHALL behave as this line says: When the ticket system in use keeps nothing on the machine, as GitHub's does not, `init` prints no `This machine` row and asks no line 20 question.

#### Scenario: No machine credential with GitHub's tickets

- **WHEN** the ticket system in use keeps nothing on the machine, as GitHub's does not
- **THEN** `init` prints no `This machine` row and asks no line 20 question.

### Requirement: Doctor checks this machine's credential

The factory SHALL print, when the ticket system in use keeps a credential on the machine, one `factory doctor` line about it under the ticket system's heading: accepted, from the file or the environment, or the failure with its fix.

#### Scenario: Doctor checks this machine's credential

- **WHEN** the ticket system in use keeps a credential on the machine
- **THEN** `factory doctor` prints one line about it under the ticket system's heading: `✓ The credential on this machine is accepted, for ACCOUNT`; `✓ The credential in NAMES is accepted, for ACCOUNT` when it came from the environment; or `✗` and the failure, with its fix after it as every `doctor` line has one: `No credential on this machine for SITE. Run factory init`; `The credential on this machine is refused (REASON). It may have expired. Run factory init`; `The credential in NAMES is refused (REASON). They may have expired: replace them where they are set` when it came from the environment; `The credential on this machine could not be checked (REASON). Check that SITE can be reached. Run factory doctor`; `PATH can be read by others. Run chmod 600 PATH`; or `PATH is not valid YAML. Fix or delete it. Run factory init`. `doctor` makes this check itself for any such ticket system; the tool's own `checks` do not, and are skipped when the credential is not accepted.

### Requirement: The ticket system opened through the registry

The factory SHALL behave as this line says: When a ticket system other than GitHub is registered, as Fake Tickets is in a test, and the settings name it in `tickets.type`, every `factory ticket` command, `factory status`, the board sync, and `factory poller --once` open it through the registry. A poller run with no settings, as one someone hosts, opens the default ticket system.

#### Scenario: The ticket system opened through the registry

- **WHEN** a ticket system other than GitHub is registered, as Fake Tickets is in a test, and the settings name it in `tickets.type`
- **THEN** every `factory ticket` command, `factory status`, the board sync, and `factory poller --once` open it through the registry. A poller run with no settings, as one someone hosts, opens the default ticket system.
