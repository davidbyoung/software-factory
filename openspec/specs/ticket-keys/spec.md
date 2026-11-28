# ticket-keys Specification

## Purpose

How lunamill names a ticket: by the key its ticket system gives it, as text, which every command takes; by its written form, such as `#12`, in every line of output, comment, and pull request body; and by the link lines its ticket system's adapter writes and reads, which decide the tickets a pull request closes and builds part of.

## Requirements

### Requirement: A command takes a key

lunamill SHALL behave as this line says: When a command takes a ticket, it takes the ticket's key as text: on GitHub the issue's number, such as `12`, and with the in-memory adapter's strict keys, a key such as `PROJ-12`.

#### Scenario: A command takes a key

- **WHEN** a command takes a ticket
- **THEN** it takes the ticket's key as text: on GitHub the issue's number, such as `12`, and with the in-memory adapter's strict keys, a key such as `PROJ-12`.

### Requirement: A key the system does not use

lunamill SHALL behave as this line says: When a command is given a key its ticket system does not use, such as `PROJ-12` on GitHub, it prints `PROJ-12 is not a ticket here: a GitHub ticket is its number, such as 12`, reads and writes nothing, and exits 1.

#### Scenario: A key the system does not use

- **WHEN** a command is given a key its ticket system does not use
- **THEN** such as `PROJ-12` on GitHub, it prints `PROJ-12 is not a ticket here: a GitHub ticket is its number, such as 12`, reads and writes nothing, and exits 1.

### Requirement: A pull request given as a ticket

lunamill SHALL behave as this line says: When any `lunamill ticket` command is given a pull request's number on GitHub, `comment`, `label`, and `cost` among them, it prints `#64 was not found`, writes nothing, and exits 1.

#### Scenario: A pull request given as a ticket

- **WHEN** any `lunamill ticket` command is given a pull request's number on GitHub
- **THEN** `comment`, `label`, and `cost` among them, it prints `#64 was not found`, writes nothing, and exits 1.

### Requirement: A ticket in output is its written form

lunamill SHALL behave as this line says: When a command's output, or a comment or pull request body lunamill writes, names a ticket, it writes the ticket as its system writes it: `#12` on GitHub, `octo/web#4` for another GitHub repository's ticket, and `PROJ-12` with strict keys.

#### Scenario: A ticket in output is its written form

- **WHEN** a command's output
- **THEN** or a comment or pull request body lunamill writes, names a ticket, it writes the ticket as its system writes it: `#12` on GitHub, `octo/web#4` for another GitHub repository's ticket, and `PROJ-12` with strict keys.

### Requirement: The written form field

lunamill SHALL behave as this line says: When `lunamill ticket view N --field ref` runs, it prints N's written form, `#12` on GitHub or `PROJ-12` with strict keys, and exits 0.

#### Scenario: The written form field

- **WHEN** `lunamill ticket view N --field ref` runs
- **THEN** it prints N's written form, `#12` on GitHub or `PROJ-12` with strict keys, and exits 0.

### Requirement: JSON carries key and ref

lunamill SHALL behave as this line says: When `lunamill ticket view N --json` or `lunamill ticket list --json` runs, each ticket carries `key`, as text, and `ref`, its written form, in place of `number`, and each comment's `id` is text.

#### Scenario: JSON carries key and ref

- **WHEN** `lunamill ticket view N --json` or `lunamill ticket list --json` runs
- **THEN** each ticket carries `key`, as text, and `ref`, its written form, in place of `number`, and each comment's `id` is text.

### Requirement: Tickets list by key

lunamill SHALL behave as this line says: When `lunamill ticket list` runs, it lists tickets by key, letters first and then the number as a number: `OPS-3`, `PROJ-9`, `PROJ-12`. On GitHub that is number order.

#### Scenario: Tickets list by key

- **WHEN** `lunamill ticket list` runs
- **THEN** it lists tickets by key, letters first and then the number as a number: `OPS-3`, `PROJ-9`, `PROJ-12`. On GitHub that is number order.

### Requirement: A comment ID is text

lunamill SHALL behave as this line says: When `lunamill ticket comment` posts, it prints the comment's ID as the ticket system gives it, as text.

#### Scenario: A comment ID is text

- **WHEN** `lunamill ticket comment` posts
- **THEN** it prints the comment's ID as the ticket system gives it, as text.

### Requirement: Marker comments with the same time

lunamill SHALL behave as this line says: When two marker comments on a ticket have the same time, the claim and the views take them in the order the ticket system returned them, and never compare their IDs.

#### Scenario: Marker comments with the same time

- **WHEN** two marker comments on a ticket have the same time
- **THEN** the claim and the views take them in the order the ticket system returned them, and never compare their IDs.

