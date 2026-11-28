# handed-over Specification

## Purpose

What a `lunamill` command does in a session in the cloud: it reads what Prepare handed over, and asks for its writes.

## Requirements

### Requirement: A read in a session

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A read in a session

- **WHEN** a session in the cloud reads through a `lunamill` command
- **THEN** In a session of line 65, each read of `lunamill ticket` and `lunamill pr` a skill makes answers from what Prepare handed over, with the same output as from the code host, and the run's ticket as the session last asked for it to be. One not handed over prints the line "A run in the cloud" shows and exits 1.

### Requirement: A write in a session

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A write in a session

- **WHEN** a session in the cloud writes through a `lunamill` command
- **THEN** Each write there is added to `request.json` as the command it is, and prints `Asked: factory ` and the command. One this run may not make is refused at once, `✗ Can't ask for this. ` and the reason. `lunamill pr open` prints the branch in place of the number. Nor is a text the ticket system or the code host would refuse, or a pull request that links another ticket, asked for.

### Requirement: Handing commits over

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Handing commits over

- **WHEN** a session pushes or pulls through `lunamill pr`
- **THEN** `lunamill pr push` hands the branch's commits over there, and pushes the branch anywhere else. `lunamill pr pull` merges the pull request's newest commit, as handed over there, and from the remote anywhere else. A commit in another's name, over 20 MB in all, or whose message links another ticket is refused there.

### Requirement: Nothing to wait for

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Nothing to wait for

- **WHEN** a session in the cloud waits for CI or a review
- **THEN** `lunamill pr state --wait`, `lunamill pr wait-checks`, and `lunamill pr watch` print the "This run ends here" line there and exit 0.

### Requirement: A claim in a session

Lunamill SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A claim in a session

- **WHEN** a session in the cloud claims a ticket
- **THEN** `lunamill ticket claim` there prints `claimed` when Prepare claimed the ticket, and `still-live` answers as Prepare found it. Publish checks the claim again before it opens a pull request.
