## ADDED Requirements

### Requirement: Remove shows its plan first

`factory remove` SHALL print every file it will delete or change and ask
before changing anything.

#### Scenario: Remove shows its plan first

- **WHEN** `factory remove` runs
- **THEN** it prints every file it will delete or change in the repository, and then asks "Go ahead?". Answered no, it prints "Nothing changed." and changes nothing.

### Requirement: The factory's files are deleted

`factory remove` SHALL delete the factory's files when told to go ahead.

#### Scenario: The factory's files are deleted

- **WHEN** going ahead
- **THEN** it deletes `.claude/factory.yaml`, `.claude/factory.lock`, `.claude/factory/`, every `.claude/skills/factory-*/` and `.claude/agents/factory-*.md`, every `.github/workflows/factory-*.yml`, and `.github/factory-review.md`.

### Requirement: The factory's hooks and import line are removed

`factory remove` SHALL take the factory's hook entries and import line out
of files it shares with the user, keeping the rest.

#### Scenario: The factory's hooks and import line are removed

- **WHEN** going ahead
- **THEN** it removes the factory's hook entries from `.claude/settings.json`, keeping every other key and entry, and the factory's import line from `CLAUDE.md`, keeping every other line.

### Requirement: What remove leaves

`factory remove` SHALL leave files that are the user's.

#### Scenario: What remove leaves

- **WHEN** it removes the factory
- **THEN** it leaves `.github/review-notes.md`, `attribution` in `.claude/settings.json`, `package.json`, `package-lock.json`, `node_modules/` in `.gitignore`, and every skill, agent, and workflow not named `factory-`.

### Requirement: What is left by hand

`factory remove` SHALL print what is left to remove outside the
repository, each tool contributing its own lines, and commit nothing.

#### Scenario: What is left by hand

- **WHEN** it has changed the repository
- **THEN** it prints what is left to remove by hand, each tool contributing its own lines. With today's tools, that is the `FACTORY_` secrets, `CLAUDE_CODE_OAUTH_TOKEN`, and `ANTHROPIC_API_KEY` among those set; the "Software factory" ruleset, to remove first; the labels `merge: automatic`, `merge: manual`, `verdict: override`, `follow-up`, and `spec`; the board's Session, Runs in, and Cost fields when the settings name a board; and `npm uninstall @davidbyoung/software-factory`. It commits nothing.

### Requirement: Another tool's leftovers

`factory remove` SHALL print the leftover lines of whichever tools are in
use.

#### Scenario: Another tool's leftovers

- **WHEN** a tool in use is the test fake
- **THEN** its own leftover line is printed among them.

### Requirement: Nothing to remove

`factory remove` SHALL say so and exit 0 when nothing of the factory's is
in the repository.

#### Scenario: Nothing to remove

- **WHEN** none of the files or lines in lines 16 and 17 is in the repository
- **THEN** `remove` prints "Nothing of the factory's is here." and exits 0.

### Requirement: A removal half done

`factory remove` SHALL remove whatever of the factory's is left.

#### Scenario: A removal half done

- **WHEN** only some of them are there, as after a removal half done by hand
- **THEN** `remove` lists and removes those, and goes on as in line 19.

### Requirement: Settings that cannot be read

`factory remove` SHALL read the settings before deleting anything, and
fall back to today's tools when it cannot.

#### Scenario: Settings that cannot be read

- **WHEN** `.claude/factory.yaml` is missing or cannot be read when `remove` reads it, before deleting anything
- **THEN** it prints one line saying so, with the reason, and names what today's tools (GitHub, GitHub Issues, GitHub Actions, and Claude Code) leave behind.

### Requirement: An emptied settings file

`factory remove` SHALL leave no empty `hooks` key or empty settings file
behind.

#### Scenario: An emptied settings file

- **WHEN** removing the factory's hooks leaves `hooks` empty
- **THEN** `remove` drops the `hooks` key. When `.claude/settings.json` is then an empty object, it deletes the file.