### Requirement: The closing link line

lunamill SHALL behave as this line says: When `lunamill ticket link N` runs, it prints `Closes #12` on GitHub and `Closes PROJ-12` with strict keys.

#### Scenario: The closing link line

- **WHEN** `lunamill ticket link N` runs
- **THEN** it prints `Closes #12` on GitHub and `Closes PROJ-12` with strict keys.

### Requirement: The part-of link line

lunamill SHALL behave as this line says: When `lunamill ticket link N --part` runs, it prints `Part of #4` on GitHub and `Part of PROJ-4` with strict keys.

#### Scenario: The part-of link line

- **WHEN** `lunamill ticket link N --part` runs
- **THEN** it prints `Part of #4` on GitHub and `Part of PROJ-4` with strict keys.

### Requirement: A body that closes a ticket the code host does not hold

lunamill SHALL behave as this line says: When the tickets are not the code host's own and a pull request's body has `Closes PROJ-12`, `lunamill pr closes N` prints `PROJ-12`, the sync shows PROJ-12 In review while the pull request is open, and the pull request's cost markers count toward PROJ-12's Cost.

#### Scenario: A body that closes a ticket the code host does not hold

- **WHEN** the tickets are not the code host's own and a pull request's body has `Closes PROJ-12`
- **THEN** `lunamill pr closes N` prints `PROJ-12`, the sync shows PROJ-12 In review while the pull request is open, and the pull request's cost markers count toward PROJ-12's Cost.

### Requirement: A body that builds part of a ticket the code host does not hold

lunamill SHALL behave as this line says: When the tickets are not the code host's own and a pull request's body has `Part of PROJ-4`, its cost markers count toward PROJ-4's Cost.

#### Scenario: A body that builds part of a ticket the code host does not hold

- **WHEN** the tickets are not the code host's own and a pull request's body has `Part of PROJ-4`
- **THEN** its cost markers count toward PROJ-4's Cost.

### Requirement: A plain mention links nothing

lunamill SHALL behave as this line says: When the tickets are not the code host's own, a mention of a ticket in a pull request's body without `Closes` or `Part of` links nothing.

#### Scenario: A plain mention links nothing

- **WHEN** the tickets are not the code host's own
- **THEN** a mention of a ticket in a pull request's body without `Closes` or `Part of` links nothing.

### Requirement: The code host's own closing list

lunamill SHALL behave as this line says: When the tickets are the code host's own, `lunamill pr closes N` prints the code host's list of the tickets N closes, as today.

#### Scenario: The code host's own closing list

- **WHEN** the tickets are the code host's own
- **THEN** `lunamill pr closes N` prints the code host's list of the tickets N closes, as today.

### Requirement: The closes output

lunamill SHALL behave as this line says: When `lunamill pr closes N` finds several tickets, it prints their keys with one space between them, and prints nothing when there are none.

#### Scenario: The closes output

- **WHEN** `lunamill pr closes N` finds several tickets
- **THEN** it prints their keys with one space between them, and prints nothing when there are none.

### Requirement: A blocker in another repository

lunamill SHALL behave as this line says: When `lunamill ticket blockers N` runs on GitHub and N waits on a ticket in another repository, it prints that blocker as `octo/web#4 open` or `octo/web#4 closed`, where today it prints `#4`.

#### Scenario: A blocker in another repository

- **WHEN** `lunamill ticket blockers N` runs on GitHub and N waits on a ticket in another repository
- **THEN** it prints that blocker as `octo/web#4 open` or `octo/web#4 closed`, where today it prints `#4`.

### Requirement: A claim blocked by another repository

lunamill SHALL behave as this line says: When `lunamill ticket claim N` refuses because N waits on another repository's open ticket, it prints `blocked by: octo/web#4`.

#### Scenario: A claim blocked by another repository

- **WHEN** `lunamill ticket claim N` refuses because N waits on another repository's open ticket
- **THEN** it prints `blocked by: octo/web#4`.

### Requirement: A pull request's cost

lunamill SHALL behave as this line says: When `lunamill pr cost N` runs, it posts on pull request N the cost note `lunamill ticket cost` posts on a ticket today, restarts the session's clock, prints `posted`, and exits 0. When N is not a pull request, it posts nothing, leaves the clock as it was, and exits 1.

#### Scenario: A pull request's cost

- **WHEN** `lunamill pr cost N` runs
- **THEN** it posts on pull request N the cost note `lunamill ticket cost` posts on a ticket today, restarts the session's clock, prints `posted`, and exits 0. When N is not a pull request, it posts nothing, leaves the clock as it was, and exits 1.

### Requirement: A build with a key

