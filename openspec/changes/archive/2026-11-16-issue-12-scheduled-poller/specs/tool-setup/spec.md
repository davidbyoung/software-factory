## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Init is unchanged with today's tools

`factory init` SHALL print the same lines and ask the same questions, in
the same order, as before this change when it runs with GitHub, GitHub
Issues, GitHub Actions, and Claude Code, except for the part "Builds that start when you move a card to Ready", whose questions and steps the requirements below describe.

#### Scenario: Init is unchanged with today's tools

- **WHEN** `factory init` runs with GitHub, GitHub Issues, GitHub Actions, and Claude Code
- **THEN** it prints the same lines and asks the same questions, in the same order, as before this change. This holds for a first run with every part chosen, a re-run with every part on and every secret set, and each case the existing tests in `tests/init.test.ts` cover, except the one edge under Decisions. An existing test of the old behavior there takes 1.3's expectation. The `Checks` that `init` ends with also show line 25's configuration lines. The part "Builds that start when you move a card to Ready" is the exception: its question, its interval, its description, and its step in "Left to do" are as the requirements added with issue 12 say.
