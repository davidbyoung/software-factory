# follow-ups Specification

## Purpose

What a session noticed and did not fix, listed in its pull request's description for a person to decide about, and the tickets opened from that list when the pull request merges.

## Requirements

### Requirement: Listing a follow-up

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Listing a follow-up

- **WHEN** `lunamill follow-up TITLE TEXT` runs on a branch with an open pull request
- **THEN** It adds an item, unticked, to the list at the end of that pull request's description, and prints `✓ Listed in #90, as 1.` with the pull request and the item's number. The list, its heading, `### Noticed, not fixed`, and its first paragraph, `Tick a box, and merging opens a ticket for it. To have one fixed here instead, say so in a review, such as "fix 1".`, are added with the first item. TITLE and TEXT are written as given, backticks and final period included.

### Requirement: A branch with no pull request

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A branch with no pull request

- **WHEN** the branch has no open pull request
- **THEN** It prints `✗ Branch BRANCH has no open pull request to list it in. Open one first: lunamill pr open`, BRANCH being the branch's own name, changes nothing, and exits 1.

### Requirement: A follow-up listed already

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A follow-up listed already

- **WHEN** the list already holds an item with that title, ignoring case
- **THEN** It prints `- Already listed in #90, as 1.`, changes nothing, and exits 0.

### Requirement: A fourth follow-up

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A fourth follow-up

- **WHEN** the list already holds three items, ticked and opened ones among them
- **THEN** It prints `✗ #90 already lists three. List only what someone would run into.`, changes nothing, and exits 1.

### Requirement: A follow-up that links a ticket

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A follow-up that links a ticket

- **WHEN** TITLE or TEXT has a bare tag-like word, or words that `lunamill pr push` refuses in a cloud build's commit, which say it closes or builds part of any ticket
- **THEN** It refuses naming them, changes nothing, and exits 1.

### Requirement: A follow-up on one line

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A follow-up on one line

- **WHEN** TITLE or TEXT holds a line break, `**`, or one of Lunamill's hidden markers
- **THEN** The item is written on one line without them.

### Requirement: A ticked follow-up opens a ticket

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A ticked follow-up opens a ticket

- **WHEN** a pull request merges with an item ticked in its description
- **THEN** `lunamill pr follow-ups --event FILE` opens a ticket with the item's title, without its final period and without any backtick, the item's text, and the line `Noticed while building #88, in pull request #90.`, or `Noticed in pull request #90.` where the pull request is for no ticket. The job's line names the item by that title. The ticket carries the lunamill label and nothing starts building it.

### Requirement: The list says what was opened

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The list says what was opened

- **WHEN** it opens one
- **THEN** It adds ` Opened #101.` to the end of that item's line, keeping the rest of the description as it stands then, and prints `✓ Opened #101 for 1, "TITLE".`, TITLE being the ticket's.

### Requirement: An unticked follow-up opens nothing

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An unticked follow-up opens nothing

- **WHEN** an item is not ticked in the event
- **THEN** It opens nothing for it and prints `- 2 is not ticked, so nothing was opened for it.`

### Requirement: A follow-up is opened once

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A follow-up is opened once

- **WHEN** an item already says what it opened, or an open ticket with that title already says it came from that pull request
- **THEN** It opens none for it. In the second case it adds that ticket's ` Opened` words.

### Requirement: A ticket that cannot be opened

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A ticket that cannot be opened

- **WHEN** a ticket cannot be opened
- **THEN** It prints `✗ Could not open a ticket for 1: REASON. Run this job again.`, goes on to the next, and exits 1.

### Requirement: A person's own words

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A person's own words

- **WHEN** a person changed an item's words before the merge
- **THEN** The ticket has their words. A line of the list that no longer reads as an item is skipped, with `? 1 can't be read, so nothing was opened for it.`

### Requirement: A pull request whose list opens nothing

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A pull request whose list opens nothing

- **WHEN** the event's pull request did not merge, came from a fork, or has no list
- **THEN** The command opens nothing and exits 0.
