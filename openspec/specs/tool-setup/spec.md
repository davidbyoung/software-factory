# tool-setup Specification

## Purpose

What `lunamill init`, `lunamill doctor`, and `lunamill config check` ask of each tool (code host, ticket system, runner, and coding agent) to set it up and check its secrets, so a new tool needs no edit to them.

## Requirements

### Requirement: Init is unchanged with today's tools

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `lunamill init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** `lunamill init` prints the same lines and asks the same questions as before this change with today's tools, except its closing checks, as line 26 says, its fixes, as line 25 says, the question that asks for `code-host.branch-name` when the settings in effect have none, the spec tool's question and install that #37's lines 17 to 24 add, what #73's lines 20 and 46 add and take away, what #74's lines 27 to 54 add and take away, what #81's lines 13 to 17 add, and what #114's lines 13, 14, 16, and 17 add.

### Requirement: A ticket system's value

`init` SHALL ask for a value the ticket system in use declares, unless the
settings or a preset give it, and write it under `tickets` in
`.claude/lunamill.yaml`.

#### Scenario: A ticket system's value

- **WHEN** the ticket system in use declares a value it needs, such as a site address, and neither the settings nor a preset gives it
- **THEN** `init` asks for it after the parts are chosen and writes it under `tickets` in `.claude/lunamill.yaml`. The plan's `settings` row names the settings file, `Write .claude/lunamill.yaml`, with any other settings file it writes listed after it.

### Requirement: A value already set

`init` SHALL NOT ask again for a value already in the settings.

#### Scenario: A value already set

- **WHEN** a re-run finds that value already in the settings
- **THEN** `init` does not ask for it.

### Requirement: A tool's secret

`init` SHALL get a secret a tool needs the way the tool says, and store it
through the runner under each name the tool gives, except a token a person's
machine already holds and the tokens an organization stores.

#### Scenario: A tool's secret

- **WHEN** a tool needs a secret that is not set
- **THEN** `init` prints the tool's introduction, opens the tool's page and prints its address, or runs the tool's command attached to the terminal, then reads the value in a masked prompt with the tool's prompt text. A value pasted over several lines is taken whole, its line breaks dropped: the prompt ends on Enter typed after the paste, where the terminal marks a paste, and on the first line break where it does not. It stores the value through the runner under each name the tool gives. The plan's `secrets` row lists those names before anything changes. Two cases differ. In a repository an organization owns, `init` asks for neither the code host's token nor the coding agent's credential, and lists neither. In a repository a person owns, it stores either from the credentials file without asking when the file holds one that still serves, as `machine-tokens` says.

### Requirement: A refused secret

`init` SHALL print a tool's reason for refusing a pasted secret and ask
again.

#### Scenario: A refused secret

- **WHEN** a tool checks a pasted secret and refuses it
- **THEN** `init` prints the tool's reason, as the tool words it, and asks again.

### Requirement: A secret left for later

Lunamill SHALL behave as this line says: When nothing is pasted for a tool's secret, `init` prints the tool's line for that, followed by `Run lunamill init again to add it.`

#### Scenario: A secret left for later

- **WHEN** nothing is pasted for a tool's secret
- **THEN** `init` prints the tool's line for that, followed by `Run lunamill init again to add it.`

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

### Requirement: An unsupported code host

`init` SHALL name every code host it supports when no remote is on one of
them.

#### Scenario: An unsupported code host

- **WHEN** no remote is on a code host Lunamill supports
- **THEN** `init` says so and names every one it supports, as a list ("A, B, and C").

### Requirement: Doctor is unchanged with today's tools

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Doctor is unchanged with today's tools

- **WHEN** `lunamill doctor` runs with today's tools
- **THEN** `lunamill doctor` prints the same checks as before this change with today's tools, sorted and worded as lines 20 to 25 and 33 say, three lines #74 adds, the line about the Claude token's day that #81 adds, and the lines about the GitHub access token that #114 adds. With `pr-review` set, it says whether "Review verdict" is required, and what CI's own token may do, under the code host's name, as their own requirements word them. Where a preset's repository runs the poller, `lunamill doctor` prints that repository's `lunamill-poller.yml` line under the runner's name, after the line for `lunamill.yml`.

### Requirement: A tool's secret not set

Lunamill SHALL behave as this line says: When a secret a tool needs is not set, `doctor` fails `NAME is not set, for PARTS` with the fix `Run lunamill init`.

#### Scenario: A tool's secret not set

- **WHEN** a secret a tool needs is not set
- **THEN** `doctor` fails `NAME is not set, for PARTS` with the fix `Run lunamill init`.

### Requirement: A tool's own check

`doctor` SHALL print a tool's failing check in the tool's words and exit
non-zero.

#### Scenario: A tool's own check

- **WHEN** a tool's own check fails, such as a site that cannot be reached
- **THEN** `doctor` prints the failure and fix in the tool's words, and exits non-zero.

### Requirement: The names of tools

`lunamill config check` SHALL accept exactly the names of each kind's
available tools.

#### Scenario: The names of tools

- **WHEN** `lunamill config check` reads `tickets.type`, `code-host.type`, or `builds.runner`
- **THEN** it accepts exactly the names of that kind's available tools, and refuses any other with today's message, naming those that are built.

### Requirement: A ticket system's keys

`config check` SHALL refuse a key under `tickets` that the chosen ticket
system does not declare.

#### Scenario: A ticket system's keys

- **WHEN** the settings have a key under `tickets` that is neither one of today's keys nor declared by the chosen ticket system
- **THEN** `config check` refuses it as it refuses an unknown key today.

### Requirement: Where the poller runs

Lunamill SHALL behave as this line says: When the part "Builds that start when you move a card to Ready" is chosen, `init` asks "Where does the poller run?", with "A schedule on GitHub Actions, every 5 minutes, nothing to host" first and "A server you host, within a minute" second, and writes `builds.trigger` as `github-action` or `own-server`.

#### Scenario: Where the poller runs

- **WHEN** the part "Builds that start when you move a card to Ready" is chosen
- **THEN** `init` asks "Where does the poller run?", with "A schedule on GitHub Actions, every 5 minutes, nothing to host" first and "A server you host, within a minute" second, and writes `builds.trigger` as `github-action` or `own-server`.

### Requirement: How often, on a private repository

Lunamill SHALL behave as this line says: When the schedule is chosen on a private repository, `init` asks "How often?", listing each interval with its runs a month (5: 8,640; 10: 4,320; 15: 2,880; 30: 1,440; 60: 720) and the line "Each run bills at least one Actions minute on a private repository.", with 30 chosen by default. It writes `builds.poll-minutes` unless the answer is 5.

#### Scenario: How often, on a private repository

- **WHEN** the schedule is chosen on a private repository
- **THEN** `init` asks "How often?", listing each interval with its runs a month (5: 8,640; 10: 4,320; 15: 2,880; 30: 1,440; 60: 720) and the line "Each run bills at least one Actions minute on a private repository.", with 30 chosen by default. It writes `builds.poll-minutes` unless the answer is 5.

### Requirement: No interval on a public repository

Lunamill SHALL behave as this line says: When the schedule is chosen on a public repository, `init` asks no interval and writes no `builds.poll-minutes`.

#### Scenario: No interval on a public repository

- **WHEN** the schedule is chosen on a public repository
- **THEN** `init` asks no interval and writes no `builds.poll-minutes`.

### Requirement: The poller's questions on a re-run

Lunamill SHALL behave as this line says: When a re-run finds `builds.trigger` already `github-action` or `own-server`, `init` asks neither "Where does the poller run?" nor "How often?".

#### Scenario: The poller's questions on a re-run

- **WHEN** a re-run finds `builds.trigger` already `github-action` or `own-server`
- **THEN** `init` asks neither "Where does the poller run?" nor "How often?".

### Requirement: The interval goes with the schedule

Lunamill SHALL behave as this line says: When the part is turned off, or the server is chosen, `init` removes `builds.poll-minutes` from the settings.

#### Scenario: The interval goes with the schedule

- **WHEN** the part is turned off, or the server is chosen
- **THEN** `init` removes `builds.poll-minutes` from the settings.

### Requirement: Nothing to host with the schedule

Lunamill SHALL behave as this line says: When the schedule is chosen, "Left to do" has no step about hosting a poller.

#### Scenario: Nothing to host with the schedule

- **WHEN** the schedule is chosen
- **THEN** "Left to do" has no step about hosting a poller.

### Requirement: The image to host

Lunamill SHALL behave as this line says: When the server is chosen, "Left to do" reads "Run the poller's image, ghcr.io/lunamill-ai/lunamill-poller:VERSION, where you host it, with:" followed by the variables "Init prints the poller's two variables" in board-poller names, VERSION being the installed Lunamill's version.

#### Scenario: The image to host

- **WHEN** the server is chosen
- **THEN** "Left to do" reads "Run the poller's image, ghcr.io/lunamill-ai/lunamill-poller:VERSION, where you host it, with:" followed by the variables "Init prints the poller's two variables" in board-poller names, VERSION being the installed Lunamill's version.

### Requirement: The part's description

Lunamill SHALL behave as this line says: The part's description in `init`'s list reads "a schedule on GitHub Actions, or a small server you host".

#### Scenario: The part's description

- **WHEN** `init` lists the parts
- **THEN** The part's description in `init`'s list reads "a schedule on GitHub Actions, or a small server you host".

### Requirement: The hosted poller is left by hand

Lunamill SHALL behave as this line says: When `builds.trigger` is `own-server`, `lunamill remove`'s list of what is left by hand includes "The poller you host".

#### Scenario: The hosted poller is left by hand

- **WHEN** `builds.trigger` is `own-server`
- **THEN** `lunamill remove`'s list of what is left by hand includes "The poller you host".

### Requirement: Left to do names the gate

Lunamill SHALL behave as this line says: When `commands.gate` is empty and `init`'s question for the gate was left empty, `init`'s "Left to do" includes `Add the commands that check a change, under commands.gate in .claude/lunamill.yaml`.

#### Scenario: Left to do names the gate

- **WHEN** `commands.gate` is empty and `init`'s question for the gate was left empty
- **THEN** `init`'s "Left to do" includes `Add the commands that check a change, under commands.gate in .claude/lunamill.yaml`.

### Requirement: Doctor shows a missing gate

Lunamill SHALL behave as this line says: When `commands.gate` is empty, `lunamill doctor` prints one more line, shown as off, reading `commands.gate is not set: a build cannot finish until it is`, and its exit status is what it would be without that line.

#### Scenario: Doctor shows a missing gate

- **WHEN** `commands.gate` is empty
- **THEN** `lunamill doctor` prints one more line, shown as off, reading `commands.gate is not set: a build cannot finish until it is`, and its exit status is what it would be without that line.

### Requirement: An organization's Actions secret counts

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An organization's Actions secret counts

- **WHEN** a repository an organization owns has a secret Lunamill reads that is not set on the repository, but the organization shares an Actions secret of that name with it
- **THEN** `init` and `doctor` count it as set, for every secret Lunamill reads. `doctor`'s line then reads `NAME is set by the organization, for ...`. Where the organization's Dependabot secrets can be listed and one of that name is shared with the repository, `init` counts the Dependabot copy as set too, and asks nothing for it. Which secrets `init` offers to delete when a part is turned off, and what `lunamill remove` reads, stay the repository's own.

### Requirement: An organization's Dependabot secret

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An organization's Dependabot secret

- **WHEN** a Dependabot secret is not set on a repository an organization owns
- **THEN** `doctor` reads the organization's Dependabot secrets. When one of that name is shared with the repository, it passes `NAME is set by the organization for Dependabot, for installing on Dependabot's pull requests`. When they cannot be listed, it prints `? NAME is not set for Dependabot on the repository, and only an organization admin can see whether the organization sets it`, which fails nothing.

