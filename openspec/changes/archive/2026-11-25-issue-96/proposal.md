# Proposal

From [davidbyoung/software-factory#96](https://github.com/davidbyoung/software-factory/issues/96).

## Why

One ticket per thing a build noticed made too many tickets, so the factory put them all on one Follow-ups ticket. That became a dumping ground: #4 held 21 unchecked lines about unrelated things, and the owner could not follow it. When it was closed on 2026-11-25, three lines were worth a ticket.

Agreed with the owner on 2026-11-25: a build lists what it noticed in its pull request, and the owner decides there, while the change is in front of them. Nothing is recorded until they do, and there is no Follow-ups ticket.

Decisions:

Agreed with the owner on 2026-11-25:

- **Where what a build noticed goes:** its pull request's description, unticked. There is no Follow-ups ticket.
- **What acts on a tick:** a job with no AI, once, when the pull request merges. Nothing acts on the tick itself.
- **What an unticked one becomes:** nothing, and the same for a pull request that merges itself.
- **How many:** three at most.
- **The draft under "Proposed docs":** approved to save and refine from.

Settled while refining, from the code:

- **How the list reads:** as "Proposed docs" shows it. The sketch above it, under "What the pull request shows", came first.
- **The ticket system's and the board's part:** the job is "Open the ticked tickets" (`follow-ups`) in `run.yml`. It runs with the workflow's own token, and the `board` job waits for it, so the sync that a merge already starts adds the new tickets' cards. The command does not start a sync of its own.
- **Which boxes count:** those ticked in the event GitHub sent when the pull request merged. So running the job again opens what is missing, and a box ticked since stays ignored.
- **What a ticket says:** the item's title and text as they read then, and `Noticed while building #88, in pull request #90.`, or `Noticed in pull request #90.` where the pull request is for no ticket. It carries the factory label.
- **What stays as it was:** "fix 1" needs no new command. Prepare also hands an answer the pull request's body, so a session in the cloud can read the list.
- **A build with no pull request:** lists nothing. Its stop says why it stopped.
- **A review's own run:** can't list a follow-up. What it finds is a finding.
- **A step that the owner is in the session for,** such as a refinement: the session says what it noticed, and opens a ticket only when the owner says so. No command does it unasked.
- **`factory ticket link N --part`:** stays, for a ticket across repositories.
- **Build order:** #70 also reads the follow-ups label. Neither waits on the other, since whichever is built second drops what the first left.
- **Where it is built:** on a person's machine. It changes a file under `.github/workflows/`, which a build in the cloud can't push.

## What Changes

A build lists what it noticed in its pull request, three items at most, each unticked. When the pull request merges, a job with no AI opens a ticket for each ticked one. The Follow-ups ticket and its label go away.

## Capabilities

### New Capabilities

- `follow-ups`

### Modified Capabilities

- `board-sync-trigger`
- `factory-label`
- `labels-setting`
- `prepare`
- `publish`
- `refined-check`
- `remove`
- `ticket-fields`
- `ticket-keys`
- `ticket-repositories`
- `workflow-files`

## Impact

Every repository that uses the factory. A settings file that names `tickets.labels.follow-up` fails until the line is deleted.
