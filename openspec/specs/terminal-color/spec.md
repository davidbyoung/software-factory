# terminal-color Specification

## Purpose

When what a person's command prints is in color, and what each look says. The capability covers every command `lunamill`'s usage lists and the usage itself, other than `config get`, `default-branch`, `plugins`, `preset changes`, `specs list`, and `specs new`. Where a line here names another by its number, the numbers are those of the ticket that wrote it.

## Requirements

### Requirement: FORCE_COLOR turns color on

Lunamill SHALL behave as this line says: When `FORCE_COLOR` is the empty string, `1`, `2`, `3`, or `true`, they print in color, whether or not their output goes to a terminal.

#### Scenario: FORCE_COLOR turns color on

- **WHEN** `FORCE_COLOR` is the empty string, `1`, `2`, `3`, or `true`
- **THEN** they print in color, whether or not their output goes to a terminal.

### Requirement: FORCE_COLOR's other values turn color off

Lunamill SHALL behave as this line says: When `FORCE_COLOR` is set to any other value, such as `0`, `false`, or `yes`, they print plain text, in a terminal or not.

#### Scenario: FORCE_COLOR's other values turn color off

- **WHEN** `FORCE_COLOR` is set to any other value, such as `0`, `false`, or `yes`
- **THEN** they print plain text, in a terminal or not.

### Requirement: A terminal gets color

Lunamill SHALL behave as this line says: When `FORCE_COLOR` is not set and their output goes to a terminal, they print in color, unless `NO_COLOR` or `NODE_DISABLE_COLORS` is set to any value, the empty string included, or `TERM` is `dumb`, when they print plain text.

#### Scenario: A terminal gets color

- **WHEN** `FORCE_COLOR` is not set and their output goes to a terminal
- **THEN** they print in color, unless `NO_COLOR` or `NODE_DISABLE_COLORS` is set to any value, the empty string included, or `TERM` is `dumb`, when they print plain text.

### Requirement: Output that is not a terminal stays plain

Lunamill SHALL behave as this line says: When the commands `terminal-color`'s Purpose lists print to something that is not a terminal and `FORCE_COLOR` is not set, they print no color codes.

#### Scenario: Output that is not a terminal stays plain

- **WHEN** the commands `terminal-color`'s Purpose lists print to something that is not a terminal and `FORCE_COLOR` is not set
- **THEN** they print no color codes.

### Requirement: Color adds only codes

Lunamill SHALL behave as this line says: When they print in color, their text with the color codes taken out is exactly the plain text.

#### Scenario: Color adds only codes

- **WHEN** they print in color
- **THEN** their text with the color codes taken out is exactly the plain text.

### Requirement: The preset summary's changes are colored

Lunamill SHALL behave as this line says: When `lunamill preset add` or `lunamill preset remove` prints its summary in color, each group's heading is bold and underlined, an `+ ITEM` is green and a `− ITEM` red, sign included, and in an `OLD → NEW` row, in any group, the old value is dim and the new one bold, with the arrow and any `, from PRESET` after it not colored.

#### Scenario: The preset summary's changes are colored

- **WHEN** `lunamill preset add` or `lunamill preset remove` prints its summary in color
- **THEN** each group's heading is bold and underlined, an `+ ITEM` is green and a `− ITEM` red, sign included, and in an `OLD → NEW` row, in any group, the old value is dim and the new one bold, with the arrow and any `, from PRESET` after it not colored.

### Requirement: Config explain dims its defaults

Lunamill SHALL behave as this line says: When `lunamill config explain` prints in color, a line whose mark is `# default` is dim from its first character to its last, a line that is only a comment, such as `# board: none (default)` or `# pr-review: off`, is dim, a line whose mark names a preset has only its mark dim, and a line with no mark is not colored, even when its value is quoted text containing ` #`.

#### Scenario: Config explain dims its defaults

- **WHEN** `lunamill config explain` prints in color
- **THEN** a line whose mark is `# default` is dim from its first character to its last, a line that is only a comment, such as `# board: none (default)` or `# pr-review: off`, is dim, a line whose mark names a preset has only its mark dim, and a line with no mark is not colored, even when its value is quoted text containing ` #`.

### Requirement: Config explain colors the lock's settings

Lunamill SHALL behave as this line says: When `lunamill config explain` prints the settings the lock records, it colors them as "Config explain dims its defaults" says, as it does when it resolves them.

#### Scenario: Config explain colors the lock's settings

- **WHEN** `lunamill config explain` prints the settings the lock records
- **THEN** it colors them as "Config explain dims its defaults" says, as it does when it resolves them.