### Requirement: A person's repository

Lunamill SHALL behave as this line says: On a repository a person owns, a secret not set on the repository is not set: no `?` line.

#### Scenario: A person's repository

- **WHEN** a secret is not set on a repository a person owns
- **THEN** On a repository a person owns, a secret not set on the repository is not set: no `?` line.

### Requirement: Secrets that can't be listed

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Secrets that can't be listed

- **WHEN** the repository's Actions secrets cannot be listed
- **THEN** `doctor` fails `The secrets can be listed` as today, prints no line of 16, and still prints 17 to 20. When the repository's own Dependabot secrets cannot be listed, `doctor` fails `The Dependabot secrets can be listed` with the error, as it does today for the Actions secrets, and prints no Dependabot line of 17 or 23; `init` prints `Could not reach the code host: ` and the error, and exits 1, as it does today for the Actions secrets.

### Requirement: An unknown check

Lunamill SHALL behave as this line says: When a check's state is unknown, `doctor` prints it with a leading `? `, and it does not make `doctor` exit 1.

#### Scenario: An unknown check

- **WHEN** a check's state is unknown
- **THEN** `doctor` prints it with a leading `? `, and it does not make `doctor` exit 1.

### Requirement: Init requires the coding agent

Lunamill SHALL behave as this line says: When `lunamill init` runs and the coding agent's command isn't installed, init prints `Setting up lunamill for <repository>`, a blank line, then `lunamill runs in a coding agent, and <label> is not installed.`, `Install it and run lunamill init again.`, and `Nothing changed.`, and exits 1. It asks nothing but which repository, where the remotes leave that open, writes no file, and changes no board and no secret.

