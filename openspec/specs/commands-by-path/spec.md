# commands-by-path Specification

## Purpose

Commands for some folders: a command under `commands` written as an item with `in` and `files`, which folders it runs in and which changed files set it off, what each setting reads as the change, the rule that a changed file nothing covers runs every command, `commands.ignore`, and what `lunamill config check` says about them.

## Requirements

### Requirement: A command written as an item

lunamill SHALL behave as this line says: When a command under `commands` is written as a map, it is an item: `run` is required, `in` and `files` are optional, and `report` is allowed only under `commands.coverage`. Text keeps today's meaning: from the root, on every change.

#### Scenario: A command written as an item

- **WHEN** When a command under `commands` is written as a map
- **THEN** it is an item: `run` is required, `in` and `files` are optional, and `report` is allowed only under `commands.coverage`. Text keeps today's meaning: from the root, on every change.

### Requirement: A folder pattern in in

lunamill SHALL behave as this line says: When an item's `in` ends in `/*`, the item is one command for each folder directly under that path that exists on disk and holds a file git tracks or an untracked file git doesn't ignore, in name order.

#### Scenario: A folder pattern in in

- **WHEN** When an item's `in` ends in `/*`
- **THEN** the item is one command for each folder directly under that path that exists on disk and holds a file git tracks or an untracked file git doesn't ignore, in name order.

### Requirement: A list of folders in in

lunamill SHALL behave as this line says: When an item's `in` is a list, the item is one command for each folder the list names, each `*` expanded.

#### Scenario: A list of folders in in

- **WHEN** When an item's `in` is a list
- **THEN** the item is one command for each folder the list names, each `*` expanded.

### Requirement: An item's files by default

lunamill SHALL behave as this line says: When an item has no `files`, its files are `./**`; with neither `in` nor `files`, every file.

#### Scenario: An item's files by default

- **WHEN** When an item has no `files`
- **THEN** its files are `./**`; with neither `in` nor `files`, every file.

### Requirement: Paths from the item's folder

lunamill SHALL behave as this line says: When a path in an item's `files` or `report` starts with `./`, it is read from the item's folder; any other path, from the repository's root.

#### Scenario: Paths from the item's folder

- **WHEN** When a path in an item's `files` or `report` starts with `./`
- **THEN** it is read from the item's folder; any other path, from the repository's root.

### Requirement: The branch's change

lunamill SHALL behave as this line says: When `lunamill gate`, `lunamill coverage`, or `lunamill site compare` reads the change, it is the files `git diff --name-only --no-renames` lists from `git merge-base HEAD origin/DEFAULT` to the working tree, and the files `git ls-files --others --exclude-standard` lists.

#### Scenario: The branch's change

- **WHEN** When `lunamill gate`
- **THEN** `lunamill coverage`, or `lunamill site compare` reads the change, it is the files `git diff --name-only --no-renames` lists from `git merge-base HEAD origin/DEFAULT` to the working tree, and the files `git ls-files --others --exclude-standard` lists.

### Requirement: The change before a commit

lunamill SHALL behave as this line says: When the commit guard reads the change, it is the files that differ from `HEAD`, staged or not, and new files; in a repository with no commit yet, every command runs.

#### Scenario: The change before a commit

- **WHEN** When the commit guard reads the change
- **THEN** it is the files that differ from `HEAD`, staged or not, and new files; in a repository with no commit yet, every command runs.

### Requirement: The change for relock

lunamill SHALL behave as this line says: When `lunamill relock` reads the change, it is the files that differ between `origin/DEFAULT` and the working tree, and new files.

#### Scenario: The change for relock

- **WHEN** When `lunamill relock` reads the change
- **THEN** it is the files that differ between `origin/DEFAULT` and the working tree, and new files.

### Requirement: An item runs where its files change

lunamill SHALL behave as this line says: When a changed file that `commands.ignore` doesn't match matches an item's `files` in one of its folders, the item runs in that folder. A `./` pattern matches in its own folder only; a root pattern, in every folder.

#### Scenario: An item runs where its files change

- **WHEN** When a changed file that `commands.ignore` doesn't match matches an item's `files` in one of its folders
- **THEN** the item runs in that folder. A `./` pattern matches in its own folder only; a root pattern, in every folder.

### Requirement: A file nothing covers runs every command

