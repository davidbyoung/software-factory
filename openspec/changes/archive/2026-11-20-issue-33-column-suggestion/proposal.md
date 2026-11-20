# Proposal

From [davidbyoung/software-factory#33](https://github.com/davidbyoung/software-factory/issues/33).

## Why

Today a developer whose board has its own columns maps each of the factory's six states to one of them by hand, in `tickets.columns`. `factory init` could instead ask the developer's coding agent which column shows each state, show the answer, and let the developer accept it, change some of it, or refuse it, saving a manual step while staying overridable when the agent gets it wrong.

The process is written to two interfaces, so another coding agent, such as Codex, or another ticket system, such as Jira, plugs in without an edit to `init`: a coding agent answers one question, and a ticket system lists a board's columns.

Jira gives each issue type its own workflow, which the owner's question "how do we handle multiple workflows per issue type?" asks about. Each state under `tickets.columns` takes one name or a list. A ticket in any listed name is in that state, and a move writes the first listed name. That covers Jira's shared statuses and Linear's one workflow per team without a setting keyed by issue type.

## What Changes

- `factory init`, choosing an existing board that lacks one of the factory's six columns, with no `tickets.columns` in the settings, asks the coding agent for a mapping and shows it as `factory board check` would: `Yes` saves it, `Change some` edits states one by one, and `No` adds the factory's columns as today.
- Init stops with exit 1, having changed nothing, when the agent is not installed or its answer can't be used, and says why.
- Re-running init to turn on builds from the board, with `ready: none` in the settings, asks for a ready column instead of failing.
- After `Go ahead?`, the board gains only the columns the chosen mapping needs.
- Each state under `tickets.columns` except `ready` takes a list of names. The board sync, `factory status`, `factory board check`, `factory doctor`, and `factory config explain` read lists; `factory config check` refuses an empty list, a list for `ready`, and a name repeated.
- A coding agent gains an `answer` method; a ticket system's board gains `columns`.
- `docs/existing-repo.md`, `docs/configuration.md`, `docs/design.md`, and `docs/developing.md` describe it.

## Decisions

- **Where the suggestion comes from:** the coding agent, asked once with no tools, through an `answer` method every coding agent registers. Claude Code is the only one built. Every line init prints names the agent by its registered label, so Codex adds one method and no edit to `init`.
- **No agent, or an answer that can't be used:** init stops with exit 1 and changes nothing. It never shows the factory's own names as if they were a suggestion.
- **Correcting the suggestion:** init shows the whole table and asks once. "Change some" asks only about the states you pick.
- **Several workflows:** each state under `tickets.columns` takes one name or a list. An optional `columns-by-type` key, holding only exceptions, is recorded in `docs/design.md` as _Planned_.
- **`ready` takes one name,** since only an approved ticket goes there, so the poller and `FACTORY_READY_COLUMN` are unchanged.
- **Turning on builds from the board later, with `ready: none` in the settings:** init asks for a ready column rather than stopping.
- **Init suggests one column per state;** a list is written by hand.
- **A fresh suggestion after a board changes:** delete the `columns` block and run `factory init` again. No new command.
- **What is sent to the agent:** the board's column names, each state's key and meaning, and whether builds start from the board. There is no consent question.
- **The plan's `Board` line is unchanged.**
- **Init's stop messages carry no docs link.**

## Capabilities

### New Capabilities

- `column-suggestion`: init's column step.
- `board-columns`: what `tickets.columns` means, with lists.

### Modified Capabilities

- `config-explain`: a list prints as a YAML list.
- `tool-setup`: init's unchanged-output requirement names the column step as an exception.

## Impact

`src/init.mts`, a new `src/columns-suggest.mts`, a new `src/agent/types.mts`, `src/agent/claude-code.mts`, `src/tools.mts`, `src/tickets/types.mts`, `src/tickets/github.mts`, `src/config.mts`, `src/lib/work-status.mts`, `src/board.mts`, `src/status.mts`, `src/explain.mts`, `src/ticket.mts`, `src/poller.mts`, `settings.schema.json`, and the docs above.
