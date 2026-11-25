## ADDED Requirements

### Requirement: Another repository's ticket

The factory SHALL behave as this line says: When a command on GitHub is given another repository's ticket, such as `octo/web#4`, it reads and writes that ticket in `octo/web`. One given the checkout's own, such as `acme/api#12` in `acme/api`, means ticket 12.

#### Scenario: Another repository's ticket

- **WHEN** a command on GitHub is given another repository's ticket, such as `octo/web#4`
- **THEN** it reads and writes that ticket in `octo/web`. One given the checkout's own, such as `acme/api#12` in `acme/api`, means ticket 12.

### Requirement: A link to another repository's ticket

The factory SHALL behave as this line says: When a pull request's body on GitHub has `Part of octo/web#4`, it builds part of that ticket, and `Part of acme/api#12` in `acme/api` builds part of ticket 12.

#### Scenario: A link to another repository's ticket

- **WHEN** a pull request's body on GitHub has `Part of octo/web#4`
- **THEN** it builds part of that ticket, and `Part of acme/api#12` in `acme/api` builds part of ticket 12.

### Requirement: A branch for another repository's ticket

The factory SHALL behave as this line says: When `factory ticket branch N` runs for another repository's ticket, `{ticket}` is the last part of that repository's name and the number, so `dev/api-12`.

#### Scenario: A branch for another repository's ticket

- **WHEN** `factory ticket branch N` runs for another repository's ticket
- **THEN** `{ticket}` is the last part of that repository's name and the number, so `dev/api-12`.

### Requirement: A spec change for another repository's ticket

The factory SHALL behave as this line says: When `factory specs new N` runs for another repository's ticket with OpenSpec, the change is `openspec/changes/issue-acme-api-12/`.

#### Scenario: A spec change for another repository's ticket

- **WHEN** `factory specs new N` runs for another repository's ticket with OpenSpec
- **THEN** the change is `openspec/changes/issue-acme-api-12/`.

### Requirement: A build of another repository's ticket

The factory SHALL behave as this line says: When `factory build acme/api#12` runs in a checkout of `acme/web`, it starts the build in `acme/web`, whose Prepare goes by lines 38 to 41, and the run is named `Build acme/api#12`.

#### Scenario: A build of another repository's ticket

- **WHEN** `factory build acme/api#12` runs in a checkout of `acme/web`
- **THEN** it starts the build in `acme/web`, whose Prepare goes by lines 38 to 41, and the run is named `Build acme/api#12`.

### Requirement: Who decides on another repository's ticket

The factory SHALL behave as this line says: When whoever wrote a comment on another repository's ticket is asked about, it is an instruction when that account can write to that repository.

#### Scenario: Who decides on another repository's ticket

- **WHEN** whoever wrote a comment on another repository's ticket is asked about
- **THEN** it is an instruction when that account can write to that repository.

## REMOVED Requirements

### Requirement: Another repository's ticket as input

**Reason**: A command reads and writes another repository's ticket, where it refused one.

**Migration**: None.
