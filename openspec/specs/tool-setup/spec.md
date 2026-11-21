# tool-setup Specification

## Purpose

What `factory init`, `factory doctor`, and `factory config check` ask of each tool (code host, ticket system, runner, and coding agent) to set it up and check its secrets, so a new tool needs no edit to them.

## Requirements

### Requirement: Init is unchanged with today's tools

The factory SHALL behave as this line says: `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, and the question that asks for `code-host.branch-name` when the settings in effect have none.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** `factory init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, and the question that asks for `code-host.branch-name` when the settings in effect have none.

### Requirement: A ticket system's value

`init` SHALL ask for a value the ticket system in use declares, and write
it under `tickets` in `.claude/factory.yaml`.

#### Scenario: A ticket system's value

- **WHEN** the ticket system in use declares a value it needs, such as a site address
- **THEN** `init` asks for it after the parts are chosen and writes it under `tickets` in `.claude/factory.yaml`. The plan's `Write` line for the settings file is there.

### Requirement: A value already set

`init` SHALL NOT ask again for a value already in the settings.

#### Scenario: A value already set

- **WHEN** a re-run finds that value already in the settings
- **THEN** `init` does not ask for it.

### Requirement: A tool's secret

`init` SHALL get a secret a tool needs the way the tool says, and store it
through the runner under each name the tool gives.

#### Scenario: A tool's secret

- **WHEN** a tool needs a secret that is not set
- **THEN** `init` prints the tool's introduction, opens the tool's page and prints its address, or runs the tool's command attached to the terminal, then reads the value in a masked prompt with the tool's prompt text. It stores the value through the runner under each name the tool gives. The plan's `Secrets` line lists those names before anything changes.

### Requirement: A refused secret

`init` SHALL print a tool's reason for refusing a pasted secret and ask
again.

#### Scenario: A refused secret

- **WHEN** a tool checks a pasted secret and refuses it
- **THEN** `init` prints the tool's reason, as the tool words it, and asks again.

### Requirement: A secret left for later

The factory SHALL behave as this line says: When nothing is pasted for a tool's secret, `init` prints the tool's line for that, followed by `Run factory init again to add it.`

#### Scenario: A secret left for later

- **WHEN** nothing is pasted for a tool's secret
- **THEN** `init` prints the tool's line for that, followed by `Run factory init again to add it.`

### Requirement: A secret already set

`init` SHALL ask for a tool's secret that is already set only when told to
replace the secrets.

#### Scenario: A secret already set

- **WHEN** a re-run finds a tool's secret already set
- **THEN** `init` counts it in "N secrets these parts read are already set. Replace them?" and asks for it only when the answer is yes.

### Requirement: Choosing among tools

`init` SHALL ask which ticket system or runner to use only when more than
one is available.

#### Scenario: Choosing among tools

- **WHEN** more than one ticket system or runner is available
- **THEN** `init` asks which, right after `Found`, with the one the settings name chosen by default, and writes its name to `tickets.type` or `builds.runner`. With one available, it asks nothing and names it under `Found`, as today.

### Requirement: An unsupported code host

`init` SHALL name every code host it supports when the origin remote is on
none of them.

#### Scenario: An unsupported code host

- **WHEN** the origin remote is on no code host the factory supports
- **THEN** `init` says so and names every one it supports, as a list ("A, B, and C").

### Requirement: Doctor is unchanged with today's tools

The factory SHALL behave as this line says: `factory doctor` prints the same checks as before this change with today's tools, sorted and worded as lines 20 to 25 and 33 say.

#### Scenario: Doctor is unchanged with today's tools

- **WHEN** `factory doctor` runs with today's tools
- **THEN** `factory doctor` prints the same checks as before this change with today's tools, sorted and worded as lines 20 to 25 and 33 say.

### Requirement: A tool's secret not set

The factory SHALL behave as this line says: When a secret a tool needs is not set, `doctor` fails `NAME is not set, for PARTS` with the fix `Run factory init`.

#### Scenario: A tool's secret not set

- **WHEN** a secret a tool needs is not set
- **THEN** `doctor` fails `NAME is not set, for PARTS` with the fix `Run factory init`.

### Requirement: A tool's own check

`doctor` SHALL print a tool's failing check in the tool's words and exit
non-zero.

#### Scenario: A tool's own check

