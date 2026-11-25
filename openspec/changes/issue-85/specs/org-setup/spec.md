## ADDED Requirements

### Requirement: A branch name it refuses

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A branch name it refuses

- **WHEN** the answer is a pattern `factory config check` refuses
- **THEN** it prints the reason in that check's words, without the key, and asks again.

### Requirement: The README's line on the preset

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The README's line on the preset

- **WHEN** it writes `README.md` in `factory-config`
- **THEN** the line about the preset says it is ORG's preset: the ticket system, the board, its columns, and how builds name their branches.

### Requirement: A preset that is already there

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A preset that is already there

- **WHEN** `factory-config` already holds `factory-preset.yaml`
- **THEN** it prints neither line and asks nothing about branches, and leaves the preset as it is, whether or not the preset names a pattern.

## MODIFIED Requirements

### Requirement: The questions it asks

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The questions it asks

- **WHEN** `factory init --org ADDRESS` asks its questions
- **THEN** It asks which board: a new one first, then each of ORG's Projects. When it will write the preset, because `factory-config` does not exist or holds no `factory-preset.yaml`, it then prints `Every repository that follows the preset names its branches this way, unless its own settings say otherwise.` and `{user} is the developer's account in a build on their machine, and the app's name in a build in the cloud.`, and asks `How should a build name its branch? Use {ticket}, and {user} for the GitHub account:` with `{ticket}` as the answer Enter gives, after the questions about an existing board's columns and before what pays for sessions in the cloud. It asks what pays for sessions in the cloud, as the coding agent's own setup step does today. When `factory-config` will be private, it asks how often the poller reads the board, with today's intervals and 30 first.

### Requirement: The factory-config repository

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The factory-config repository

- **WHEN** `factory init --org ADDRESS` comes to `ORG/factory-config`
- **THEN** It creates `ORG/factory-config` with the three files "What `factory init --org` creates" shows: private, or public on GitHub Free. The preset holds the board's number, the column chosen for each of the six states, a `code-host` block between `tickets` and `pr-review`, with `type`, the code host ADDRESS names, and `branch-name`, the answer in double quotes, `pr-review`, `builds.trigger: github-action`, and `builds.poll-minutes` when it is not 5. With no interval asked, that is 5 and the cron is `*/5 * * * *`. The workflow file names the installed factory's version. In a repository of that name that already exists, a file that is there is left as it is, and one that is missing is written.
