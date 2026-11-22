# Proposal

From [davidbyoung/software-factory#60](https://github.com/davidbyoung/software-factory/issues/60).

## Why

A ticket is a number everywhere above the ticket adapter: the interface, the commands, the claim files, the runner's input, and every `#N` the skills write. Jira and Linear name a ticket by a key, such as `PROJ-12`, so adding one of them would mean changing far more than an adapter. This change makes a ticket's identity its key, as text, and moves how a ticket is written and linked into the adapter.

## What Changes

- Every ticket ID is a `Key`, text; the adapter parses a typed key, writes a ticket (`#12`), writes the link lines (`Closes #12`, `Part of #4`), and reads them from a pull request's body.
- New: `factory ticket view N --field ref`, `factory ticket link N --part`, `factory pr cost N`, and `factory review tickets N`.
- The review reads tickets with the base commit's factory; its tool list moves there too.
- The skills, agents, rules, and review instructions write no `#N`, `Closes #N`, or "GitHub issue".
- On GitHub, nothing a user types or reads changes.

## Capabilities

### New Capabilities

- `ticket-keys`

### Modified Capabilities

- `branch-name`

## Decisions

- A ticket's identity is always its full key (the owner, 2026-11-22, before refinement).
- The developer experience is the one under "Proposed docs", which the owner approved as drafted on 2026-11-22, with each recommendation kept.
- Skills get a ticket's written form from `factory ticket view N --field ref`, so a follow-up line still reads "while building #12" and GitHub still links it.
- Another GitHub repository's ticket is written `octo/web#4`, as GitHub writes and links it. #57's example `web#4` is superseded.
- The review reads the tickets a pull request builds from `factory review tickets N`, run by the review workflow from the base commit's own install, so a pull request cannot change what its own review is told. The cost is one more `npm ci` per review.
- The same base install lists the review's tools (`factory review tools`), which today runs from the pull request's head, so a pull request can no longer widen the commands its own review may run by changing that code.
- Open question "`owner/repo#12`": yes, as above. #60 parses that form and prints it for a blocker in another repository; every other command refuses it, and building, claiming, or commenting on another repository's ticket stays #57's.
- Open question "the build workflow's input and run name": the `ticket` input is text. The run name stays `Build #12` on GitHub; `factory sync` writes `Build ${{ inputs.ticket }}`, without `#`, for a ticket system whose tickets are written without one. `factory build` finds the run by that name.
- Open question "`factory specs change-name N`": already settled by #58, which names a change from the key lowercased, `issue-proj-12`. The code does not change; the `branch-name` spec's wording of it does (Spec line 32).
- Open question "two skills read the first column of `factory ticket list`": `factory-deps` and `factory-resolve-conflicts` take that column as text with `cut -f1`, so a key works there unchanged. Their `#N` titles name a pull request and stay. The `ticket-order` skill, this repository's own, reads `--json` and `blockers` lines and changes with them.
- Open question "the order tickets are listed in": by key, letters first and then the number as a number, so `PROJ-9` comes before `PROJ-12`, and GitHub keeps number order. The poller starts Ready tickets in the same order until #61 gives it the board's.
- `--json` output carries `key` and `ref` where it carried `number`. Only the `ticket-order` skill reads it.
- Which tickets a pull request closes: when the tickets are the code host's own (GitHub issues and GitHub pull requests), the code host's list, which already holds a body's registered `Closes #12`, a ticket linked in GitHub's sidebar, and `Fixes #12`, so the build's check that GitHub registered the link keeps its meaning. Otherwise the adapter's reading of the body. Which tickets it builds part of is always the adapter's reading of the body.
- With tickets that are not the code host's own, the sync reads no closed pull requests, since only the code host's own links say which closed ones built a ticket. A ticket's Cost then counts its open pull requests and its own comments. Finding the closed ones is #63's, through the ticket system's own record of linked pull requests.
- A pull request's row in `factory status` shows no Cost, as in effect it does today: its lookup used the pull request's number on a board that holds only tickets.
- `factory-trace` runs before the pull request is marked ready: the change edits code "Changing the process: this repository" names (`sync.mts`, `board.mts`, `poller.mts`, `review-tools.mts`, `lib/work-status.mts`), the review workflow, and the poller's start order.
- Build order: #57, #61, and #63 wait on this ticket, recorded already. This ticket waits on none.

**Not doing:**

- Acting only on tickets with the factory label, and moving a ticket through its system's states: #61.
- Credentials for a ticket system other than GitHub, the review job's included: #62.
- The Jira adapter, and finding the closed pull requests that built a Jira ticket: #63.
- Building, claiming, commenting on, or recording a blocker in another repository's ticket: #57.
- A Cost on a pull request's own row in `factory status`.
- Accepting `#12` for `12` on GitHub: it fails with line 2's message, as a shell would read an unquoted `#12` as a comment anyway.
