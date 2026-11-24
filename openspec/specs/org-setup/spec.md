# org-setup Specification

## Purpose

What `factory init --org ADDRESS` does, once, for an organization: what stops it, what it asks and plans, the board, the `factory-config` repository, the GitHub App, the secrets, and the rule it sets up, and what it does when it is run again or a step fails.

## Requirements

### Requirement: What stops it before it asks

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What stops it before it asks

- **WHEN** `factory init --org ADDRESS` runs
- **THEN** it reads no git remote and needs no repository. It stops with the line "Priya sets the organization up, once" shows, and `Nothing changed.`, for: a word that is no address, a host that is not `github.com`, a personal account, and an account that is not an owner. An address is `https://HOST/NAME`, with or without a last `/`; any other on `github.com` gets `✗ ADDRESS is not an organization's address. Give one such as https://github.com/acme.` One GitHub has no organization for gets the line "before it asks" shows. It stops as `factory init` does with no terminal, no coding agent, or no sign-in.

### Requirement: A sign-in that lacks a permission

The factory SHALL behave as this line says: When the GitHub CLI's sign-in lacks `admin:org` or `project`, it asks the question "before it asks" shows, naming what is missing, before any other question. On yes it runs `gh auth refresh` with them, and on no it changes nothing.

#### Scenario: A sign-in that lacks a permission

- **WHEN** the GitHub CLI's sign-in lacks `admin:org` or `project`
- **THEN** it asks the question "before it asks" shows, naming what is missing, before any other question. On yes it runs `gh auth refresh` with them, and on no it changes nothing.

### Requirement: The rows under Found

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The rows under Found

- **WHEN** `factory init --org ADDRESS` prints what it found
- **THEN** Under "Found" it prints the rows the draft shows, with `Tickets` as a row while the factory has one ticket system and as a question once it has two, and a `Plan` row on GitHub Free only.

### Requirement: The questions it asks

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The questions it asks

- **WHEN** `factory init --org ADDRESS` asks its questions
- **THEN** It asks which board: a new one first, then each of ORG's Projects. It asks what pays for sessions in the cloud, as the coding agent's own setup step does today. When `factory-config` will be private, it asks how often the poller reads the board, with today's intervals and 30 first.

### Requirement: The plan

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The plan

- **WHEN** `factory init --org ADDRESS` prints its plan
- **THEN** Its plan has the rows `app`, `secrets`, `preset`, `rule`, and `board`, as the draft shows, less any already done, and "Go ahead?" defaults to no.

### Requirement: The board

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The board

