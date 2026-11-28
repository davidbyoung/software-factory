# org-setup Specification

## Purpose

What `lunamill init --org ADDRESS` does, once, for an organization: what stops it, what it asks and plans, the board, the `lunamill-config` repository, the GitHub App, the secrets, and the rule it sets up, and what it does when it is run again or a step fails.

## Requirements

### Requirement: What stops it before it asks

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What stops it before it asks

- **WHEN** `lunamill init --org ADDRESS` runs
- **THEN** it reads no git remote and needs no repository. It stops with the line "Priya sets the organization up, once" shows, and `Nothing changed.`, for: a word that is no address, a host that is not `github.com`, a personal account, and an account that is not an owner. An address is `https://HOST/NAME`, with or without a last `/`; any other on `github.com` gets `✗ ADDRESS is not an organization's address. Give one such as https://github.com/acme.` One GitHub has no organization for gets the line "before it asks" shows. It stops as `lunamill init` does with no terminal, no coding agent, or no sign-in.

### Requirement: A sign-in that lacks a permission

Lunamill SHALL behave as this line says: When the GitHub CLI's sign-in lacks `admin:org` or `project`, it asks the question "before it asks" shows, naming what is missing, before any other question. On yes it runs `gh auth refresh` with them, and on no it changes nothing.

#### Scenario: A sign-in that lacks a permission

- **WHEN** the GitHub CLI's sign-in lacks `admin:org` or `project`
- **THEN** it asks the question "before it asks" shows, naming what is missing, before any other question. On yes it runs `gh auth refresh` with them, and on no it changes nothing.

### Requirement: The rows under Found

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The rows under Found

- **WHEN** `lunamill init --org ADDRESS` prints what it found
- **THEN** Under "Found" it prints the rows the draft shows, with `Tickets` as a row while Lunamill has one ticket system and as a question once it has two, and a `Plan` row on GitHub Free only.

### Requirement: The questions it asks

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The questions it asks

- **WHEN** `lunamill init --org ADDRESS` asks its questions
- **THEN** It asks which board: a new one first, then each of ORG's Projects. When it will write the preset, because `lunamill-config` does not exist or holds no `lunamill-preset.yaml`, it then prints `Every repository that follows the preset names its branches this way, unless its own settings say otherwise.` and `{user} is the developer's account in a build on their machine, and the app's name in a build in the cloud.`, and asks `How should a build name its branch? Use {ticket}, and {user} for the GitHub account:` with `{ticket}` as the answer Enter gives, after the questions about an existing board's columns and before what pays for sessions in the cloud. It asks what pays for sessions in the cloud, as the coding agent's own setup step does today. When `lunamill-config` will be private, it asks how often the poller reads the board, with today's intervals and 30 first.

### Requirement: The plan

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The plan

- **WHEN** `lunamill init --org ADDRESS` prints its plan
- **THEN** Its plan has the rows `app`, `secrets`, `preset`, `rule`, and `board`, as the draft shows, less any already done, and "Go ahead?" defaults to no.

### Requirement: The board

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The board