#### Scenario: Init requires the coding agent

- **WHEN** `lunamill init` runs and the coding agent's command isn't installed
- **THEN** Init prints `Setting up lunamill for <repository>`, a blank line, then `lunamill runs in a coding agent, and <label> is not installed.`, `Install it and run lunamill init again.`, and `Nothing changed.`, and exits 1. It asks nothing but which repository, where the remotes leave that open, writes no file, and changes no board and no secret.

### Requirement: Init asks for the branch name

Lunamill SHALL behave as this line says: When `lunamill init` runs and the settings in effect have no `code-host.branch-name`, it asks `How should a build name its branch? Use {ticket}, and {user} for the GitHub account:` with `{ticket}` filled in, right after the ticket system and the runner are chosen.

#### Scenario: Init asks for the branch name

- **WHEN** `lunamill init` runs and the settings in effect have no `code-host.branch-name`
- **THEN** it asks `How should a build name its branch? Use {ticket}, and {user} for the GitHub account:` with `{ticket}` filled in, right after the ticket system and the runner are chosen.

### Requirement: Init writes the branch name

Lunamill SHALL behave as this line says: When the person answers, `lunamill init` writes a `code-host` block to `.claude/lunamill.yaml` holding `type: github` and `branch-name:` with the answer in double quotes.

#### Scenario: Init writes the branch name

- **WHEN** the person answers
- **THEN** `lunamill init` writes a `code-host` block to `.claude/lunamill.yaml` holding `type: github` and `branch-name:` with the answer in double quotes.

### Requirement: Init refuses a faulty pattern

Lunamill SHALL behave as this line says: When the answer breaks any of lines 4 to 8, `lunamill init` prints that line's reason, the text after `code-host.branch-name: `, and asks again.

#### Scenario: Init refuses a faulty pattern

- **WHEN** the answer breaks any of lines 4 to 8
- **THEN** `lunamill init` prints that line's reason, the text after `code-host.branch-name: `, and asks again.

### Requirement: Init keeps a branch name already set

Lunamill SHALL behave as this line says: When a re-run finds `code-host.branch-name` in the settings in effect, from the file or a preset, `lunamill init` does not ask for it and leaves it as it is.

#### Scenario: Init keeps a branch name already set

- **WHEN** a re-run finds `code-host.branch-name` in the settings in effect, from the file or a preset
- **THEN** `lunamill init` does not ask for it and leaves it as it is.

### Requirement: Init fills in a missing branch name

Lunamill SHALL behave as this line says: When a re-run finds settings whose only faults are a missing `code-host.branch-name` and any states #53 lets init fill in, `lunamill init` does not stop with "Fix it, then run init again.", keeps every other value, and asks line 18's question.

#### Scenario: Init fills in a missing branch name

- **WHEN** a re-run finds settings whose only faults are a missing `code-host.branch-name` and any states #53 lets init fill in
- **THEN** `lunamill init` does not stop with "Fix it, then run init again.", keeps every other value, and asks line 18's question.

### Requirement: Init asks for the spec tool

Lunamill SHALL behave as this line says: When `lunamill init` runs and the settings in effect, from the file or a preset, have no `specs`, it asks `Which spec tool do you use?` right after the branch-name question, or where that question would be when it is not asked, offering `None: each ticket holds its own spec` first and selected, then `OpenSpec: each ticket holds its spec, and each build also keeps it in openspec/specs/`.

#### Scenario: Init asks for the spec tool

- **WHEN** `lunamill init` runs and the settings in effect, from the file or a preset, have no `specs`
- **THEN** it asks `Which spec tool do you use?` right after the branch-name question, or where that question would be when it is not asked, offering `None: each ticket holds its own spec` first and selected, then `OpenSpec: each ticket holds its spec, and each build also keeps it in openspec/specs/`.

