# Proposal

From [davidbyoung/software-factory#53](https://github.com/davidbyoung/software-factory/issues/53).

## Why

`.claude/factory.yaml` doesn't require the ticket status mapping: a state left out of `tickets.columns` falls back to the factory's own column names, Backlog, In refinement, Ready, In progress, In review, and Done. Those are one board's names. On any other board, a state left to them is read wrong without a word, until `factory board check` flags it. `factory init` already sets the mapping up, so it should always be required in the settings, written by init, rather than falling back.

## What Changes

- With a board, `tickets.columns` names all six states, each a column, a list of columns, or `none`, and every command that reads the settings stops on a block that leaves one out.
- `factory init` always writes all six states, and a re-run on an older file fills in only the missing ones.
- A poller you host needs `FACTORY_READY_COLUMN`, which no longer defaults to Ready.
- The docs say so, and `docs/updating.md` gains "Naming every column" for a repository set up earlier.

## Decisions

- **The setting keeps its name.** It stays `tickets.columns`, not `tickets.statuses` (the owner, in the session).
- **All six states are required with a board, with no fallback.** Each is a column, a list of columns, or `none`. Without `tickets.board`, nothing changes: `tickets.columns` is still refused without it.
- **One error for the whole block,** naming every state left out, not one per key that stops on the first.
- **No settings version bump.** The file's shape doesn't change; init writes the new lines.
- **`factory init` always writes all six states:** when it creates the board, when the board already has the factory's columns (no question, the board's spelling), and for each answer of the suggestion (Yes, Change some, and No).
- **An existing repository moves by re-running `factory init`.** Init accepts a file whose only fault is a missing state, keeps what is written, fills in a missing state from the board's column of the factory's name without asking, and asks only for one the board lacks. `docs/updating.md` gets "Naming every column". The update's `factory-deps` run stops and opens an issue, as it does today for a settings failure.
- **`FACTORY_READY_COLUMN` is required for a poller you host.** It has no settings file, so it had its own "Ready" default. `factory board check` prints the value on the ready row for every `own-server` board, Ready included.
- **The board fields keep their fallback names.** Session, Runs in, and Cost under `tickets.fields`: init adds those fields to every board, and a board almost never has its own field for them, so the fallback misreads nothing. Out of scope.
- **The rule applies to the settings in effect,** after presets, so a preset can supply the block. `factory preset check` doesn't require columns of a preset on its own.
- **The JSON schema doesn't require the block.** It reads one file, and a preset can supply the block, so only the settings check, which reads the settings in effect, requires it. The schema stops describing defaults.
- **With no board, comments and `factory status` keep naming a state by its own name** (Backlog, In progress, and so on), as today. Those are the states' names, not a mapping, and `factory config explain` prints no columns without a board.
- **No blocker.** #37 and #54 also change settings in `src/config.mts`, but neither breaks or redoes this work: a merge conflict at most.
- **The release is the owner's,** and its notes need two lines: "Naming every column" in `docs/updating.md`, and `FACTORY_READY_COLUMN` now required for a self-hosted poller. That is at release time, not a step this build waits on.