- **WHEN** `lunamill init --org ADDRESS` sets up the board she chose, a new one or one the organization has
- **THEN** It creates a new board with Lunamill's columns and fields, and prints the draft's ✓ line. An existing board keeps its own columns: before the plan it reads them, and where the board lacks one of Lunamill's six, the coding agent suggests which of its columns shows each state, with the questions and the table `lunamill init` has; where it has all six it asks nothing. The plan's `board` row names each column and field it will add, or reads `Use board N as it is`. After "Go ahead?" it adds only the columns the chosen names still lack and Lunamill's fields the board lacks, prints `Added to board N: ` and their names, and prints nothing when it added none. A suggestion that fails, takes too long, or cannot be used does not stop it: it prints `<label>'s answer could not be used: <reason>.` and `Choose the column for each state yourself.`, asks `Which column shows <state>?` for each of the six states, offering each of the board's columns, Lunamill's own column where the board lacks it, and no column where a state may have none, then shows the table and asks `Use these columns?` with `Yes` and `Change some`. The preset and the plan follow from those answers as from a suggestion.

### Requirement: The lunamill-config repository

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The lunamill-config repository

- **WHEN** `lunamill init --org ADDRESS` comes to `ORG/lunamill-config`
- **THEN** It creates `ORG/lunamill-config` with the three files "What `lunamill init --org` creates" shows: private, or public on GitHub Free. The preset holds the board's number, the column chosen for each of the six states, a `code-host` block between `tickets` and `pr-review`, with `type`, the code host ADDRESS names, and `branch-name`, the answer in double quotes, `pr-review`, `builds.trigger: github-action`, and `builds.poll-minutes` when it is not 5. With no interval asked, that is 5 and the cron is `*/5 * * * *`. The workflow file names the installed Lunamill's version. In a repository of that name that already exists, a file that is there is left as it is, and one that is missing is written.

### Requirement: Registering the App

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Registering the App

- **WHEN** `lunamill init --org ADDRESS` comes to the App
- **THEN** It registers the App from a manifest: named `lunamill for ORG`, private to ORG, with no webhook, and with the permissions "What registering the App involves" lists. It opens the browser on a page of its own that sends the form to GitHub, prints the two lines "before it asks" shows, and takes the code from GitHub's redirect to `127.0.0.1` or from a pasted address, whichever comes first, waiting until one arrives or she stops it.

### Requirement: The App's client ID and key

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The App's client ID and key

- **WHEN** GitHub hands over the App's client ID and key
- **THEN** It stores the App's client ID as the variable `LUNAMILL_APP_CLIENT_ID` and its key as the secret `LUNAMILL_APP_PRIVATE_KEY` for ORG as soon as it has them, each reaching every repository of ORG, as every secret it stores does. It writes the key to no file, then sends the browser to the App's install page.

### Requirement: Waiting for the install

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Waiting for the install

- **WHEN** `lunamill init --org ADDRESS` waits for the App's installation
- **THEN** It looks for the installation every 3 seconds, for up to 10 minutes, then fails as line 15 says with `✗ Could not see the app installed after 10 minutes.` When the install is done, it prints `✓ Installed the app on N repositories.`, with the count GitHub gives for the installation. An install that leaves out `lunamill-config` gets the two lines "before it asks" shows, and exit 1.

### Requirement: The coding agent's credential

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The coding agent's credential

- **WHEN** `lunamill init --org ADDRESS` comes to the coding agent's credential
- **THEN** It runs the coding agent's token step as `lunamill init` does, stores the result for ORG, as `CLAUDE_CODE_OAUTH_TOKEN` or, for an API key, `ANTHROPIC_API_KEY`, and prints `✓ Stored N secrets and 1 variable for ORG.`, counting what this run stored. A token left empty gets today's line, with `lunamill init --org ADDRESS` as the command to run again. A pasted value is checked before it is stored: one that does not start `sk-ant-oat` where the token is asked for, or `sk-ant-api` where an API key is, is refused and asked for again. The refusal prints no part of the value. A value of the right shape is then tried before it is stored: it prints `Trying the token...`, or `Trying the API key...`, and asks Claude Code one small thing with the value in the command's environment, never in an argument. One Claude Code refuses is not stored: it prints `Claude Code refused that token: REASON. If it was printed over two lines, copy both, then paste it again.` and asks again. When the try cannot run, as when it takes too long or Claude Code is not installed, the value is stored and it prints `Could not try the token (REASON), so it is stored untried.` It says a value with a `#` is the code the browser gave for `claude setup-token`, and for a token or a key pasted at the other's prompt, which it is and the choice it belongs to.

### Requirement: The property and the rule

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The property and the rule

- **WHEN** `lunamill init --org ADDRESS` comes to the rule
- **THEN** Where ORG's plan has organization-wide rules, it defines the property `lunamill` for ORG's repositories, with the values `on` and `off`, and an organization rule named "lunamill" that requires "Review verdict", posted by GitHub Actions, before a merge to the default branch of each repository where the property is `on`. It prints the draft's ✓ line. On GitHub Free, or when GitHub refuses the rule, it prints the `- rule` line and carries on: the App cannot make a repository's rule, so an admin of each repository does, as lines 46 and 49 say.

### Requirement: The last line

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The last line

- **WHEN** `lunamill init --org ADDRESS` has done every step
- **THEN** It ends `✓ ORG is set up.`, then the steps a developer takes in each repository, with a third for the repository's admin where no organization-wide rule was made, then the addresses of the preset and of the docs' steps, and exits 0.

### Requirement: Run again

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Run again