### Requirement: Init writes no spec tool

Lunamill SHALL behave as this line says: When the person chooses None, `lunamill init` writes `specs: none` to `.claude/lunamill.yaml`.

#### Scenario: Init writes no spec tool

- **WHEN** the person chooses None
- **THEN** `lunamill init` writes `specs: none` to `.claude/lunamill.yaml`.

### Requirement: Init writes OpenSpec

Lunamill SHALL behave as this line says: When the person chooses OpenSpec, `lunamill init` writes `specs: openspec` to `.claude/lunamill.yaml`.

#### Scenario: Init writes OpenSpec

- **WHEN** the person chooses OpenSpec
- **THEN** `lunamill init` writes `specs: openspec` to `.claude/lunamill.yaml`.

### Requirement: Init keeps a spec tool already set

Lunamill SHALL behave as this line says: When the settings in effect already have `specs`, `lunamill init` does not ask line 17's question and leaves `specs` as it is.

#### Scenario: Init keeps a spec tool already set

- **WHEN** the settings in effect already have `specs`
- **THEN** `lunamill init` does not ask line 17's question and leaves `specs` as it is.

### Requirement: Init plans the spec tool's install

Lunamill SHALL show an `install` row in init's plan, after every row but a `turn off` row and the `pull request` row, when the spec tool the settings name is not installed, as the scenario says.

#### Scenario: Init plans the spec tool's install

- **WHEN** the settings in effect, or line 19's answer, name a spec tool that its adapter says is not installed (for OpenSpec: `package.json` lists `@fission-ai/openspec` in neither `dependencies` nor `devDependencies`)
- **THEN** Init's plan has the row `install`, padded to 12 as the plan's other labels are, then two spaces and the adapter's package and command, for OpenSpec `@fission-ai/openspec, with npm install --save-dev`. The row comes after every other row but any `turn off` row and the `pull request` row.

### Requirement: Init installs the spec tool

Lunamill SHALL behave as this line says: When the person answers yes to "Go ahead?" with line 21's row in the plan, `lunamill init` runs the adapter's install command, for OpenSpec `npm install --save-dev @fission-ai/openspec`, from the repository's root, after writing `package.json` when there was none, and prints `Installed ` and the package, for OpenSpec `Installed @fission-ai/openspec.`

#### Scenario: Init installs the spec tool

- **WHEN** the person answers yes to "Go ahead?" with line 21's row in the plan
- **THEN** `lunamill init` runs the adapter's install command, for OpenSpec `npm install --save-dev @fission-ai/openspec`, from the repository's root, after writing `package.json` when there was none, and prints `Installed ` and the package, for OpenSpec `Installed @fission-ai/openspec.`

### Requirement: Init carries on when the install fails

Lunamill SHALL, when the spec tool's install fails, print the failure and the last five lines of its standard error, carry on with the rest of init, and put the install first under "Left to do", as the scenario says.

#### Scenario: Init carries on when the install fails

- **WHEN** that install exits non-zero
- **THEN** `lunamill init` prints `Could not install ` and the package and a colon, for OpenSpec `Could not install @fission-ai/openspec:`, then the last five lines the command printed on standard error, each indented two spaces, carries on with the rest, and lists `Install ` the tool's name `, which a build writes specs with: ` and the command first under "Left to do", for OpenSpec `Install OpenSpec, which a build writes specs with: npm install --save-dev @fission-ai/openspec`.

### Requirement: Init installs nothing when it is not needed

Lunamill SHALL behave as this line says: When the adapter says its tool is installed, or `specs` is `none`, init's plan has no `install` row and init installs nothing. Lines 17 to 24 are the only change to what `lunamill init` prints and asks with today's tools.

#### Scenario: Init installs nothing when it is not needed

- **WHEN** the adapter says its tool is installed, or `specs` is `none`
- **THEN** Init's plan has no `install` row and init installs nothing. Lines 17 to 24 are the only change to what `lunamill init` prints and asks with today's tools.

### Requirement: A credential of several parts

Lunamill SHALL behave as this line says: When a ticket system's credential has more than one part, `lunamill init` asks for each in the tool's order with the tool's prompt, masked only where the tool says, then checks them together with the tool's check.

#### Scenario: A credential of several parts

- **WHEN** a ticket system's credential has more than one part
- **THEN** `lunamill init` asks for each in the tool's order with the tool's prompt, masked only where the tool says, then checks them together with the tool's check.

### Requirement: A refused credential at setup

Lunamill SHALL behave as this line says: When the ticket system answers the check with `401`, `init` prints the tool's refusal line with REASON, such as `Jira refused that email and token: 401 Unauthorized. Paste another.`, and asks again from the first masked part. Any other failure prints the tool's message, and asks again the same way.

#### Scenario: A refused credential at setup

- **WHEN** the ticket system answers the check with `401`
- **THEN** `init` prints the tool's refusal line with REASON, such as `Jira refused that email and token: 401 Unauthorized. Paste another.`, and asks again from the first masked part. Any other failure prints the tool's message, and asks again the same way.

### Requirement: The plan stores the credential

Lunamill SHALL behave as this line says: When `init` will store a credential kept on the machine, its plan has a `store` row after the tools' `secrets` row: the label, padded to 12, two spaces, and `your LABEL credential on this machine, in PATH`. In a repository a person owns, the row first lists the code host's token and the coding agent's credential that `init` will keep there, as in `your GitHub token and your LABEL credential on this machine, in PATH`.

#### Scenario: The plan stores the credential

- **WHEN** `init` will store a credential kept on the machine
- **THEN** its plan has a `store` row after the tools' `secrets` row: the label, padded to 12, two spaces, and `your LABEL credential on this machine, in PATH`. In a repository a person owns, the row first lists the code host's token and the coding agent's credential that `init` will keep there, as in `your GitHub token and your LABEL credential on this machine, in PATH`.

