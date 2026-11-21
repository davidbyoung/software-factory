# Proposal

From [davidbyoung/software-factory#34](https://github.com/davidbyoung/software-factory/issues/34).

## Why

Today `factory-refine` writes everything it settles into the ticket's description: Decisions, a Spec or Acceptance criteria, Mockups, and For the builder. A team whose tickets already have their own fields, such as an "Acceptance criteria" field filled in by hand, wants those parts written there. As in #33, `factory init` asks the coding agent which of the tickets' fields fits each part, shows the answer, and lets the developer accept, change, or refuse it, with the description as the default.

The owner's question, how to handle trackers with several field configurations per ticket type, is answered by the field's name, with no setting per issue type: a ticket that can't hold a field keeps that part in its description.

## What Changes

- `factory init` stops before its first question when the coding agent's command isn't installed.
- `factory init`, when the tickets have text fields and the settings name none of the four ticket-side keys, asks the coding agent which ticket field should hold Decisions, Spec, Acceptance criteria, and For the builder, and shows the answer: `Yes` saves it, `Change some` edits factory fields one by one, and `No` keeps everything in the description.
- `tickets.fields` gains the keys `decisions`, `spec`, `acceptance-criteria`, `for-the-builder`, and a key per heading of the repository's own, valid without a board.
- `factory ticket view` joins a ticket's description and ticket fields into one document, and `factory ticket edit` splits it, so skills and agents see the body they see today.
- The ticket system gains an optional `fields` group; GitHub's are issue fields of the text type.
- `factory doctor` and init's checks report a ticket field the tickets don't have, or one that doesn't hold text.
- `factory config explain` prints the ticket-side keys without a board.
- `docs/existing-repo.md`, `docs/configuration.md`, `docs/github/setup.md`, `docs/quick-start.md`, `docs/skills.md`, `docs/design.md`, and `docs/developing.md` describe it.

## Decisions

- **Where a factory field can go on GitHub:** a text [issue field](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization), never a board field. A test on this repository wrote values into both. A board text field refused anything over 1,024 characters. A text issue field accepted 256 KB and stored it whole, returned 12 KB of #33's Decisions and Spec exactly, apart from GitHub dropping the final newline, and took a value while pinned to no issue type. The `repo` scope lists a repository's issue fields and their pins and sets values; only creating a field needs `user` or `admin:org`.
- **Build it for GitHub now, with Jira _Planned_,** as #33 did. GitHub shows an issue field's text as typed, without Markdown formatting, and init says so above its table. Keeping the factory field in a comment, with only its link in the ticket field, was turned down: it adds a comment the factory has to keep track of, only to work around how GitHub shows fields.
- **The words:** what refinement writes under a heading (Decisions, Spec, Acceptance criteria, For the builder) is a factory field; a field of yours on the ticket that holds one is a ticket field. Init's table is headed `Factory field` and `Ticket field`, and its question is `Use these ticket fields?`.
- **The setting is `tickets.fields`,** which already maps Session, Runs in, and Cost to board fields. It gains `decisions`, `spec`, `acceptance-criteria`, and `for-the-builder`, each a ticket field's name or `none`, which keeps the factory field in the description, as does leaving the key out. These keys don't need `tickets.board`, and none is filled in by a ticket field's name alone. A heading of the repository's own, such as `## Proposed docs`, can be added by hand, as its words in lowercase joined by hyphens (`proposed-docs`); init never suggests one, nor Mockups.
- **Where the suggestion comes from:** the coding agent's `answer` method from #33, given the ticket fields that hold text, with their names and descriptions, and what each factory field holds. It is told to answer the description when no ticket field clearly fits. When the tickets have no text field, init asks nothing and doesn't call the agent.
- **What init writes:** one line for each of the four factory fields, `none` for one that stays in the description, so a later run sees it has asked. `No: keep everything in the description` writes all four as `none`. Init asks only when the settings name none of the four.
- **Init requires the coding agent (the owner's call while drafting):** it stops before its first question, exits 1, and changes nothing when the agent's command isn't installed. This drops the "not installed" text under Found and init's API-key fallback, changes `tool-setup`'s "Init is unchanged with today's tools", and changes #33's Decision "No agent, or an answer that can't be used" for its no-agent half: the column step no longer meets a missing agent. Whether the agent is signed in is found when it is first asked, as now.
- **An answer that can't be used stops init** with exit 1 before the plan, as #33's column step does, with #33's reasons reworded for fields.
- **Sharing a ticket field:** two factory fields can't name the same one, except Spec and Acceptance criteria, since a ticket has only one of them. A ticket field holds its factory field's text without the heading; `factory ticket view` adds the heading back, and reads a ticket field that Spec and Acceptance criteria share as Spec when the ticket has the `spec` label when read, and as Acceptance criteria otherwise, as `factory ticket refined` reads the label. A file with both sections for a shared field is refused rather than one being lost.
- **Skills and agents don't change:** `factory ticket view` joins the description and the ticket fields into one document, and `factory ticket edit` splits it, so `factory-refine`, `factory-build`, `factory-ticket-readiness`, and `factory ticket refined`'s check see the body they see today.
- **Several field configurations per ticket type (the open question):** by the ticket field's name, with no setting per issue type, as #33 answered several workflows. What varies by type is whether a ticket can hold a field: on GitHub every issue can hold every field, and on Jira a factory field that a ticket's type can't hold stays in its description, with a line from `edit` saying why. A list of ticket fields for one factory field, and a `fields-by-type` key holding only exceptions, are recorded in `docs/design.md` as _Planned_.
- **Changing the setting later:** a ticket refined before keeps its factory fields where they were written, and nothing tracks where they used to be. The docs say to refine the ticket again or move the text by hand.
- **The interface:** an optional `fields` group on the ticket system, `FieldOps` in Proposed docs' "For contributors", with `factory ticket supports fields`. The prompt, the checks, the table, and the split and join live in one module that names no agent and no ticket system.
- **Failures are said, not hidden:** reading the ticket fields failing stops init, as reading a board's columns does; settings that name a ticket field with a ticket system that has no fields group make `view` and `edit` exit 1 naming the group, rather than fall back to the description quietly.
- **Blockers:** none. #33 is merged, as #38. #37 (no spec tool) also touches what refinement writes, but neither has to be built first; a conflict between them is a merge conflict.

## Capabilities

### New Capabilities

- `field-suggestion`: init's field step.
- `ticket-fields`: what `tickets.fields`' ticket-side keys mean, and the join and split.

### Modified Capabilities

- `tool-setup`: init requires the coding agent, and its unchanged-output requirement names the field step as an exception.
- `column-suggestion`: the column step's own not-installed stop goes.
- `config-explain`: the ticket-side keys print without a board.

## Impact

`src/init.mts`, a new `src/ticket-fields.mts`, `src/columns-suggest.mts`, `src/agent/claude-code.mts`, `src/tickets/types.mts`, `src/tickets/github.mts`, `src/tickets/index.mts`, `src/tickets/github-setup.mts`, `src/ticket.mts`, `src/config.mts`, `src/explain.mts`, `settings.schema.json`, `tests/memory-tickets.ts`, and the docs above.
