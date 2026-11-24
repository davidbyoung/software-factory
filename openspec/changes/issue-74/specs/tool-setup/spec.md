## MODIFIED Requirements

### Requirement: Init is unchanged with today's tools

The factory SHALL behave as this line says: `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, the question that asks for `code-host.branch-name` when the settings in effect have none, the spec tool's question and install that #37's lines 17 to 24 add, what #73's lines 20 and 46 add and take away, and what #74's lines 27 to 54 add and take away.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, the question that asks for `code-host.branch-name` when the settings in effect have none, the spec tool's question and install that #37's lines 17 to 24 add, what #73's lines 20 and 46 add and take away, and what #74's lines 27 to 54 add and take away.

### Requirement: Left to do names the gate

The factory SHALL behave as this line says: When `commands.gate` is empty and `init`'s question for the gate was left empty, `init`'s "Left to do" includes `Add the commands that check a change, under commands.gate in .claude/factory.yaml`.

#### Scenario: Left to do names the gate

- **WHEN** `commands.gate` is empty and `init`'s question for the gate was left empty
- **THEN** `init`'s "Left to do" includes `Add the commands that check a change, under commands.gate in .claude/factory.yaml`.

### Requirement: An unsupported code host

`init` SHALL name every code host it supports when no remote is on one of
them.

#### Scenario: An unsupported code host

- **WHEN** no remote is on a code host the factory supports
- **THEN** `init` says so and names every one it supports, as a list ("A, B, and C").

### Requirement: A ticket system's value

`init` SHALL ask for a value the ticket system in use declares, unless the
settings or a preset give it, and write it under `tickets` in
`.claude/factory.yaml`.

#### Scenario: A ticket system's value

- **WHEN** the ticket system in use declares a value it needs, such as a site address, and neither the settings nor a preset gives it
- **THEN** `init` asks for it after the parts are chosen and writes it under `tickets` in `.claude/factory.yaml`. The plan's `settings` row names the settings file, `Write .claude/factory.yaml`, with any other settings file it writes listed after it.

### Requirement: A tool's secret

`init` SHALL get a secret a tool needs the way the tool says, and store it
through the runner under each name the tool gives, except a token a person's
machine already holds and the tokens an organization stores.

#### Scenario: A tool's secret

- **WHEN** a tool needs a secret that is not set
- **THEN** `init` prints the tool's introduction, opens the tool's page and prints its address, or runs the tool's command attached to the terminal, then reads the value in a masked prompt with the tool's prompt text. It stores the value through the runner under each name the tool gives. The plan's `secrets` row lists those names before anything changes. Two cases differ. In a repository an organization owns, `init` asks for neither the code host's token nor the coding agent's credential, and lists neither. In a repository a person owns, it stores either from the credentials file without asking when the file holds one that still serves, as `machine-tokens` says.

### Requirement: A secret already set

`init` SHALL ask for a tool's secret that is already set only when told to
replace the secrets.

#### Scenario: A secret already set

- **WHEN** a re-run finds a tool's secret already set
- **THEN** `init` counts it in "N secrets these parts read are already set. Replace them?" and asks for it only when the answer is yes. In a repository an organization owns, the code host's token and the coding agent's credential are neither counted nor asked for.

### Requirement: Choosing among tools

`init` SHALL ask which ticket system or runner to use only when more than
one is available and no preset names it.

#### Scenario: Choosing among tools

- **WHEN** more than one ticket system or runner is available
- **THEN** `init` asks which, after `Found` and the presets it follows, with the one the settings name chosen by default, and writes its name to `tickets.type` or `builds.runner`. It asks nothing for one a preset names. With one available, it asks nothing and names it under `Found`, as today, where a run that chooses presets has no `Tickets` row.

### Requirement: Doctor is unchanged with today's tools

The factory SHALL behave as this line says: `factory doctor` prints the same checks as before this change with today's tools, sorted and worded as lines 20 to 25 and 33 say, and two lines #74 adds. With `pr-review` set, it says whether "Review verdict" is required, under the code host's name, as `setup-pull-request` words it. Where a preset's repository runs the poller, it prints that repository's `factory-poller.yml` line under the runner's name, in place of the line for `factory.yml`.

#### Scenario: Doctor is unchanged with today's tools

- **WHEN** `factory doctor` runs with today's tools
- **THEN** `factory doctor` prints the same checks as before this change with today's tools, sorted and worded as lines 20 to 25 and 33 say, and two lines #74 adds. With `pr-review` set, it says whether "Review verdict" is required, under the code host's name, as `setup-pull-request` words it. Where a preset's repository runs the poller, it prints that repository's `factory-poller.yml` line under the runner's name, in place of the line for `factory.yml`.

### Requirement: A disabled poller workflow

The factory SHALL behave as this line says: When `builds.trigger` is `github-action` and the poller's workflow is disabled on GitHub Actions, `factory doctor` fails with `factory.yml is disabled` and the fix `Enable it on the Actions tab, or run: gh workflow enable factory.yml`. Where a preset's repository, OWNER/NAME, runs the poller, it fails with `factory-poller.yml is disabled in OWNER/NAME` and the fix `Enable it on the Actions tab of OWNER/NAME`.

#### Scenario: A disabled poller workflow

- **WHEN** `builds.trigger` is `github-action` and the poller's workflow is disabled on GitHub Actions
- **THEN** `factory doctor` fails with `factory.yml is disabled` and the fix `Enable it on the Actions tab, or run: gh workflow enable factory.yml`. Where a preset's repository, OWNER/NAME, runs the poller, it fails with `factory-poller.yml is disabled in OWNER/NAME` and the fix `Enable it on the Actions tab of OWNER/NAME`.

### Requirement: A poller workflow not yet pushed

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A poller workflow not yet pushed

- **WHEN** `builds.trigger` is `github-action` and the workflow is not yet on the default branch
- **THEN** `doctor` shows that check as off, reading `factory.yml is not on the default branch yet`, so `init`'s own checks pass before the setup's pull request merges. Where a preset's repository, OWNER/NAME, runs the poller and `factory-poller.yml` is not on its default branch, `doctor` fails with `factory-poller.yml is not on the default branch of OWNER/NAME` and the fix `An owner of OWNER runs factory init --org again`.

### Requirement: Init requires the coding agent

The factory SHALL behave as this line says: When `factory init` runs and the coding agent's command isn't installed, init prints `Setting up the software factory for <repository>`, a blank line, then `The factory runs in a coding agent, and <label> is not installed.`, `Install it and run factory init again.`, and `Nothing changed.`, and exits 1. It asks nothing but which repository, where the remotes leave that open, writes no file, and changes no board and no secret.

#### Scenario: Init requires the coding agent

- **WHEN** `factory init` runs and the coding agent's command isn't installed
- **THEN** Init prints `Setting up the software factory for <repository>`, a blank line, then `The factory runs in a coding agent, and <label> is not installed.`, `Install it and run factory init again.`, and `Nothing changed.`, and exits 1. It asks nothing but which repository, where the remotes leave that open, writes no file, and changes no board and no secret.

### Requirement: Init plans the spec tool's install

The factory SHALL show an `install` row in init's plan, after every row but a `turn off` row and the `pull request` row, when the spec tool the settings name is not installed, as the scenario says.

#### Scenario: Init plans the spec tool's install

- **WHEN** the settings in effect, or line 19's answer, name a spec tool that its adapter says is not installed (for OpenSpec: `package.json` lists `@fission-ai/openspec` in neither `dependencies` nor `devDependencies`)
- **THEN** Init's plan has the row `install`, padded to 12 as the plan's other labels are, then two spaces and the adapter's package and command, for OpenSpec `@fission-ai/openspec, with npm install --save-dev`. The row comes after every other row but any `turn off` row and the `pull request` row.

### Requirement: Init installs nothing when it is not needed

The factory SHALL behave as this line says: When the adapter says its tool is installed, or `specs` is `none`, init's plan has no `install` row and init installs nothing. Lines 17 to 24 are the only change to what `factory init` prints and asks with today's tools.

#### Scenario: Init installs nothing when it is not needed

- **WHEN** the adapter says its tool is installed, or `specs` is `none`
- **THEN** Init's plan has no `install` row and init installs nothing. Lines 17 to 24 are the only change to what `factory init` prints and asks with today's tools.

### Requirement: The plan stores the credential

The factory SHALL behave as this line says: When `init` will store a credential kept on the machine, its plan has a `store` row after the tools' `secrets` row: the label, padded to 12, two spaces, and `your LABEL credential on this machine, in PATH`. In a repository a person owns, the row first lists the code host's token and the coding agent's credential that `init` will keep there, as in `your GitHub token and your LABEL credential on this machine, in PATH`.

#### Scenario: The plan stores the credential

- **WHEN** `init` will store a credential kept on the machine
- **THEN** its plan has a `store` row after the tools' `secrets` row: the label, padded to 12, two spaces, and `your LABEL credential on this machine, in PATH`. In a repository a person owns, the row first lists the code host's token and the coding agent's credential that `init` will keep there, as in `your GitHub token and your LABEL credential on this machine, in PATH`.

### Requirement: This machine's row

The factory SHALL behave as this line says: When `.claude/factory.yaml` exists and the ticket system in use keeps a credential on the machine, `Found` has a `This machine` row reading `LABEL credential for SITE`, `no LABEL credential for SITE`, or `LABEL refused the credential for SITE`. It is the last row of `Found`, but for the tokens' `This machine` row, which follows it in a repository a person owns.

#### Scenario: This machine's row

- **WHEN** `.claude/factory.yaml` exists and the ticket system in use keeps a credential on the machine
- **THEN** `Found` has a `This machine` row reading `LABEL credential for SITE`, `no LABEL credential for SITE`, or `LABEL refused the credential for SITE`. It is the last row of `Found`, but for the tokens' `This machine` row, which follows it in a repository a person owns.

### Requirement: An unreadable file stops init

The factory SHALL behave as this line says: When the file can be read by others, or is not valid YAML, `init` prints line 4's message, or `PATH is not valid YAML: REASON. Fix or delete it, then run factory init again.`, after `Found` and any line under it about the organization, asks nothing more, and exits 1. In a repository a person owns it does so whatever the ticket system, since the tokens are kept in that file.

#### Scenario: An unreadable file stops init

- **WHEN** the file can be read by others, or is not valid YAML
- **THEN** `init` prints line 4's message, or `PATH is not valid YAML: REASON. Fix or delete it, then run factory init again.`, after `Found` and any line under it about the organization, asks nothing more, and exits 1. In a repository a person owns it does so whatever the ticket system, since the tokens are kept in that file.

### Requirement: Init asks for this machine's credential

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init asks for this machine's credential

- **WHEN** line 18's row reads missing, or refused for a credential read from the file (one read from the environment is refused with line 6's message, and nothing is asked, since the variables would still win)
- **THEN** `init` asks for the credential after `Found` and any line under it about the organization, before it lists the repository's secrets for the parts, stores it in the file only, prints `It belongs to ACCOUNT. Stored on this machine.`, then asks `Change which parts are on?`, defaulting to no. When a part is left empty, it prints the tool's line for that and `Run factory init again to add it.` in place of the stored line, and still asks.

### Requirement: No machine credential with GitHub's tickets

The factory SHALL behave as this line says: When the ticket system in use keeps nothing on the machine, as GitHub's does not, `init` prints no `This machine` row for a ticket system's credential and asks no line 20 question. In a repository a person owns, `Found` still has the tokens' `This machine` row, such as `no GitHub token for cloud runs`.

#### Scenario: No machine credential with GitHub's tickets

- **WHEN** the ticket system in use keeps nothing on the machine, as GitHub's does not
- **THEN** `init` prints no `This machine` row for a ticket system's credential and asks no line 20 question. In a repository a person owns, `Found` still has the tokens' `This machine` row, such as `no GitHub token for cloud runs`.

### Requirement: The specs that name a workflow file

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The specs that name a workflow file

- **WHEN** a line of a spec this requirement lists names an old workflow file, `npm ci` for the factory, or `npx --no-install factory`
- **THEN** Each line of `board-poller`, `board-columns`, `board-sync-trigger`, `default-branch`, `labels-setting`, `npm-registry-secrets`, `ticket-keys`, `tool-setup`, and `cli-output` that names an old workflow file, `npm ci` for the factory, or `npx --no-install factory` names `factory.yml` or `factory-review.yml`, its job, or `factory`. A secret `.npmrc` names still reaches each job that installs or runs a session, and doctor's poller lines name `factory.yml`, or `factory-poller.yml` for the poller a preset's repository runs.