### Requirement: Status colors and links follow the rule

Lunamill SHALL behave as this line says: When `lunamill status` prints in color, its ticket and pull request numbers are links, and when it prints plain text, they are neither links nor colored.

#### Scenario: Status colors and links follow the rule

- **WHEN** `lunamill status` prints in color
- **THEN** its ticket and pull request numbers are links, and when it prints plain text, they are neither links nor colored.

### Requirement: A person's commands follow the scheme

Lunamill SHALL behave as this line says: When a person's command prints in color, it follows lines 4 to 28 and the requirements "The preset summary's changes are colored" and "Config explain dims its defaults", and everything those do not name is plain.

#### Scenario: A person's commands follow the scheme

- **WHEN** a person's command prints in color
- **THEN** it follows lines 4 to 28 and the requirements "The preset summary's changes are colored" and "Config explain dims its defaults", and everything those do not name is plain.

### Requirement: What a skill or a workflow takes as it is has no color

Lunamill SHALL behave as this line says: When `lunamill config get`, `default-branch`, `plugins`, `preset changes`, `specs list`, `specs new`, or a command the usage does not list prints, its standard output and standard error hold no color code, whatever `FORCE_COLOR` is.

#### Scenario: What a skill or a workflow takes as it is has no color

- **WHEN** `lunamill config get`, `default-branch`, `plugins`, `preset changes`, `specs list`, `specs new`, or a command the usage does not list prints
- **THEN** its standard output and standard error hold no color code, whatever `FORCE_COLOR` is.

### Requirement: Each stream decides for itself

Lunamill SHALL behave as this line says: When a person's command prints to standard output and to standard error, each is in color or plain by that stream alone: with standard error sent to a file and `FORCE_COLOR` not set, the file holds no color code.

#### Scenario: Each stream decides for itself

- **WHEN** a person's command prints to standard output and to standard error
- **THEN** each is in color or plain by that stream alone: with standard error sent to a file and `FORCE_COLOR` not set, the file holds no color code.

### Requirement: The colors no line uses

Lunamill SHALL behave as this line says: When a person's command prints in color, no line uses blue, magenta, or a bright color, and yellow is never bold.

#### Scenario: The colors no line uses

- **WHEN** a person's command prints in color
- **THEN** no line uses blue, magenta, or a bright color, and yellow is never bold.

### Requirement: Headings

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Headings

- **WHEN** a heading prints in color
- **THEN** its words are bold and underlined. A heading is `Found`, `From the presets, so not asked`, `Stored for OWNER, so not asked`, `This is everything setup will do:`, `This is everything remove will do:`, `Checks`, `doctor`'s group names, `tickets.columns` and `tickets.fields` in `board check`, each column name of a table, each group's name in a preset's summary, a tool's name in `remove`'s list, the usage's group names, and the name of a group in `status` that holds a row, since line 22 says what an empty one takes.

### Requirement: Row labels

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Row labels

- **WHEN** a row prints in color
- **THEN** its label is bold and its value is plain. A row's label is the first cell of a line of `init`'s or `init --org`'s `Found` block or plan, of the blocks of what was not asked, of `board check`, of the column table and the ticket field table, of a preset summary's settings and its `writes`, `deletes`, and `runs` lines, of `preset choices` and `preset check`, of `remove`'s plan, and of `site compare`'s changed views, whose label is the page. A finding `site compare` prints, measured or from a repository's own check, is no row.

### Requirement: A value of none yet

Lunamill SHALL behave as this line says: When a row's value is `none yet`, it is dim in color.

#### Scenario: A value of none yet

- **WHEN** a row's value is `none yet`
- **THEN** it is dim in color.

### Requirement: Questions

Lunamill SHALL behave as this line says: When a question is asked in color, its words are bold, what a typed question offers in brackets with them, such as `[y/N]` in `Apply? [y/N]`, in `init`, `init --org`, `remove`, and the `preset` commands.

#### Scenario: Questions

- **WHEN** a question is asked in color
- **THEN** its words are bold, what a typed question offers in brackets with them, such as `[y/N]` in `Apply? [y/N]`, in `init`, `init --org`, `remove`, and the `preset` commands.

### Requirement: The name a command is about

Lunamill SHALL behave as this line says: When a command's first line names the organization, repository, preset, or board it is about, that name is bold in color: `acme` in `Setting up lunamill for the organization acme`, and `"TITLE"` in `Board 12, "TITLE"`. So are the pull request in `✓ Opened`, and the preset in `✓ Added` and `✓ Removed`.

#### Scenario: The name a command is about