lunamill SHALL behave as this line says: When `lunamill build N` runs with strict keys, it prints `Started a build of PROJ-12 in GitHub Actions:` and the run's link, and the run is named `Build PROJ-12`. On GitHub both stay as today: `#12` and `Build #12`.

#### Scenario: A build with a key

- **WHEN** `lunamill build N` runs with strict keys
- **THEN** it prints `Started a build of PROJ-12 in GitHub Actions:` and the run's link, and the run is named `Build PROJ-12`. On GitHub both stay as today: `#12` and `Build #12`.

### Requirement: The build workflow's ticket field

lunamill SHALL behave as this line says: When a person opens `lunamill.yml`'s "Run workflow" form, its `ticket` field takes text and is described "The ticket's key, such as 12, for a build".

#### Scenario: The build workflow's ticket field

- **WHEN** a person opens `lunamill.yml`'s "Run workflow" form
- **THEN** its `ticket` field takes text and is described "The ticket's key, such as 12, for a build".

### Requirement: Another ticket system's host in a guide

lunamill SHALL behave as this line says: When a skill, an agent, a rule, the review instructions, or a workflow calls another ticket system's host directly, such as `atlassian.net` or `api.linear.app`, a test fails.

#### Scenario: Another ticket system's host in a guide

- **WHEN** a skill
- **THEN** an agent, a rule, the review instructions, or a workflow calls another ticket system's host directly, such as `atlassian.net` or `api.linear.app`, a test fails.

### Requirement: GitHub's link wording in a guide

lunamill SHALL behave as this line says: When a skill, an agent, a rule, or the review instructions write `Closes #`, `Part of #`, or "GitHub issue", a test fails.

#### Scenario: GitHub's link wording in a guide

- **WHEN** a skill
- **THEN** an agent, a rule, or the review instructions write `Closes #`, `Part of #`, or "GitHub issue", a test fails.

### Requirement: Another repository's ticket

lunamill SHALL behave as this line says: When a command on GitHub is given another repository's ticket, such as `octo/web#4`, it reads and writes that ticket in `octo/web`. One given the checkout's own, such as `acme/api#12` in `acme/api`, means ticket 12.

#### Scenario: Another repository's ticket

- **WHEN** a command on GitHub is given another repository's ticket, such as `octo/web#4`
- **THEN** it reads and writes that ticket in `octo/web`. One given the checkout's own, such as `acme/api#12` in `acme/api`, means ticket 12.

### Requirement: A link to another repository's ticket

lunamill SHALL behave as this line says: When a pull request's body on GitHub has `Part of octo/web#4`, it builds part of that ticket, and `Part of acme/api#12` in `acme/api` builds part of ticket 12.

#### Scenario: A link to another repository's ticket

- **WHEN** a pull request's body on GitHub has `Part of octo/web#4`
- **THEN** it builds part of that ticket, and `Part of acme/api#12` in `acme/api` builds part of ticket 12.

### Requirement: A branch for another repository's ticket

lunamill SHALL behave as this line says: When `lunamill ticket branch N` runs for another repository's ticket, `{ticket}` is the last part of that repository's name and the number, so `dev/api-12`.

#### Scenario: A branch for another repository's ticket

- **WHEN** `lunamill ticket branch N` runs for another repository's ticket
- **THEN** `{ticket}` is the last part of that repository's name and the number, so `dev/api-12`.

### Requirement: A spec change for another repository's ticket

lunamill SHALL behave as this line says: When `lunamill specs new N` runs for another repository's ticket with OpenSpec, the change is `openspec/changes/issue-acme-api-12/`.

#### Scenario: A spec change for another repository's ticket

- **WHEN** `lunamill specs new N` runs for another repository's ticket with OpenSpec
- **THEN** the change is `openspec/changes/issue-acme-api-12/`.

### Requirement: A build of another repository's ticket

lunamill SHALL behave as this line says: When `lunamill build acme/api#12` runs in a checkout of `acme/web`, it starts the build in `acme/web`, whose Prepare goes by lines 38 to 41, and the run is named `Build acme/api#12`.

#### Scenario: A build of another repository's ticket

- **WHEN** `lunamill build acme/api#12` runs in a checkout of `acme/web`
- **THEN** it starts the build in `acme/web`, whose Prepare goes by lines 38 to 41, and the run is named `Build acme/api#12`.

### Requirement: Who decides on another repository's ticket

lunamill SHALL behave as this line says: When whoever wrote a comment on another repository's ticket is asked about, it is an instruction when that account can write to that repository.

#### Scenario: Who decides on another repository's ticket

- **WHEN** whoever wrote a comment on another repository's ticket is asked about
- **THEN** it is an instruction when that account can write to that repository.