lunamill SHALL behave as this line says: When the gate has an item and a changed file matches neither a gate item's `files` nor `commands.ignore`, every command of the gate, before-commit, relock, and site runs, each in its folders.

#### Scenario: A file nothing covers runs every command

- **WHEN** When the gate has an item and a changed file matches neither a gate item's `files` nor `commands.ignore`
- **THEN** every command of the gate, before-commit, relock, and site runs, each in its folders.

### Requirement: An all-text gate

lunamill SHALL behave as this line says: When the gate has no item, a changed file no item matches runs no item, in every setting.

#### Scenario: An all-text gate

- **WHEN** When the gate has no item
- **THEN** a changed file no item matches runs no item, in every setting.

### Requirement: A change to the settings runs every command

lunamill SHALL behave as this line says: When the change includes `.claude/lunamill.yaml`, `.claude/lunamill.lock`, or `.claude/lunamill.choices.yaml`, every command of the gate, before-commit, relock, and site runs.

#### Scenario: A change to the settings runs every command

- **WHEN** When the change includes `.claude/lunamill.yaml`
- **THEN** `.claude/lunamill.lock`, or `.claude/lunamill.choices.yaml`, every command of the gate, before-commit, relock, and site runs.

### Requirement: Only ignored files changed

lunamill SHALL behave as this line says: When every changed file matches `commands.ignore`, only text commands run.

#### Scenario: Only ignored files changed

- **WHEN** When every changed file matches `commands.ignore`
- **THEN** only text commands run.

### Requirement: No default branch to compare with

lunamill SHALL behave as this line says: When there is no `origin/DEFAULT`, every command of the setting runs, after `? Can't tell what changed, since there is no origin/DEFAULT to compare with. Every KEY command runs.` and `Fetch it with: git fetch origin DEFAULT`, where KEY is `gate`, `relock`, or `site`.

#### Scenario: No default branch to compare with

- **WHEN** When there is no `origin/DEFAULT`
- **THEN** every command of the setting runs, after `? Can't tell what changed, since there is no origin/DEFAULT to compare with. Every KEY command runs.` and `Fetch it with: git fetch origin DEFAULT`, where KEY is `gate`, `relock`, or `site`.

### Requirement: A branch that shares no commit

lunamill SHALL behave as this line says: When `HEAD` shares no commit with `origin/DEFAULT`, every command of the setting runs, after `? Can't tell what changed, since this branch shares no commit with origin/DEFAULT. Every KEY command runs.` and `In a shallow clone, fetch the history with: git fetch --unshallow origin`.

#### Scenario: A branch that shares no commit

- **WHEN** When `HEAD` shares no commit with `origin/DEFAULT`
- **THEN** every command of the setting runs, after `? Can't tell what changed, since this branch shares no commit with origin/DEFAULT. Every KEY command runs.` and `In a shallow clone, fetch the history with: git fetch --unshallow origin`.

### Requirement: The base commit

lunamill SHALL behave as this line says: When a command runs, `$BASE` holds the merge base (`HEAD` for before-commit), and is empty when there is none.

#### Scenario: The base commit

- **WHEN** When a command runs
- **THEN** `$BASE` holds the merge base (`HEAD` for before-commit), and is empty when there is none.

### Requirement: An item that fails in one folder

lunamill SHALL behave as this line says: When an item's command fails in one folder, in any setting that runs a list, it still runs in the item's other matching folders, and the commands after the item don't run.

#### Scenario: An item that fails in one folder

- **WHEN** When an item's command fails in one folder
- **THEN** in any setting that runs a list, it still runs in the item's other matching folders, and the commands after the item don't run.

### Requirement: A setting with no item

lunamill SHALL behave as this line says: When no command in a setting is an item, every command runs on every change, and the command prints what it printed before this ticket.

#### Scenario: A setting with no item

- **WHEN** When no command in a setting is an item
- **THEN** every command runs on every change, and the command prints what it printed before this ticket.

### Requirement: An item config check refuses

lunamill SHALL behave as this line says: When `lunamill config check` reads an item with no `run`, a key it doesn't know, `report` outside `commands.coverage`, an empty `files`, a `*` anywhere but as the whole last name of `in`, or an `in` or `./` path that leaves the repository, it fails naming the key.

#### Scenario: An item config check refuses