### Requirement: A pasted credential is stored in both places

Lunamill SHALL behave as this line says: When a credential is pasted on a first setup, `init` stores it under each of its secret names through the runner and in the file, and prints `It belongs to ACCOUNT. Stored as NAMES, and on this machine.`, ACCOUNT being what the tool's check names.

#### Scenario: A pasted credential is stored in both places

- **WHEN** a credential is pasted on a first setup
- **THEN** `init` stores it under each of its secret names through the runner and in the file, and prints `It belongs to ACCOUNT. Stored as NAMES, and on this machine.`, ACCOUNT being what the tool's check names.

### Requirement: A credential copied from this machine

Lunamill SHALL behave as this line says: When the file already holds a credential for the site on a first setup and the tool's check accepts it, `init` stores those values as the repository's secrets with no prompt, and prints `It belongs to ACCOUNT. Stored as NAMES, from this machine.` When the check refuses it, `init` asks as in line 15.

#### Scenario: A credential copied from this machine

- **WHEN** the file already holds a credential for the site on a first setup and the tool's check accepts it
- **THEN** `init` stores those values as the repository's secrets with no prompt, and prints `It belongs to ACCOUNT. Stored as NAMES, from this machine.` When the check refuses it, `init` asks as in line 15.

### Requirement: The file's modes

Lunamill SHALL behave as this line says: When `init` writes the file, the folder is created `700`, or set to `700` when it is looser, the file is `600` before any value is in it, every other entry is kept, and the file is replaced whole, so a failed write leaves the old one.

#### Scenario: The file's modes

- **WHEN** `init` writes the file
- **THEN** the folder is created `700`, or set to `700` when it is looser, the file is `600` before any value is in it, every other entry is kept, and the file is replaced whole, so a failed write leaves the old one.

### Requirement: This machine's row

Lunamill SHALL behave as this line says: When `.claude/lunamill.yaml` exists and the ticket system in use keeps a credential on the machine, `Found` has a `This machine` row reading `LABEL credential for SITE`, `no LABEL credential for SITE`, or `LABEL refused the credential for SITE`. It is the last row of `Found`, but for the tokens' `This machine` row, which follows it in a repository a person owns.

#### Scenario: This machine's row

- **WHEN** `.claude/lunamill.yaml` exists and the ticket system in use keeps a credential on the machine
- **THEN** `Found` has a `This machine` row reading `LABEL credential for SITE`, `no LABEL credential for SITE`, or `LABEL refused the credential for SITE`. It is the last row of `Found`, but for the tokens' `This machine` row, which follows it in a repository a person owns.

### Requirement: An unreadable file stops init

Lunamill SHALL behave as this line says: When the file can be read by others, or is not valid YAML, `init` prints line 4's message, or `PATH is not valid YAML: REASON. Fix or delete it, then run lunamill init again.`, after `Found` and any line under it about the organization, asks nothing more, and exits 1. In a repository a person owns it does so whatever the ticket system, since the tokens are kept in that file.

#### Scenario: An unreadable file stops init

- **WHEN** the file can be read by others, or is not valid YAML
- **THEN** `init` prints line 4's message, or `PATH is not valid YAML: REASON. Fix or delete it, then run lunamill init again.`, after `Found` and any line under it about the organization, asks nothing more, and exits 1. In a repository a person owns it does so whatever the ticket system, since the tokens are kept in that file.

### Requirement: Init asks for this machine's credential

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init asks for this machine's credential

- **WHEN** line 18's row reads missing, or refused for a credential read from the file (one read from the environment is refused with line 6's message, and nothing is asked, since the variables would still win)
- **THEN** `init` asks for the credential after `Found` and any line under it about the organization, before it lists the repository's secrets for the parts, stores it in the file only, prints `It belongs to ACCOUNT. Stored on this machine.`, then asks `Change which parts are on?`, defaulting to no. When a part is left empty, it prints the tool's line for that and `Run lunamill init again to add it.` in place of the stored line, and still asks.

### Requirement: No change to the parts

Lunamill SHALL behave as this line says: When the answer to line 20's question is no, `init` prints `Nothing else changed.` and exits 0, writing nothing else and changing no secret.

#### Scenario: No change to the parts

- **WHEN** the answer to line 20's question is no
- **THEN** `init` prints `Nothing else changed.` and exits 0, writing nothing else and changing no secret.

### Requirement: A change to the parts

Lunamill SHALL behave as this line says: When the answer is yes, `init` carries on from listing the secrets as it does today.

#### Scenario: A change to the parts

- **WHEN** the answer is yes
- **THEN** `init` carries on from listing the secrets as it does today.

### Requirement: Secrets that cannot be listed after this machine's credential

Lunamill SHALL behave as this line says: When `init` cannot list the repository's secrets after line 20, it prints `Could not list the repository's secrets, so the parts are left as they are: REASON` and exits 0.

#### Scenario: Secrets that cannot be listed after this machine's credential

- **WHEN** `init` cannot list the repository's secrets after line 20
- **THEN** it prints `Could not list the repository's secrets, so the parts are left as they are: REASON` and exits 0.

### Requirement: No machine credential with GitHub's tickets

Lunamill SHALL behave as this line says: When the ticket system in use keeps nothing on the machine, as GitHub's does not, `init` prints no `This machine` row for a ticket system's credential and asks no line 20 question. In a repository a person owns, `Found` still has the tokens' `This machine` row, such as `no GitHub token for cloud runs`.

#### Scenario: No machine credential with GitHub's tickets

- **WHEN** the ticket system in use keeps nothing on the machine, as GitHub's does not
- **THEN** `init` prints no `This machine` row for a ticket system's credential and asks no line 20 question. In a repository a person owns, `Found` still has the tokens' `This machine` row, such as `no GitHub token for cloud runs`.