- **WHEN** a tool's own check fails, such as a site that cannot be reached
- **THEN** `doctor` prints the failure and fix in the tool's words, and exits non-zero.

### Requirement: The names of tools

`factory config check` SHALL accept exactly the names of each kind's
available tools.

#### Scenario: The names of tools

- **WHEN** `factory config check` reads `tickets.type`, `code-host.type`, or `builds.runner`
- **THEN** it accepts exactly the names of that kind's available tools, and refuses any other with today's message, naming those that are built.

### Requirement: A ticket system's keys

`config check` SHALL refuse a key under `tickets` that the chosen ticket
system does not declare.

#### Scenario: A ticket system's keys

- **WHEN** the settings have a key under `tickets` that is neither one of today's keys nor declared by the chosen ticket system
- **THEN** `config check` refuses it as it refuses an unknown key today.

### Requirement: Where the poller runs

The factory SHALL behave as this line says: When the part "Builds that start when you move a card to Ready" is chosen, `init` asks "Where does the poller run?", with "A schedule on GitHub Actions, every 5 minutes, nothing to host" first and "A server you host, within a minute" second, and writes `builds.trigger` as `github-action` or `own-server`.

#### Scenario: Where the poller runs

- **WHEN** the part "Builds that start when you move a card to Ready" is chosen
- **THEN** `init` asks "Where does the poller run?", with "A schedule on GitHub Actions, every 5 minutes, nothing to host" first and "A server you host, within a minute" second, and writes `builds.trigger` as `github-action` or `own-server`.

### Requirement: How often, on a private repository

The factory SHALL behave as this line says: When the schedule is chosen on a private repository, `init` asks "How often?", listing each interval with its runs a month (5: 8,640; 10: 4,320; 15: 2,880; 30: 1,440; 60: 720) and the line "Each run bills at least one Actions minute on a private repository.", with 30 chosen by default. It writes `builds.poll-minutes` unless the answer is 5.

#### Scenario: How often, on a private repository

- **WHEN** the schedule is chosen on a private repository
- **THEN** `init` asks "How often?", listing each interval with its runs a month (5: 8,640; 10: 4,320; 15: 2,880; 30: 1,440; 60: 720) and the line "Each run bills at least one Actions minute on a private repository.", with 30 chosen by default. It writes `builds.poll-minutes` unless the answer is 5.

### Requirement: No interval on a public repository

The factory SHALL behave as this line says: When the schedule is chosen on a public repository, `init` asks no interval and writes no `builds.poll-minutes`.

#### Scenario: No interval on a public repository

- **WHEN** the schedule is chosen on a public repository
- **THEN** `init` asks no interval and writes no `builds.poll-minutes`.

### Requirement: The poller's questions on a re-run

The factory SHALL behave as this line says: When a re-run finds `builds.trigger` already `github-action` or `own-server`, `init` asks neither "Where does the poller run?" nor "How often?".

#### Scenario: The poller's questions on a re-run

- **WHEN** a re-run finds `builds.trigger` already `github-action` or `own-server`
- **THEN** `init` asks neither "Where does the poller run?" nor "How often?".

### Requirement: The interval goes with the schedule

The factory SHALL behave as this line says: When the part is turned off, or the server is chosen, `init` removes `builds.poll-minutes` from the settings.

#### Scenario: The interval goes with the schedule

- **WHEN** the part is turned off, or the server is chosen
- **THEN** `init` removes `builds.poll-minutes` from the settings.

### Requirement: Nothing to host with the schedule

The factory SHALL behave as this line says: When the schedule is chosen, "Left to do" has no step about hosting a poller.

#### Scenario: Nothing to host with the schedule

- **WHEN** the schedule is chosen
- **THEN** "Left to do" has no step about hosting a poller.

### Requirement: The image to host

The factory SHALL behave as this line says: When the server is chosen, "Left to do" reads "Run the poller's image, ghcr.io/davidbyoung/software-factory-poller:VERSION, where you host it, with:" followed by today's four variables, VERSION being the installed factory's version.

#### Scenario: The image to host

- **WHEN** the server is chosen
- **THEN** "Left to do" reads "Run the poller's image, ghcr.io/davidbyoung/software-factory-poller:VERSION, where you host it, with:" followed by today's four variables, VERSION being the installed factory's version.

### Requirement: The part's description