- **WHEN** When `lunamill config check` reads an item with no `run`
- **THEN** a key it doesn't know, `report` outside `commands.coverage`, an empty `files`, a `*` anywhere but as the whole last name of `in`, or an `in` or `./` path that leaves the repository, it fails naming the key.

### Requirement: A folder that does not exist

lunamill SHALL behave as this line says: When an `in` without a `*` is not a folder, `lunamill config check` fails with `.claude/lunamill.yaml: commands.KEY[N].in: PATH is not a folder`.

#### Scenario: A folder that does not exist

- **WHEN** When an `in` without a `*` is not a folder
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: commands.KEY[N].in: PATH is not a folder`.

### Requirement: Files on build-setup

lunamill SHALL behave as this line says: When `commands.build-setup` has an item with `files`, `lunamill config check` fails with `.claude/lunamill.yaml: commands.build-setup[N].files: build-setup runs before there is a change, so every command runs. Leave files out`.

#### Scenario: Files on build-setup

- **WHEN** When `commands.build-setup` has an item with `files`
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: commands.build-setup[N].files: build-setup runs before there is a change, so every command runs. Leave files out`.

### Requirement: Text before an item

lunamill SHALL behave as this line says: When text comes before an item in `commands.test-one` or `commands.end-to-end`, `lunamill config check` fails with `.claude/lunamill.yaml: commands.KEY[N]: text at [M] covers every file first, so this is never run. Put text last`.

#### Scenario: Text before an item

- **WHEN** When text comes before an item in `commands.test-one` or `commands.end-to-end`
- **THEN** `lunamill config check` fails with `.claude/lunamill.yaml: commands.KEY[N]: text at [M] covers every file first, so this is never run. Put text last`.

### Requirement: A pattern that matches nothing

lunamill SHALL behave as this line says: When an `in` with a `*` matches no folder, or a pattern in `files` or `commands.ignore` matches no file, `lunamill config check` warns with `?`, naming the key and the pattern.

#### Scenario: A pattern that matches nothing

- **WHEN** When an `in` with a `*` matches no folder
- **THEN** or a pattern in `files` or `commands.ignore` matches no file, `lunamill config check` warns with `?`, naming the key and the pattern.

### Requirement: A root pattern inside every folder

lunamill SHALL behave as this line says: When a root pattern in an item's `files` names a path inside each of its folders, such as `packages/*/src/**` on `in: packages/*`, `lunamill config check` warns with `? .claude/lunamill.yaml: commands.KEY[N].files: PATTERN is in every folder of IN, so a change in one runs all of them; write ./REST for each folder's own`.

#### Scenario: A root pattern inside every folder

- **WHEN** When a root pattern in an item's `files` names a path inside each of its folders
- **THEN** such as `packages/*/src/**` on `in: packages/*`, `lunamill config check` warns with `? .claude/lunamill.yaml: commands.KEY[N].files: PATTERN is in every folder of IN, so a change in one runs all of them; write ./REST for each folder's own`.

### Requirement: A coverage report in every folder

lunamill SHALL behave as this line says: When a coverage item with several folders has a `report` without `./`, `lunamill config check` warns with `? .claude/lunamill.yaml: commands.coverage[N].report: PATH is the same file in every folder of IN; write ./PATH`.

#### Scenario: A coverage report in every folder

- **WHEN** When a coverage item with several folders has a `report` without `./`
- **THEN** `lunamill config check` warns with `? .claude/lunamill.yaml: commands.coverage[N].report: PATH is the same file in every folder of IN; write ./PATH`.

### Requirement: The files nothing covers

lunamill SHALL behave as this line says: When the gate has an item, `lunamill config check` warns about the tracked files no gate item covers and `commands.ignore` doesn't match, as `? N paths are in no gate command's files and not in commands.ignore, so a change to one runs every command:`, one line per path, a folder with nothing covered in it as `FOLDER/` and its file count, N counting those lines, then `Add each to commands.ignore, or to the files of the gate commands it affects.`

#### Scenario: The files nothing covers

- **WHEN** When the gate has an item
- **THEN** `lunamill config check` warns about the tracked files no gate item covers and `commands.ignore` doesn't match, as `? N paths are in no gate command's files and not in commands.ignore, so a change to one runs every command:`, one line per path, a folder with nothing covered in it as `FOLDER/` and its file count, N counting those lines, then `Add each to commands.ignore, or to the files of the gate commands it affects.`