### Requirement: Doctor checks this machine's credential

Lunamill SHALL print, when the ticket system in use keeps a credential on the machine, one `lunamill doctor` line about it under the ticket system's heading: accepted, from the file or the environment, or the failure with its fix.

#### Scenario: Doctor checks this machine's credential

- **WHEN** the ticket system in use keeps a credential on the machine
- **THEN** `lunamill doctor` prints one line about it under the ticket system's heading: `✓ The credential on this machine is accepted, for ACCOUNT`; `✓ The credential in NAMES is accepted, for ACCOUNT` when it came from the environment; or `✗` and the failure, with its fix after it as every `doctor` line has one: `No credential on this machine for SITE. Run lunamill init`; `The credential on this machine is refused (REASON). It may have expired. Run lunamill init`; `The credential in NAMES is refused (REASON). They may have expired: replace them where they are set` when it came from the environment; `The credential on this machine could not be checked (REASON). Check that SITE can be reached. Run lunamill doctor`; `PATH can be read by others. Run chmod 600 PATH`; or `PATH is not valid YAML. Fix or delete it. Run lunamill init`. `doctor` makes this check itself for any such ticket system; the tool's own `checks` do not, and are skipped when the credential is not accepted.

### Requirement: The ticket system opened through the registry

Lunamill SHALL behave as this line says: When a ticket system other than GitHub is registered, as Fake Tickets is in a test, and the settings name it in `tickets.type`, every `lunamill ticket` command, `lunamill status`, the board sync, and `lunamill poller --once` open it through the registry. A poller run with no settings, as one someone hosts, opens the default ticket system.

#### Scenario: The ticket system opened through the registry

- **WHEN** a ticket system other than GitHub is registered, as Fake Tickets is in a test, and the settings name it in `tickets.type`
- **THEN** every `lunamill ticket` command, `lunamill status`, the board sync, and `lunamill poller --once` open it through the registry. A poller run with no settings, as one someone hosts, opens the default ticket system.

### Requirement: Init writes no package.json

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Init writes no package.json

- **WHEN** `lunamill init` runs
- **THEN** `lunamill init` writes no `package.json` and no `.gitignore` line, has no `package.json` row under "Found", and still writes a `package.json` before a spec tool's `npm install`.

### Requirement: The specs that name a workflow file

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The specs that name a workflow file

- **WHEN** a line of a spec this requirement lists names an old workflow file, `npm ci` for Lunamill, or `npx --no-install lunamill`
- **THEN** Each line of `board-poller`, `board-columns`, `board-sync-trigger`, `default-branch`, `labels-setting`, `npm-registry-secrets`, `ticket-keys`, `tool-setup`, and `cli-output` that names an old workflow file, `npm ci` for Lunamill, or `npx --no-install lunamill` names `lunamill.yml` or `lunamill-review.yml`, its job, or `lunamill`. A secret `.npmrc` names still reaches each job that installs or runs a session, and doctor's poller lines name `lunamill.yml`, or `lunamill-poller.yml` for the poller a preset's repository runs.

### Requirement: Signed commits on Lunamill's updates

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Signed commits on Lunamill's updates

- **WHEN** `lunamill init` offers signed commits
- **THEN** `lunamill init` offers signed commits as "Signed commits on Lunamill's updates", and `LUNAMILL_SIGNING_KEY` is read only by the updates' job.

### Requirement: What CI's own token may do

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What CI's own token may do

- **WHEN** `lunamill doctor` or `lunamill init` runs with `pr-review` set
- **THEN** With `pr-review` set, `lunamill doctor` prints `✓ CI's own token can only read, unless a workflow says more`, or `✗ CI's own token can write, so code in a pull request could pass "Review verdict": set it to read, in your repository's Settings, Actions, General, Workflow permissions`, or `? Could not tell what CI's own token may do: ` and the reason, and "Left to do" in `lunamill init` says the same where it can write.

### Requirement: A secret the plan withholds

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A secret the plan withholds

- **WHEN** `lunamill doctor` finds a secret stored for the organization that the plan withholds
- **THEN** The line reads `✗ NAME is stored for ORG, and PLAN does not share it with a private repository: make the repository public, or move ORG to a paid plan`.

### Requirement: A disabled lunamill.yml

Lunamill SHALL behave as this line says: When `lunamill.yml` is disabled on GitHub Actions, `lunamill doctor` fails with `lunamill.yml is disabled` and the fix `Enable it on the Actions tab, or run: gh workflow enable lunamill.yml`, whatever `builds.trigger` is.

#### Scenario: A disabled lunamill.yml

- **WHEN** `lunamill.yml` is disabled on GitHub Actions
- **THEN** `lunamill doctor` fails with `lunamill.yml is disabled` and the fix `Enable it on the Actions tab, or run: gh workflow enable lunamill.yml`, whatever `builds.trigger` is.

### Requirement: An enabled lunamill.yml

Lunamill SHALL behave as this line says: When `lunamill.yml` is enabled on GitHub Actions, `lunamill doctor` prints `✓ lunamill.yml is enabled`, whatever `builds.trigger` is.

#### Scenario: An enabled lunamill.yml

- **WHEN** `lunamill.yml` is enabled on GitHub Actions
- **THEN** `lunamill doctor` prints `✓ lunamill.yml is enabled`, whatever `builds.trigger` is.

### Requirement: A lunamill.yml not on the default branch yet

Lunamill SHALL behave as this line says: When `lunamill.yml` is not on the default branch, `lunamill doctor` prints `- lunamill.yml is not on the default branch yet`, whatever `builds.trigger` is, and fails nothing for it.

#### Scenario: A lunamill.yml not on the default branch yet