- **WHEN** a command's first line names the organization, repository, preset, or board it is about
- **THEN** that name is bold in color: `acme` in `Setting up lunamill for the organization acme`, and `"TITLE"` in `Board 12, "TITLE"`. So are the pull request in `✓ Opened`, and the preset in `✓ Added` and `✓ Removed`.

### Requirement: Lunamill's commands

Lunamill SHALL behave as this line says: When a line holds a `lunamill` command Lunamill has, the command is cyan in color, with its flags and arguments: `lunamill init --org https://github.com/acme` in `an owner runs lunamill init --org https://github.com/acme`, and `lunamill init` alone in `Run lunamill init again.`

#### Scenario: Lunamill's commands

- **WHEN** a line holds a `lunamill` command Lunamill has
- **THEN** the command is cyan in color, with its flags and arguments: `lunamill init --org https://github.com/acme` in `an owner runs lunamill init --org https://github.com/acme`, and `lunamill init` alone in `Run lunamill init again.`

### Requirement: Addresses

Lunamill SHALL behave as this line says: When a line holds an `http` or `https` address, the address is cyan in color, without the punctuation that ends its sentence.

#### Scenario: Addresses

- **WHEN** a line holds an `http` or `https` address
- **THEN** the address is cyan in color, without the punctuation that ends its sentence.

### Requirement: Skills

Lunamill SHALL behave as this line says: When a line holds a `/lunamill-` skill, the skill and the argument after it are cyan in color, such as `/lunamill-refine N`.

#### Scenario: Skills

- **WHEN** a line holds a `/lunamill-` skill
- **THEN** the skill and the argument after it are cyan in color, such as `/lunamill-refine N`.

### Requirement: Another tool's commands

Lunamill SHALL behave as this line says: When a line gives another tool's command to run, that command is cyan in color: what follows `Run: `, `claude setup-token` in `running claude setup-token...`, the `npm install` commands, `git switch BRANCH && git pull`, each `LUNAMILL_` line of the poller's values, the signing key to add, and the command after `$ ` in `lunamill gate`.

#### Scenario: Another tool's commands

- **WHEN** a line gives another tool's command to run
- **THEN** that command is cyan in color: what follows `Run: `, `claude setup-token` in `running claude setup-token...`, the `npm install` commands, `git switch BRANCH && git pull`, each `LUNAMILL_` line of the poller's values, the signing key to add, and the command after `$ ` in `lunamill gate`.

### Requirement: The usage's commands

Lunamill SHALL behave as this line says: When the usage prints in color, `lunamill COMMAND` and each command's name with its arguments are cyan.

#### Scenario: The usage's commands

- **WHEN** the usage prints in color
- **THEN** `lunamill COMMAND` and each command's name with its arguments are cyan.

### Requirement: What the person does

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What the person does

- **WHEN** a list of what the person does prints in color
- **THEN** the line that heads it and each step's number are yellow, and a step's words are plain but for lines 10 to 13. Such a line is `Merge it to finish.` with what follows on its line, `Nothing else is left to do.` included, since merging is the person's, `Left to do:`, `After it merges:`, `After it merges, come back to BRANCH and bring it up to date:`, `Next, in each repository you want lunamill in:`, the line `Registering the ... Two steps, both in your browser.`, `Choose:`, and `Nothing is committed. Left for you to do by hand:`.

### Requirement: What the person adds by hand

Lunamill SHALL behave as this line says: When `init` or `init --org` asks the person to add something by hand, in a line that starts `Add this public key to`, `Add these columns to`, or `Add any of these fields`, that line is yellow in color up to and with its last colon.

#### Scenario: What the person adds by hand

- **WHEN** `init` or `init --org` asks the person to add something by hand, in a line that starts `Add this public key to`, `Add these columns to`, or `Add any of these fields`
- **THEN** that line is yellow in color up to and with its last colon.

### Requirement: Marks

Lunamill SHALL behave as this line says: When a line starts with a mark in color, after its indent, `✓` is green, `✗` and `⚠` are red, `?` is yellow, and `-` is dim, and the text after it is plain but for lines 6, 9 to 13, 22, and 24.

#### Scenario: Marks

- **WHEN** a line starts with a mark in color, after its indent
- **THEN** `✓` is green, `✗` and `⚠` are red, `?` is yellow, and `-` is dim, and the text after it is plain but for lines 6, 9 to 13, 22, and 24.

### Requirement: A failure with no mark

Lunamill SHALL behave as this line says: When a line starts with `Could not` in color, it is red up to and with its first colon, or whole when it has none.

#### Scenario: A failure with no mark

- **WHEN** a line starts with `Could not` in color
- **THEN** it is red up to and with its first colon, or whole when it has none.