- **WHEN** `factory init --org ADDRESS` sets up the board she chose, a new one or one the organization has
- **THEN** It creates a new board with the factory's columns and fields, and prints the draft's ✓ line. An existing board keeps its own columns: before the plan it reads them, and where the board lacks one of the factory's six, the coding agent suggests which of its columns shows each state, with the questions and the table `factory init` has; where it has all six it asks nothing. The plan's `board` row names each column and field it will add, or reads `Use board N as it is`. After "Go ahead?" it adds only the columns the chosen names still lack and the factory's fields the board lacks, prints `Added to board N: ` and their names, and prints nothing when it added none. A suggestion that fails, takes too long, or cannot be used does not stop it: it prints `<label>'s answer could not be used: <reason>.` and `Choose the column for each state yourself.`, asks `Which column shows <state>?` for each of the six states, offering each of the board's columns, the factory's own column where the board lacks it, and no column where a state may have none, then shows the table and asks `Use these columns?` with `Yes` and `Change some`. The preset and the plan follow from those answers as from a suggestion.

### Requirement: The factory-config repository

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The factory-config repository

- **WHEN** `factory init --org ADDRESS` comes to `ORG/factory-config`
- **THEN** It creates `ORG/factory-config` with the three files "What `factory init --org` creates" shows: private, or public on GitHub Free. The preset holds the board's number, the column chosen for each of the six states, `pr-review`, `builds.trigger: github-action`, and `builds.poll-minutes` when it is not 5. With no interval asked, that is 5 and the cron is `*/5 * * * *`. The workflow file names the installed factory's version. In a repository of that name that already exists, a file that is there is left as it is, and one that is missing is written.

### Requirement: Registering the App

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Registering the App

- **WHEN** `factory init --org ADDRESS` comes to the App
- **THEN** It registers the App from a manifest: named `Software Factory for ORG`, private to ORG, with no webhook, and with the permissions "What registering the App involves" lists. It opens the browser on a page of its own that sends the form to GitHub, prints the two lines "before it asks" shows, and takes the code from GitHub's redirect to `127.0.0.1` or from a pasted address, whichever comes first, waiting until one arrives or she stops it.

### Requirement: The App's client ID and key

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The App's client ID and key

- **WHEN** GitHub hands over the App's client ID and key
- **THEN** It stores the App's client ID as the variable `FACTORY_APP_CLIENT_ID` and its key as the secret `FACTORY_APP_PRIVATE_KEY` for ORG as soon as it has them, each reaching every repository of ORG, as every secret it stores does. It writes the key to no file, then sends the browser to the App's install page.

### Requirement: Waiting for the install

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Waiting for the install

- **WHEN** `factory init --org ADDRESS` waits for the App's installation
- **THEN** It looks for the installation every 3 seconds, for up to 10 minutes, then fails as line 15 says with `✗ Could not see the app installed after 10 minutes.` When the install is done, it prints `✓ Installed the app on N repositories.`, with the count GitHub gives for the installation. An install that leaves out `factory-config` gets the two lines "before it asks" shows, and exit 1.

### Requirement: The coding agent's credential

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The coding agent's credential

- **WHEN** `factory init --org ADDRESS` comes to the coding agent's credential
- **THEN** It runs the coding agent's token step as `factory init` does, stores the result for ORG, as `CLAUDE_CODE_OAUTH_TOKEN` or, for an API key, `ANTHROPIC_API_KEY`, and prints `✓ Stored N secrets and 1 variable for ORG.`, counting what this run stored. A token left empty gets today's line, with `factory init --org ADDRESS` as the command to run again. A pasted value is checked before it is stored: one that does not start `sk-ant-oat` where the token is asked for, or `sk-ant-api` where an API key is, is refused and asked for again. The refusal prints no part of the value. A value of the right shape is then tried before it is stored: it prints `Trying the token...`, or `Trying the API key...`, and asks Claude Code one small thing with the value in the command's environment, never in an argument. One Claude Code refuses is not stored: it prints `Claude Code refused that token: REASON. If it was printed over two lines, copy both, then paste it again.` and asks again. When the try cannot run, as when it takes too long or Claude Code is not installed, the value is stored and it prints `Could not try the token (REASON), so it is stored untried.` It says a value with a `#` is the code the browser gave for `claude setup-token`, and for a token or a key pasted at the other's prompt, which it is and the choice it belongs to.

### Requirement: The property and the rule

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The property and the rule

- **WHEN** `factory init --org ADDRESS` comes to the rule
- **THEN** Where ORG's plan has organization-wide rules, it defines the property `software-factory` for ORG's repositories, with the values `on` and `off`, and an organization rule named "Software factory" that requires "Review verdict", posted by GitHub Actions, before a merge to the default branch of each repository where the property is `on`. It prints the draft's ✓ line. On GitHub Free, or when GitHub refuses the rule, it prints the `- rule` line and carries on: the App cannot make a repository's rule, so an admin of each repository does, as lines 46 and 49 say.

### Requirement: The last line

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The last line

- **WHEN** `factory init --org ADDRESS` has done every step
- **THEN** It ends `✓ ORG is set up.`, then the steps a developer takes in each repository, with a third for the repository's admin where no organization-wide rule was made, then the addresses of the preset and of the docs' steps, and exits 0.

### Requirement: Run again

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Run again

- **WHEN** `factory init --org ADDRESS` runs again for the same organization
- **THEN** Run again, it prints what it found as "run again" shows, with `on the repositories you chose` for an install on some, does only what is missing, and asks whether to replace the Claude credential. With nothing to do it prints `✓ ORG is set up. Nothing to do.` With the variable set and no installation of that client ID, it prints the line "before it asks" shows, opens that page, waits as line 10 says, and prints `✓ Installed the app.`

### Requirement: A step that fails

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A step that fails

- **WHEN** a step of `factory init --org ADDRESS` fails
- **THEN** A step that fails prints `✗ Could not` and what it could not do, with the code host's reason, then `Run factory init --org ADDRESS again: it carries on from here.`, and exits 1.