- **WHEN** `lunamill.yml` is not on the default branch
- **THEN** `lunamill doctor` prints `- lunamill.yml is not on the default branch yet`, whatever `builds.trigger` is, and fails nothing for it.

### Requirement: A lunamill.yml whose state cannot be read

Lunamill SHALL behave as this line says: When the state of `lunamill.yml` cannot be read, `lunamill doctor` prints `? Could not tell whether lunamill.yml is enabled: REASON`, fails nothing for it, and prints its other checks. REASON is the error in GitHub's words, as doctor's other "Could not tell" lines about the repository give it, such as `Bad Gateway (HTTP 502)`.

#### Scenario: A lunamill.yml whose state cannot be read

- **WHEN** the state of `lunamill.yml` cannot be read
- **THEN** `lunamill doctor` prints `? Could not tell whether lunamill.yml is enabled: REASON`, fails nothing for it, and prints its other checks. REASON is the error in GitHub's words, as doctor's other "Could not tell" lines about the repository give it, such as `Bad Gateway (HTTP 502)`.

### Requirement: A disabled workflow of a preset's poller

Lunamill SHALL behave as this line says: When a preset's repository, OWNER/NAME, runs the poller and its workflow is disabled, `lunamill doctor` fails with `lunamill-poller.yml is disabled in OWNER/NAME` and the fix `Enable it on the Actions tab of OWNER/NAME`.

#### Scenario: A disabled workflow of a preset's poller

- **WHEN** a preset's repository, OWNER/NAME, runs the poller and its workflow is disabled
- **THEN** `lunamill doctor` fails with `lunamill-poller.yml is disabled in OWNER/NAME` and the fix `Enable it on the Actions tab of OWNER/NAME`.

### Requirement: A preset's poller not on the default branch

Lunamill SHALL behave as this line says: When a preset's repository, OWNER/NAME, runs the poller and `lunamill-poller.yml` is not on its default branch, `lunamill doctor` fails with `lunamill-poller.yml is not on the default branch of OWNER/NAME` and the fix `An owner of OWNER runs lunamill init --org again`.

#### Scenario: A preset's poller not on the default branch

- **WHEN** a preset's repository, OWNER/NAME, runs the poller and `lunamill-poller.yml` is not on its default branch
- **THEN** `lunamill doctor` fails with `lunamill-poller.yml is not on the default branch of OWNER/NAME` and the fix `An owner of OWNER runs lunamill init --org again`.

### Requirement: A re-run names the settings file once

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A re-run names the settings file once

- **WHEN** `lunamill init` runs where `.claude/lunamill.yaml` has a value that is not valid
- **THEN** it prints the line `lunamill config check` prints, with the file named once, then `Fix it, then run init again.`, and exits 1. What lets init fill in a missing branch name or columns is unchanged.

### Requirement: A re-run on a file that is not YAML

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A re-run on a file that is not YAML

- **WHEN** `.claude/lunamill.yaml` is not YAML
- **THEN** `lunamill init` prints what `lunamill sync` prints for it, then `Fix it, then run init again.`, exits 1, and looks at nothing else first.

### Requirement: A re-run where a pinned preset is not valid

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A re-run where a pinned preset is not valid

- **WHEN** a preset that `.claude/lunamill.yaml` lists is pinned, and the preset or the settings combined with it are not valid
- **THEN** `lunamill init` prints the line `lunamill config check` prints, then `Fix it, then run init again.`, and exits 1. A preset that is listed and not pinned is handled as today.

### Requirement: Doctor gives the Claude token's day

Lunamill SHALL behave as this line says: When `lunamill doctor` prints `CLAUDE_CODE_OAUTH_TOKEN is set` or `CLAUDE_CODE_OAUTH_TOKEN is set by the organization`, for a part or for the approval policies' agents, it prints one more line under the runner's heading, right after that one, saying the day it stops working.

#### Scenario: Doctor gives the Claude token's day

- **WHEN** `lunamill doctor` prints `CLAUDE_CODE_OAUTH_TOKEN is set` or `CLAUDE_CODE_OAUTH_TOKEN is set by the organization`
- **THEN** it prints one more line under the runner's heading, right after that one, saying the day it stops working. DAY and STORED are `YYYY-MM-DD`, ORG the repository's or organization's owner, and WHEN the whole days from today to DAY, printed `in 1 day`, `in N days`, or `today` for 0. The Claude token's day is a year after the date line 2 names.

### Requirement: The date the token's day counts from

Lunamill SHALL behave as this line says: The date it counts from is the secret's `updated_at` in the repository's list, or, for a secret only the organization sets, in the organization's list of secrets shared with the repository. In a repository a person owns, when the credentials file holds a `pasted` day under `claude-code` for the repository's owner and it is earlier, that day counts instead.

#### Scenario: The date the token's day counts from

- **WHEN** `lunamill doctor` works out the Claude token's day
- **THEN** the date it counts from is the secret's `updated_at` in the repository's list, or, for a secret only the organization sets, in the organization's list of secrets shared with the repository. In a repository a person owns, when the credentials file holds a `pasted` day under `claude-code` for the repository's owner and it is earlier, that day counts instead.

### Requirement: The token's day more than 30 days off

Lunamill SHALL behave as this line says: More than 30 days before DAY, the line is `✓ CLAUDE_CODE_OAUTH_TOKEN stops working by DAY, a year after it was stored`, ending `a year after you pasted it` when the file's day counted, or `a year after ORG stored it` for the organization's.

#### Scenario: The token's day more than 30 days off

- **WHEN** the Claude token's day is more than 30 days away
- **THEN** the line is `✓ CLAUDE_CODE_OAUTH_TOKEN stops working by DAY, a year after it was stored`, ending `a year after you pasted it` when the file's day counted, or `a year after ORG stored it` for the organization's.

### Requirement: The token's day within 30 days