The factory SHALL behave as this line says: The part's description in `init`'s list reads "a schedule on GitHub Actions, or a small server you host".

#### Scenario: The part's description

- **WHEN** `init` lists the parts
- **THEN** The part's description in `init`'s list reads "a schedule on GitHub Actions, or a small server you host".

### Requirement: A disabled poller workflow

The factory SHALL behave as this line says: When `builds.trigger` is `github-action` and the poller's workflow is disabled on GitHub Actions, `factory doctor` fails with `factory-poller.yml is disabled` and the fix `Enable it on the Actions tab, or run: gh workflow enable factory-poller.yml`.

#### Scenario: A disabled poller workflow

- **WHEN** `builds.trigger` is `github-action` and the poller's workflow is disabled on GitHub Actions
- **THEN** `factory doctor` fails with `factory-poller.yml is disabled` and the fix `Enable it on the Actions tab, or run: gh workflow enable factory-poller.yml`.

### Requirement: A poller workflow not yet pushed

The factory SHALL behave as this line says: When `builds.trigger` is `github-action` and the workflow is not yet on the default branch, `doctor` shows that check as off, reading `factory-poller.yml is not on the default branch yet`, so `init`'s own checks pass before the commit.

#### Scenario: A poller workflow not yet pushed

- **WHEN** `builds.trigger` is `github-action` and the workflow is not yet on the default branch
- **THEN** `doctor` shows that check as off, reading `factory-poller.yml is not on the default branch yet`, so `init`'s own checks pass before the commit.

### Requirement: The hosted poller is left by hand

The factory SHALL behave as this line says: When `builds.trigger` is `own-server`, `factory remove`'s list of what is left by hand includes "The poller you host".

#### Scenario: The hosted poller is left by hand

- **WHEN** `builds.trigger` is `own-server`
- **THEN** `factory remove`'s list of what is left by hand includes "The poller you host".

### Requirement: Init writes version 2

The factory SHALL behave as this line says: When `factory init` writes a settings file that has no `version`, it writes `version: 2`.

#### Scenario: Init writes version 2

- **WHEN** `factory init` writes a settings file that has no `version`
- **THEN** it writes `version: 2`.

### Requirement: Left to do names the gate

The factory SHALL behave as this line says: When `commands.gate` is empty, `init`'s "Left to do" includes `Add the commands that check a change, under commands.gate in .claude/factory.yaml`.

#### Scenario: Left to do names the gate

- **WHEN** `commands.gate` is empty
- **THEN** `init`'s "Left to do" includes `Add the commands that check a change, under commands.gate in .claude/factory.yaml`.

### Requirement: Doctor shows a missing gate

The factory SHALL behave as this line says: When `commands.gate` is empty, `factory doctor` prints one more line, shown as off, reading `commands.gate is not set: a build cannot finish until it is`, and its exit status is what it would be without that line.

#### Scenario: Doctor shows a missing gate

- **WHEN** `commands.gate` is empty
- **THEN** `factory doctor` prints one more line, shown as off, reading `commands.gate is not set: a build cannot finish until it is`, and its exit status is what it would be without that line.

### Requirement: An organization's Actions secret counts

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An organization's Actions secret counts

- **WHEN** a repository an organization owns has a secret the factory reads that is not set on the repository, but the organization shares an Actions secret of that name with it
- **THEN** `init` and `doctor` count it as set, for every secret the factory reads. `doctor`'s line then reads `NAME is set by the organization, for ...`. Where the organization's Dependabot secrets can be listed and one of that name is shared with the repository, `init` counts the Dependabot copy as set too, and asks nothing for it. Which secrets `init` offers to delete when a part is turned off, and what `factory remove` reads, stay the repository's own.

### Requirement: An organization's Dependabot secret

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An organization's Dependabot secret

