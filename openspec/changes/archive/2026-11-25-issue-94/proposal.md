# Proposal

From [davidbyoung/software-factory#94](https://github.com/davidbyoung/software-factory/issues/94).

## Why

Where the ticket system has text fields and the settings name none, `factory init` asks the coding agent which fields hold a ticket's Decisions, Spec, Acceptance criteria, and For the builder. When the agent fails, is signed out, times out, or gives an answer that can't be used, init stops with exit 1, so the repository can't be set up. The column step already asks the person instead in that case.

**Done when**

- When the agent's answer can't be used, init says why, asks the person which ticket field holds each of the four, with the description as the default, and goes on.

**Where**

- `suggestFields` in `src/ticket-fields.mts`, as `suggestColumns` and `chooseColumns` do in `src/columns-suggest.mts`.
- The spec is `field-suggestion`, "A field answer that can't be used", which this makes false, and `column-suggestion`, "An answer that can't be used", is the pattern.

Decided by the owner on 2026-11-24: ask by hand. Moved here from #4, where it was found while building #74.

Decisions:

- **Does init say what each part holds before it asks?** Yes: the table of what each factory field holds, and the line under it. Claude Code is told this when it is asked, and the names alone don't say it.
- **Does the last question offer "No: keep everything in the description"?** No, only Yes and Change some, as the column step does by hand.
- **Which choice does each question start on?** The description, as the ticket says, for Acceptance criteria too, even when Spec was given a field.
- **Repositories:** this one alone. Nothing blocks this, and it blocks nothing.
- **Track:** `spec`. Code and docs together pass 30 lines, and it changes what `factory init` prints and how it exits.

## What Changes

- `factory init`'s field step asks by hand when the agent's answer can't be used, in place of stopping.

**Not doing:**

- No change to which answers can be used, to each reason's wording, or to a suggestion that can be used.
- No change to init stopping when the ticket fields can't be read.
- No way to ask the agent again in the same run, and the agent is asked even when the column step just got no answer from it.
- No change to the column step.

## Capabilities

### Modified Capabilities

- `field-suggestion`: an answer that can't be used no longer stops init.
- `docs`: the existing-repo page says so.

## Impact

`src/ticket-fields.mts`, `src/init.mts`, and `docs/existing-repo.md`.
