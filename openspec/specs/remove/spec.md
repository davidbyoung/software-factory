# remove Specification

## Purpose

What `kodor remove` deletes and changes in a repository, what it keeps, and what it leaves for you to remove by hand outside it.

## Requirements

### Requirement: Remove shows its plan first

`kodor remove` SHALL print every file it will delete or change and ask
before changing anything.

#### Scenario: Remove shows its plan first

- **WHEN** `kodor remove` runs
- **THEN** it prints every file it will delete or change in the repository, and then asks "Go ahead?". Answered no, it prints "Nothing changed." and changes nothing.

### Requirement: kodor's files are deleted

`kodor remove` SHALL delete kodor's files when told to go ahead.

#### Scenario: kodor's files are deleted

- **WHEN** going ahead
- **THEN** it deletes `.claude/kodor.yaml`, `.claude/kodor.lock`, `.claude/kodor/`, every `.claude/skills/kodor-*/` and `.claude/agents/kodor-*.md`, `.github/workflows/kodor.yml` and every `.github/workflows/kodor-*.yml`, and `.github/kodor-review.md`.

### Requirement: kodor's hooks and import line are removed

`kodor remove` SHALL take kodor's hook entries and import line out
of files it shares with the user, keeping the rest.

#### Scenario: kodor's hooks and import line are removed

- **WHEN** going ahead
- **THEN** it removes kodor's hook entries from `.claude/settings.json`, keeping every other key and entry, and kodor's import line from `CLAUDE.md`, keeping every other line.

### Requirement: What remove leaves

`kodor remove` SHALL leave files that are the user's.

#### Scenario: What remove leaves

- **WHEN** it removes kodor
- **THEN** it leaves `.github/review-notes.md`, `attribution` in `.claude/settings.json`, `package.json`, `package-lock.json`, `node_modules/` in `.gitignore`, and every skill, agent, and workflow not named `kodor-`.

### Requirement: Another tool's leftovers

`kodor remove` SHALL print the leftover lines of whichever tools are in
use.

#### Scenario: Another tool's leftovers

- **WHEN** a tool in use is the test fake
- **THEN** its own leftover line is printed among them.

### Requirement: Nothing to remove

`kodor remove` SHALL say so and exit 0 when nothing of kodor's is
in the repository.

#### Scenario: Nothing to remove

- **WHEN** none of the files or lines in lines 16 and 17 is in the repository
- **THEN** `remove` prints "Nothing of kodor's is here." and exits 0.

### Requirement: A removal half done

`kodor remove` SHALL remove whatever of kodor's is left.

#### Scenario: A removal half done

- **WHEN** only some of them are there, as after a removal half done by hand
- **THEN** `remove` lists and removes those, and goes on as in line 19.

### Requirement: Settings that cannot be read

`kodor remove` SHALL read the settings before deleting anything, and
fall back to today's tools when it cannot.

#### Scenario: Settings that cannot be read

- **WHEN** `.claude/kodor.yaml` is missing or cannot be read when `remove` reads it, before deleting anything
- **THEN** it prints one line saying so, with the reason, and names what today's tools (GitHub, GitHub Issues, GitHub Actions, and Claude Code) leave behind.

### Requirement: An emptied settings file

`kodor remove` SHALL leave no empty `hooks` key or empty settings file
behind.

#### Scenario: An emptied settings file

- **WHEN** removing kodor's hooks leaves `hooks` empty
- **THEN** `remove` drops the `hooks` key. When `.claude/settings.json` is then an empty object, it deletes the file.

### Requirement: Remove deletes what presets shipped

kodor SHALL behave as this line says: When `kodor remove` goes ahead, it also deletes `.claude/kodor.choices.yaml` and every agent and skill a preset shipped, as the lock lists them.

#### Scenario: Remove deletes what presets shipped

- **WHEN** `kodor remove` goes ahead
- **THEN** it also deletes `.claude/kodor.choices.yaml` and every agent and skill a preset shipped, as the lock lists them.

### Requirement: What is left by hand, by tool

kodor SHALL behave as this line says: When `kodor remove` lists what is left by hand, it prints each tool's lines under the tool's label, indented two spaces, in the order code host, ticket system, runner, and coding agent, then `Then`, holding the line to commit; a tool with no lines has no heading, and the steps are numbered straight through the groups.

#### Scenario: What is left by hand, by tool

- **WHEN** `kodor remove` lists what is left by hand
- **THEN** it prints each tool's lines under the tool's label, indented two spaces, in the order code host, ticket system, runner, and coding agent, then `Then`, holding the line to commit; a tool with no lines has no heading, and the steps are numbered straight through the groups.

### Requirement: The code host's leftovers

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The code host's leftovers

- **WHEN** the code host is GitHub
- **THEN** its group holds the ruleset line; one line `Delete the secrets NAMES` for its tokens and `KODOR_SIGNING_KEY` among those set, ending ` if set` when the secrets cannot be listed, as today; and `Delete whichever of the labels merge: automatic, merge: manual, and verdict: override exist, if you do not want their history: deleting one takes it off every pull request`. Before them comes the line "The organization's property is left by hand" gives, where the repository's `kodor` property is `on`. After them, where the credentials file holds a token for the repository's owner, comes `Delete HOST/OWNER under github from PATH, unless another repository of OWNER's uses it`, ending `, if it is there` when the file cannot be read.

### Requirement: GitHub Issues' leftovers

kodor SHALL behave as this line says: When the ticket system is GitHub's, its group holds `Delete whichever of the labels spec and factory exist, if you do not want their history: deleting one takes it off every ticket`, then the board's fields line it has today. Each name is the one `tickets.labels` gives.

#### Scenario: GitHub Issues' leftovers

- **WHEN** the ticket system is GitHub's
- **THEN** its group holds `Delete whichever of the labels spec and factory exist, if you do not want their history: deleting one takes it off every ticket`, then the board's fields line it has today. Each name is the one `tickets.labels` gives.

### Requirement: The credential's leftovers

kodor SHALL list, when the ticket system in use keeps a credential on the machine, the secrets that hold it and the file's entry for the site under the ticket system's group of what `kodor remove` leaves by hand.

#### Scenario: The credential's leftovers

- **WHEN** the ticket system in use keeps a credential on the machine
- **THEN** its group holds `Delete the secrets NAMES` for the credential's names among those set, as line 28 words it, and, when the file holds an entry for the site, `Delete SITE from PATH, unless another repository on that site uses it`, with `, and revoke the token at PAGE` before the full stop when the tool names a page. When the file cannot be read, that line ends `, if it is there`. When the settings cannot be read, there is no site, and no such line.

### Requirement: No npm uninstall line

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: No npm uninstall line

- **WHEN** `kodor remove` lists what is left by hand
- **THEN** `kodor remove` lists no `npm uninstall` line.

### Requirement: The organization's property is left by hand

kodor SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The organization's property is left by hand

- **WHEN** `kodor remove` runs in an organization's repository that is set up
- **THEN** `kodor remove`, in an organization's repository that is set up, lists `Ask an owner of ORG to set the kodor property to "off" for REPOSITORY: until then every pull request waits on its "Review verdict" check`.

### Requirement: Remove takes the folder's entry out

kodor SHALL behave as this line says: When `kodor remove` takes kodor's entries out of `.claude/settings.json`, that of line 35 goes too.

#### Scenario: Remove takes the folder's entry out

- **WHEN** `kodor remove` takes kodor's entries out of `.claude/settings.json`
- **THEN** that of line 35 goes too.