- **WHEN** `lunamill init --org ADDRESS` runs again for the same organization
- **THEN** Run again, it prints what it found as "run again" shows, with `on the repositories you chose` for an install on some, does only what is missing, and asks whether to replace the Claude credential. With nothing to do it prints `✓ ORG is set up. Nothing to do.` With the variable set and no installation of that client ID, it prints the line "before it asks" shows, opens that page, waits as line 10 says, and prints `✓ Installed the app.`

### Requirement: A step that fails

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A step that fails

- **WHEN** a step of `lunamill init --org ADDRESS` fails
- **THEN** A step that fails prints `✗ Could not` and what it could not do, with the code host's reason, then `Run lunamill init --org ADDRESS again: it carries on from here.`, and exits 1.

### Requirement: A branch name it refuses

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A branch name it refuses

- **WHEN** the answer is a pattern `lunamill config check` refuses
- **THEN** it prints the reason in that check's words, without the key, and asks again.

### Requirement: The README's line on the preset

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The README's line on the preset

- **WHEN** it writes `README.md` in `lunamill-config`
- **THEN** the line about the preset says it is ORG's preset: the ticket system, the board, its columns, and how builds name their branches.

### Requirement: A preset that is already there

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset that is already there

- **WHEN** `lunamill-config` already holds `lunamill-preset.yaml`
- **THEN** it prints neither line and asks nothing about branches, and leaves the preset as it is, whether or not the preset names a pattern.

### Requirement: An organization's preset that is not valid

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An organization's preset that is not valid

- **WHEN** `lunamill init --org` finds a `lunamill-preset.yaml` in the organization's `lunamill-config` with a fault "Preset check refuses a value that is not valid", "A preset in the older version", or "A preset's file that is not YAML" describes, or one only a preset has
- **THEN** it prints `lunamill-preset.yaml: ` and the same words, then `Fix it, then run init again.`, asks nothing, changes nothing, and exits 1.

### Requirement: The Claude token's day when run again

Lunamill SHALL behave as this line says: When `lunamill init --org` finds `CLAUDE_CODE_OAUTH_TOKEN` stored for the organization and its DAY, a year after its `updated_at` in the organization's own list of secrets, is more than 30 days away, the question reads `CLAUDE_CODE_OAUTH_TOKEN is already stored for ORG, and works until DAY. Replace it? Only if it has been revoked. Press Enter for no:`, with no as its default.

#### Scenario: The Claude token's day when run again

- **WHEN** `lunamill init --org` finds `CLAUDE_CODE_OAUTH_TOKEN` stored for the organization and its DAY is more than 30 days away
- **THEN** the question reads `CLAUDE_CODE_OAUTH_TOKEN is already stored for ORG, and works until DAY. Replace it? Only if it has been revoked. Press Enter for no:`, with no as its default.

### Requirement: Replacing a near Claude token

Lunamill SHALL behave as this line says: When DAY is 30 days or fewer away, or past, it prints `CLAUDE_CODE_OAUTH_TOKEN, stored for ORG on STORED, stops working by DAY, WHEN.`, or `stopped working by DAY.` after it, then asks `Replace it now? Press Enter for yes:`, with yes as its default.

#### Scenario: Replacing a near Claude token

- **WHEN** `lunamill init --org` finds `CLAUDE_CODE_OAUTH_TOKEN` stored for the organization and its DAY is 30 days or fewer away, or past
- **THEN** it prints `CLAUDE_CODE_OAUTH_TOKEN, stored for ORG on STORED, stops working by DAY, WHEN.`, or `stopped working by DAY.` after it, then asks `Replace it now? Press Enter for yes:`, with yes as its default.

### Requirement: An API key in place of the token

Lunamill SHALL behave as this line says: With `ANTHROPIC_API_KEY` stored in its place, the question is today's.

#### Scenario: An API key in place of the token

- **WHEN** `lunamill init --org` finds `ANTHROPIC_API_KEY` stored in place of `CLAUDE_CODE_OAUTH_TOKEN`
- **THEN** the question is today's.

### Requirement: The organization's steps in full

Lunamill SHALL behave as this line says: When `lunamill init --org` ends, the line after `The steps in full:` is the address of "What each developer does next" in `docs/setup/organization.md` at the installed release.

#### Scenario: The organization's steps in full

- **WHEN** `lunamill init --org` ends
- **THEN** The line after `The steps in full:` is the address of "What each developer does next" in `docs/setup/organization.md` at the installed release.
