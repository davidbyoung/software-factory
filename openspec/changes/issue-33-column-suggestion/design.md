# Design

## Where it goes

- **`src/agent/types.mts` (new):** the coding agent's question interface, an `Agent` type with two members. `installed(hasCommand)` says whether its command is on this machine. `answer({ prompt, schema, timeoutMs })` runs one prompt with no tools and resolves to `{ answer }`, the reply shaped by `schema`, or to `{ failed }`, the reason line 7 prints. `src/tools.mts`: `agent: Record<string, Tool & { agent: Agent }>`, with Claude Code's in `src/agent/claude-code.mts`. `tests/fake-tools.ts`'s Fake Agent and `tests/memory-tools.ts` get a scripted one. Distinguish a timeout from a failure in `failed`, so `columns-suggest` can print the two reasons; for example `{ failed: string; timedOut?: true }`.
- **Claude Code's `answer`:** run `claude -p <prompt> --output-format json --json-schema <schema JSON> --tools "" --model haiku` with `cwd` a fresh `mkdtemp` folder, deleted afterwards. Also pass `--setting-sources` with an empty value, if `claude --help` confirms an empty list is accepted; otherwise the empty `cwd` alone keeps project settings out. Kill it after `timeoutMs`. On exit 0, parse stdout and return its `structured_output`. Run `claude` once while building to confirm that `--output-format json` with `--json-schema` returns that field. If it returns the answer only in `result`, as JSON text, parse that instead. On non-zero, return the first non-empty line of stderr, or else of the JSON's `result`. Export `claudeCodeAgent(spawn)` from `src/agent/claude-code.mts` and register `claudeCodeAgent(realSpawn)` in `src/tools.mts`, so tests pass a fake spawn and never run `claude`. The memory registry in `tests/memory-tools.ts` swaps in an agent whose `answer` returns a scripted reply.
- **`BoardOps.columns(number): Promise<string[]>` (new, `src/tickets/types.mts`):** the Status field's options in board order, or `[]` with no Status field. Implement it in `src/tickets/github.mts` from the same project-fields query `addColumns` reads, and in `tests/memory-tickets.ts`.
- **`src/columns-suggest.mts` (new):** names no agent and no ticket system. It exports:
  - `prompt(columns, trigger)`, which builds the prompt from `STATE_KEYS` and each state's meaning, the wording of the table in `docs/workflow.md` "The six states";
  - `schema(columns)`: an object with the six keys required, each a string from an `enum` of the board's column names exactly as given, plus the tokens `__none__` and `__add__`. Tokens rather than the words "none" and "add" keep a board column named None or Add usable. `check` still applies every rule of line 7, since an agent may ignore the schema;
  - `check(answer, columns, trigger)`, which returns the mapping or `{ reason }`, with the reasons of line 7. The answer for each state is a board column name, `__none__`, or `__add__`;
  - `table(mapping, columns)` for line 4, reusing `columnFor` and the row wording of `boardReport` in `src/board.mts`. It always works from the mapping as it stands, picks made in "Change some" included. A column init adds is named by its factory name alone inside `shows in <column>` and the "No column" phrases, without ", which init adds";
  - `suggestColumns(d, ...)`, which runs lines 1 to 13 against `d.ask` and `d.out` and returns the mapping to write, `"default"` for No, or an exit code.
- **`src/init.mts`:** call `suggestColumns` after the poller question (around the `pollMinutes` block), when `parts.has("board")`, `board` is a number, the settings have no `tickets.columns`, and `boardOps.columns(board)` is non-empty and lacks a factory column. Write the result into `doc` at `["tickets","columns"]`. Change the board step to compute `boardShape` from the settings as they will stand, by parsing `String(doc)`, not from `settings`, so line 13 holds. A stop returns 1 before `syncChanges` and the plan. Line 25's question runs in the same place, when `from-board` is newly on and the settings have `ready: none`, before `String(doc)` is parsed, since `config.mts` rejects `ready: none` with a trigger other than `manual`.
- **Settings lists:** in `src/config.mts`, the `Settings` type's `tickets.columns` (line 146) becomes `Record<StateKey, readonly string[] | null>`. A columns-only parser beside `names()` accepts a string or a non-empty array of non-empty strings, and `fields` stays string-only. The checks of lines 17 to 19 go beside the existing duplicate check. `Columns` in `src/lib/work-status.mts` becomes `Record<Status, readonly string[] | null>`:
  - `columnFor` returns the first name;
  - `statusOfColumn` matches any name;
  - `DEFAULT_COLUMNS` holds one-name lists;
  - `columnsOf` maps a string to `[string]`.
- **Each reader of `Columns` follows from that type:**
  - `board.mts`: `inspectBoard` checks every name and `boardReport` joins with `, `. In `planSync`, a `columnsFor(status)` helper beside `columnFor` returns the list `columnFor` picks its name from. It writes `columnFor`'s first name only when `item.status` matches no name in that list, which replaces today's `sameName(item.status, column)`;
  - `init.mts`: `boardShape` adds every listed name;
  - `ticket.mts` and `poller.mts`: `ready` stays one name, read as `columns.Ready?.[0] ?? null`, and `columnsFrom` wraps `FACTORY_READY_COLUMN`;
  - `status.mts`: a group label is the first name;
  - `explain.mts`: one name prints as a string, several as a list.
- **`settings.schema.json`:** each `tickets.columns` key except `ready` takes `string` or `array` of `string` (`minItems: 1`); `ready` stays a string. `tests/settings-schema.test.ts` keeps the schema and `config.mts` in step.
- **Docs:** `docs/existing-repo.md` "You already have a board", `docs/configuration.md` `tickets.columns`, `docs/design.md`, and `docs/developing.md`, as Proposed docs give them. The `developing.md` lines go in "What is built", "Adding a ticket system" (the `board` group), and "Setting a tool up".

## Contracts

- The prompt names the six state keys, each with its meaning, the board's column names exactly as given, and whether ready may be `none`. It asks for a JSON object with each key set to a column name, `none`, or `add`.
- Timeout: 60 seconds. Model: Claude Code's `haiku` alias.
- The settings are written as YAML through `doc.setIn`, keeping comments. A list is written by hand only, never by init.

## States

The column step: suggest → (stop) or table → ask. `Yes` → write. `Change some` → pick states → pick a column per state (back to pick states on a clash) → table → ask. `No` → default. Only `Yes` and `No` leave the loop.

## Edge cases

- Column names that differ only in capitals from the factory's count as the factory's (`sameName`).
- A board column whose name contains a comma prints as it is.
- A board with no Status field returns `[]`, so no question, and the existing board check reports it.
- An answer with extra keys is unusable as "it left out" only if one of the six is missing; extra keys are ignored.
- A re-run with `tickets.columns` set never calls the agent, so a teammate needs no agent.

## Risks and rollback

- The agent's answer varies between runs. You confirm every answer, and a bad one stops init with a reason.
- Claude Code's flags could change. A failed run stops init cleanly, and its first error line says why.
- Rollback: revert the pull request. Settings written with single names stay valid.

## Dependencies

None open. No owner-only steps.