- **WHEN** a Dependabot secret is not set on a repository an organization owns
- **THEN** `doctor` reads the organization's Dependabot secrets. When one of that name is shared with the repository, it passes `NAME is set by the organization for Dependabot, for installing on Dependabot's pull requests`. When they cannot be listed, it prints `? NAME is not set for Dependabot on the repository, and only an organization admin can see whether the organization sets it`, which fails nothing.

### Requirement: A person's repository

The factory SHALL behave as this line says: On a repository a person owns, a secret not set on the repository is not set: no `?` line.

#### Scenario: A person's repository

- **WHEN** a secret is not set on a repository a person owns
- **THEN** On a repository a person owns, a secret not set on the repository is not set: no `?` line.

### Requirement: Secrets that can't be listed

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Secrets that can't be listed

- **WHEN** the repository's Actions secrets cannot be listed
- **THEN** `doctor` fails `The secrets can be listed` as today, prints no line of 16, and still prints 17 to 20. When the repository's own Dependabot secrets cannot be listed, `doctor` fails `The Dependabot secrets can be listed` with the error, as it does today for the Actions secrets, and prints no Dependabot line of 17 or 23; `init` prints `Could not reach the code host: ` and the error, and exits 1, as it does today for the Actions secrets.

### Requirement: An unknown check

The factory SHALL behave as this line says: When a check's state is unknown, `doctor` prints it with a leading `? `, and it does not make `doctor` exit 1.

#### Scenario: An unknown check

- **WHEN** a check's state is unknown
- **THEN** `doctor` prints it with a leading `? `, and it does not make `doctor` exit 1.

### Requirement: Init requires the coding agent

The factory SHALL behave as this line says: When `factory init` runs and the coding agent's command isn't installed, init prints `Setting up the software factory for <repository>`, a blank line, then `The factory runs in a coding agent, and <label> is not installed.`, `Install it and run factory init again.`, and `Nothing changed.`, and exits 1. It asks nothing, writes nothing, and changes no board and no secret.

#### Scenario: Init requires the coding agent

- **WHEN** `factory init` runs and the coding agent's command isn't installed
- **THEN** Init prints `Setting up the software factory for <repository>`, a blank line, then `The factory runs in a coding agent, and <label> is not installed.`, `Install it and run factory init again.`, and `Nothing changed.`, and exits 1. It asks nothing, writes nothing, and changes no board and no secret.

### Requirement: Init asks for the branch name

The factory SHALL behave as this line says: When `factory init` runs and the settings in effect have no `code-host.branch-name`, it asks `How should a build name its branch? Use {ticket}, and {user} for the GitHub account:` with `{ticket}` filled in, right after the ticket system and the runner are chosen.

#### Scenario: Init asks for the branch name

- **WHEN** `factory init` runs and the settings in effect have no `code-host.branch-name`
- **THEN** it asks `How should a build name its branch? Use {ticket}, and {user} for the GitHub account:` with `{ticket}` filled in, right after the ticket system and the runner are chosen.

### Requirement: Init writes the branch name

The factory SHALL behave as this line says: When the person answers, `factory init` writes a `code-host` block to `.claude/factory.yaml` holding `type: github` and `branch-name:` with the answer in double quotes.

#### Scenario: Init writes the branch name

- **WHEN** the person answers
- **THEN** `factory init` writes a `code-host` block to `.claude/factory.yaml` holding `type: github` and `branch-name:` with the answer in double quotes.

### Requirement: Init refuses a faulty pattern

The factory SHALL behave as this line says: When the answer breaks any of lines 4 to 8, `factory init` prints that line's reason, the text after `code-host.branch-name: `, and asks again.

#### Scenario: Init refuses a faulty pattern

- **WHEN** the answer breaks any of lines 4 to 8
- **THEN** `factory init` prints that line's reason, the text after `code-host.branch-name: `, and asks again.

### Requirement: Init keeps a branch name already set

The factory SHALL behave as this line says: When a re-run finds `code-host.branch-name` in the settings in effect, from the file or a preset, `factory init` does not ask for it and leaves it as it is.

#### Scenario: Init keeps a branch name already set

- **WHEN** a re-run finds `code-host.branch-name` in the settings in effect, from the file or a preset
- **THEN** `factory init` does not ask for it and leaves it as it is.

### Requirement: Init fills in a missing branch name

The factory SHALL behave as this line says: When a re-run finds settings whose only faults are a missing `code-host.branch-name` and any states #53 lets init fill in, `factory init` does not stop with "Fix it, then run init again.", keeps every other value, and asks line 18's question.

#### Scenario: Init fills in a missing branch name

- **WHEN** a re-run finds settings whose only faults are a missing `code-host.branch-name` and any states #53 lets init fill in
- **THEN** `factory init` does not stop with "Fix it, then run init again.", keeps every other value, and asks line 18's question.
