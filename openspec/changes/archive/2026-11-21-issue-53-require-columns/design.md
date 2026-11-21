# Design

## Where it goes

- `src/config.mts`: `columnNames` stops falling back to `DEFAULT_COLUMNS` and collects every state left out, failing once with line 2's or 3's message; `parseSettings` fails with line 1's when `hasBoard` and `tickets.columns` is undefined. Without a board, `Settings.tickets.columns` keeps holding the six state names, as today, so comments and `factory status` are unchanged (Decisions). Throw these as a `SettingsError` subclass, such as `ColumnsMissing`, so init can tell them from any other fault. Validation reads the settings in effect, after presets (line 5), which `loadSettings` already passes to `parseSettings` (`config.mts:1052`).
- `src/init.mts`: the load at `init.mts:209-222` reads a file that fails only by `ColumnsMissing` (line 13), by a `parseSettings` option that lets `tickets.columns` leave states out, used by init alone; `standing()` the same. The column step's `suggests` condition (`init.mts:462`) becomes "the block is missing, or lacks a state". Under that option a missing state is absent from the written block and listed in a `missing` field beside the settings, never `null`, which means `none`; `columnsOf` is not called on it until the block is whole. So `asksReady` (`init.mts:458-461`) stays a question about a written `ready: none` only, and a missing `ready` goes through lines 14 to 16, whose question offers no `No column` for ready when builds start from the board, as `Change some` does. Lines 14 to 16 are a new branch beside `askReady`, reusing `Change some`'s per-state question and the table from `src/columns-suggest.mts`. Line 12: `init.mts:543` writes `ready: Ready` instead of removing `ready`. Line 21: the poller lines at `init.mts:860-870`, pinned by `tests/init.test.ts:1006`, `:1012`, and `:1144`.
- `src/columns-suggest.mts`: `written()` returns all six states (line 9), and `"default"` (the No answer, `columns-suggest.mts:322`) becomes the six factory names written (line 11), as does a created board (line 7), a board with every column (line 8), and a board with no columns (line 18).
- `DEFAULT_COLUMNS` (`src/lib/work-status.mts`) stays, as the names init gives a column it adds and the state names with no board. No path may read it for a state of a board's settings: `columnNames` (`config.mts:548`), `columnsOf` (`config.mts:1241`, which can stop spreading it once every state is set), and `columnsFrom` (`poller.mts:79-83`) are the ones that do today. The other uses are default parameters and init's `boardShape` for a board it creates; check each with a search when done.
- `src/board.mts:288-296`: drop the `ready !== DEFAULT_COLUMNS.Ready![0]` condition (line 23).
- `src/poller.mts`: `readConfig` adds `FACTORY_READY_COLUMN` to the names it requires and returns it; `columnsFrom` takes it with no `|| "Ready"`. `once` already passes the settings' ready column.
- `settings.schema.json`: drop `Default: ...` from each state's description and reword the block's description (line 24). No `required`: a preset can supply the block. `tests/settings-schema.test.ts` checks the schema against the code's keys.
- `skills/factory-deps/SKILL.md`, the paragraph at "When the sync itself fails on the settings after the update". It already stops and opens an issue naming the error (its step 6); only the pointer changes: a release can need new lines in the settings, as version 2 and "Naming every column" do; point at the release's section of `docs/updating.md`, naming both. Then `node bin/factory.js sync`, and commit the copy with the source.
- `.claude/factory.yaml`: add the six states for board 1, which `factory board check` reads as Backlog, In refinement, Ready, In progress, In review, and Done.
- The docs, as line 25 says; their example settings stay version 2.

## Contracts

- Error lines 1 to 3, the init lines 8, 14 to 16, and 21, and the poller log line 19, exactly as the Spec gives them.
- `FACTORY_READY_COLUMN`: required by the hosted poller; the scheduled poller still takes the ready column from the settings.

## States

n/a: no new state. Init's column step gains one branch (lines 14 to 16).

## Edge cases

- A block with `none` values, or a list, counts as written (line 4).
- `ready` left out while `builds.trigger` is `manual` is still a state left out.
- A preset supplies some states and the repository the rest (line 5).
- A board with no columns at all (line 18). On a re-run with a partial block, every missing state is off the board, so line 16 asks for each, offering `No column` where allowed and `Add a column`.
- Init's per-state question when two missing states would pick the same column: the existing message and re-ask.

## Risks and rollback

Every repository with a board and an incomplete block stops on the release's update until someone runs `factory init` or edits the file; the docs and the release notes carry it. Rollback is reverting the pull request: the written blocks stay valid without the requirement.

## Dependencies

None blocks this, and it blocks none. The change to `src/poller.mts` alters when the poller polls, so the fresh-agent trace (`factory-trace`) runs before the pull request is marked ready.