### Requirement: An update's old and new values

Lunamill SHALL behave as this line says: When `lunamill update` prints an old value and a new one with an arrow between, the old one is dim and the new one bold in color, as in a preset's summary.

#### Scenario: An update's old and new values

- **WHEN** `lunamill update` prints an old value and a new one with an arrow between
- **THEN** the old one is dim and the new one bold in color, as in a preset's summary.

### Requirement: Work that is running

Lunamill SHALL behave as this line says: When a line says work is running in color, it is dim: `Asking AGENT which of ...`, `Trying the token...`, `Trying the API key...`, and `Downloading Lunamill VERSION, which this repository names. This happens once.`

#### Scenario: Work that is running

- **WHEN** a line says work is running in color
- **THEN** it is dim: `Asking AGENT which of ...`, `Trying the token...`, `Trying the API key...`, and `Downloading Lunamill VERSION, which this repository names. This happens once.`

### Requirement: The marks of a question

Lunamill SHALL behave as this line says: When `init`, `init --org`, or `remove` asks a question, an open one starts with `?`, yellow in color, and an answered one with `✓`, green in color, in place of the prompt library's own mark. The answer and the choice under the cursor are cyan, the hint and a default dim, and a secret's dots plain.

#### Scenario: The marks of a question

- **WHEN** `init`, `init --org`, or `remove` asks a question
- **THEN** an open one starts with `?`, yellow in color, and an answered one with `✓`, green in color, in place of the prompt library's own mark. The answer and the choice under the cursor are cyan, the hint and a default dim, and a secret's dots plain.

### Requirement: Status's numbers, times, and empty groups

Lunamill SHALL behave as this line says: When `lunamill status` prints in color, the number of a ticket, or of a pull request that is a row of its own or is listed as done, is cyan and a link, `Waiting on you` is yellow, and a group's count, a time, a card's pull request line, and the whole heading of an empty group are dim.

#### Scenario: Status's numbers, times, and empty groups

- **WHEN** `lunamill status` prints in color
- **THEN** the number of a ticket, or of a pull request that is a row of its own or is listed as done, is cyan and a link, `Waiting on you` is yellow, and a group's count, a time, a card's pull request line, and the whole heading of an empty group are dim.

### Requirement: Status's flags

Lunamill SHALL behave as this line says: When `lunamill status` prints a flag under a ticket in color, the line is red, as today.

#### Scenario: Status's flags

- **WHEN** `lunamill status` prints a flag under a ticket in color
- **THEN** the line is red, as today.

### Requirement: Status's reviewers

Lunamill SHALL behave as this line says: When `lunamill status` prints a reviewer's row in color, its mark and its result are green for passed, red for failed, dim for running, and yellow for no verdict or stopped without one, its name is plain, and its model, time, and cost are dim.

#### Scenario: Status's reviewers

- **WHEN** `lunamill status` prints a reviewer's row in color
- **THEN** its mark and its result are green for passed, red for failed, dim for running, and yellow for no verdict or stopped without one, its name is plain, and its model, time, and cost are dim.

### Requirement: Another tool's output

Lunamill SHALL behave as this line says: When a command prints another tool's output, such as the last lines of a gate that failed in `init`, `lunamill config explain` prints the settings, or `site compare` prints what a repository's own check found, lines 10 to 13, 17, and 18 color nothing in it.

#### Scenario: Another tool's output

- **WHEN** a command prints another tool's output, such as the last lines of a gate that failed in `init`, `lunamill config explain` prints the settings, or `site compare` prints what a repository's own check found
- **THEN** lines 10 to 13, 17, and 18 color nothing in it.

### Requirement: The launcher's mark

Lunamill SHALL behave as this line says: When the launcher stops with a line that starts with `✗`, the mark is red in color.

#### Scenario: The launcher's mark

- **WHEN** the launcher stops with a line that starts with `✗`
- **THEN** the mark is red in color.

### Requirement: A typed answer

Lunamill SHALL behave as this line says: When a preset's question is answered by typing, as `Apply? [y/N]` is, what is typed is plain.

#### Scenario: A typed answer

- **WHEN** a preset's question is answered by typing, as `Apply? [y/N]` is
- **THEN** what is typed is plain.

### Requirement: The preset summary's signs

Lunamill SHALL behave as this line says: When a preset's summary prints in color, an `+ ITEM` is green and a `− ITEM` red, sign included, as today.

#### Scenario: The preset summary's signs

- **WHEN** a preset's summary prints in color
- **THEN** an `+ ITEM` is green and a `− ITEM` red, sign included, as today.