Lunamill SHALL behave as this line says: From 30 days before DAY through DAY, the line is `? CLAUDE_CODE_OAUTH_TOKEN stops working by DAY, WHEN, a year after it was stored. Run lunamill init to replace it`, with line 3's other two endings, and for the organization's ending `a year after ORG stored it. An owner of ORG runs lunamill init --org to replace it`. It does not change `doctor`'s exit status.

#### Scenario: The token's day within 30 days

- **WHEN** the Claude token's day is 30 days or fewer away, or today
- **THEN** the line is `? CLAUDE_CODE_OAUTH_TOKEN stops working by DAY, WHEN, a year after it was stored. Run lunamill init to replace it`, with line 3's other two endings, and for the organization's ending `a year after ORG stored it. An owner of ORG runs lunamill init --org to replace it`. It does not change `doctor`'s exit status.

### Requirement: The token's day passed

Lunamill SHALL behave as this line says: After DAY, the line is `✗ CLAUDE_CODE_OAUTH_TOKEN stopped working by DAY, a year after it was stored. Run lunamill init`, with line 3's other endings, and for the organization's `✗ CLAUDE_CODE_OAUTH_TOKEN stopped working by DAY, a year after ORG stored it: an owner of ORG runs lunamill init --org`. `doctor` exits 1.

#### Scenario: The token's day passed

- **WHEN** the Claude token's day has passed
- **THEN** the line is `✗ CLAUDE_CODE_OAUTH_TOKEN stopped working by DAY, a year after it was stored. Run lunamill init`, with line 3's other endings, and for the organization's `✗ CLAUDE_CODE_OAUTH_TOKEN stopped working by DAY, a year after ORG stored it: an owner of ORG runs lunamill init --org`. `doctor` exits 1.

### Requirement: No day line without the token's set line

Lunamill SHALL behave as this line says: When `doctor` prints no such `is set` line, as when `ANTHROPIC_API_KEY` is the name set, the secrets cannot be listed, nothing reads the credential, or the organization's copy does not reach a private repository, it prints no line about the token's day.

#### Scenario: No day line without the token's set line

- **WHEN** `doctor` prints no `CLAUDE_CODE_OAUTH_TOKEN is set` line
- **THEN** it prints no line about the token's day, as when `ANTHROPIC_API_KEY` is the name set, the secrets cannot be listed, nothing reads the credential, or the organization's copy does not reach a private repository.

### Requirement: Doctor gives the GitHub access token's day

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Doctor gives the GitHub access token's day

- **WHEN** in a repository a person owns, the credentials file holds the GitHub access token for the repository's owner with an `expires` day, and NAMES is not empty
- **THEN** `lunamill doctor` prints one more line under the runner's heading, after the last `is set` line of the token's secrets. DAY, STORED, and PASTED are `YYYY-MM-DD` in UTC. WHEN is the whole days from today to DAY, printed `in 1 day`, `in N days`, or `today` for 0, as #81 prints it. The token's secrets are the names `lunamill init`'s step for the token stores it under for the parts on, of `LUNAMILL_BOARD_TOKEN`, `LUNAMILL_BUILD_TOKEN`, and `LUNAMILL_AUTOMERGE_TOKEN`; one set but read by no part, such as `LUNAMILL_BUILD_TOKEN` beside a board, is not one. NAMES are the token's secrets that are set on the repository and hold the machine's token, joined as `A`, `A and B`, or `A, B, and C`. OLDER are those set on the repository that do not, joined the same way, with `is` for one and `are` for more. A secret holds the machine's token when its `updated_at` day is on or after the file's `pasted` day for the token, or when the file has no `pasted` day for it.

### Requirement: The access token's day more than 30 days off

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The access token's day more than 30 days off

- **WHEN** the GitHub access token's day is more than 30 days away, or it has `expires: never`
- **THEN** the line is `✓ The GitHub access token in NAMES expires on DAY`, and with `expires: never` it is `✓ The GitHub access token in NAMES has no expiry date`.

### Requirement: The access token's day within 30 days

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The access token's day within 30 days

- **WHEN** the GitHub access token's day is 30 days or fewer away, or today
- **THEN** the line is `? The GitHub access token in NAMES expires on DAY, WHEN. Run lunamill init to replace it`, and it does not change `doctor`'s exit status.

### Requirement: The access token's day passed

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The access token's day passed

- **WHEN** the GitHub access token's day has passed
- **THEN** the line is `✗ The GitHub access token in NAMES expired on DAY. Run lunamill init`, and `doctor` exits 1.

### Requirement: Secrets older than the access token on the machine

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Secrets older than the access token on the machine

- **WHEN** the file holds the GitHub access token for the owner and OLDER is not empty
- **THEN** `doctor` prints, after the same `is set` lines and line 1's line, `? OLDER here is older than the GitHub access token on this machine. Run lunamill init to store that one in its place` (`are older` for more than one), which does not change its exit status. When the machine's token is itself 30 days or fewer from its DAY, or past it, the line ends `Run lunamill init to replace it` instead, since `lunamill init` then makes a new one (lines 13 and 16).

### Requirement: No access token line

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: No access token line

- **WHEN** the repository is an organization's, the file holds no GitHub access token for the owner, the secrets cannot be listed, or the file holds no `expires` day for the token
- **THEN** `doctor` prints neither line in the first three cases, and with no `expires` day it prints the older secrets' line and not the day's.

### Requirement: Init writes version 1

Lunamill SHALL behave as this line says: When `lunamill init` or `lunamill init --org` writes a settings file that has no `version`, it writes `version: 1`, and the lock it writes records `version: 1`.

#### Scenario: Init writes version 1

- **WHEN** `lunamill init` or `lunamill init --org` writes a settings file that has no `version`
- **THEN** it writes `version: 1`, and the lock it writes records `version: 1`.
