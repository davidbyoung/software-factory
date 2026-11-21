# Tasks

## 1. Shared color

- [x] 1.1 Add `src/lib/color.mts` with `colorOn`, `Paint`, and `painter`. In `tests/color.test.ts`, with `vi.stubEnv` and a `stream.Writable` as the fake: not a terminal with `FORCE_COLOR=1` gives `true`, and with `FORCE_COLOR` unset, `false`; `FORCE_COLOR=0` and `FORCE_COLOR=yes` give `false` even with `isTTY: true`; `isTTY: true` and `getColorDepth: () => 8` with no `FORCE_COLOR` gives `true`, and with `getColorDepth: () => 1`, `false` (how a real terminal reports `NO_COLOR` and `TERM=dumb`). `painter(false)` returns the text unchanged; `painter(true)` returns `styleText`'s codes. Lines 1 to 4.

## 2. doctor and init

- [x] 2.1 `line(c, paint)` in `src/doctor.mts`, and `paint` in `DoctorDeps` and `doctorDeps`. In `tests/doctor.test.ts`: with a painting `paint`, each of the four states colors its mark with line 6's color and a failing check's text and fix carry no codes; with codes stripped, each line equals `line(c)`. Lines 5 and 6.
- [x] 2.2 init's `Checks` loop passes its `paint`. In `tests/init.test.ts`, with color on, a check line is colored and the `Left to do` lines carry no codes. Line 7.

## 3. board check

- [x] 3.1 `boardReport`'s `paint` parameter, and `paint` in `board.mts`'s `Deps`. In `tests/columns.test.ts`, beside the existing `boardReport` tests: a board with a missing column, a skipped field, a `none` field, a note, and a problem, painted, colors each as line 8 says; stripped, it equals the plain report. Line 8.

## 4. preset add and remove

- [x] 4.1 `paint` in `PresetDeps`, used where the summary rows and group titles are built. In `tests/preset-commands.test.ts`, with color on: `add`'s summary has a bold heading, a green `+` row, and a dim old and bold new value, with disagree and replaced-by-yours rows uncolored; `remove`'s has a red `−` row and its `, from PRESET` uncolored; stripped, each equals today's summary. `remove`'s `back to a value you chose against` row has a dim old and bold new value. With `terminal: false` and color on, the summary is still colored. Lines 9 and 10.

## 5. config explain

- [x] 5.1 `paintExplainLines` in `src/explain.mts`, applied at both print sites in `config.mts`. In `tests/config.test.ts`: a `# default` line is dim whole, a comment line dim whole, a preset-marked line dim only from its `# `, an unmarked line uncolored, and an unmarked line whose quoted value holds ` #` uncolored, and with settings that set most values themselves, so comment lines outnumber marked ones, every mark still dim; the same through the lock path, in `tests/preset.test.ts`'s lock tests. Lines 11 and 12.
- [x] 5.2 In `tests/preset-commands.test.ts`, the lock written while color is on holds no escape code, and plain explain output equals the lock's `settings` lines. It passes before the change, so prove it with one mutation, painting `explainLines`. Lines 14 and 15.

## 6. status

- [x] 6.1 Move `src/status.mts`'s `paint` onto `styleText`, and `styleFor` onto `colorOn`. Update `tests/status.test.ts`'s expected strings to be built with `styleText`, and its `styleFor` table to the new signature. Every existing status assertion still holds in substance: the same groups, colors, and links, in `styleText`'s bytes. Line 13.

## 7. Docs

- [x] 7.1 Add the `docs/cli.md` paragraph under "Other docs pages that change", after the paragraph that begins "Run any command as `factory`". `tests/docs.test.ts` passes.

## 8. Verify

- [x] 8.1 Map each Spec line, 1 to 15, to the test that exercises it, and write a test for any line without one.
- [x] 8.2 Run `doctor`, `board check`, `preset add --dry-run` against a fixture preset, `config explain`, and `status` in a terminal, in a dark and a light theme, and put them beside the Proposed docs transcripts in the pull request.
- [x] 8.3 Run the gate, `npx --no-install factory gate`. There is no end-to-end suite here.
- [x] 8.4 In `tests/color.test.ts`, each command's own deps (`doctorDeps`, `presetDeps`, config's `defaultDeps`, `boardDeps`, and status's `terminalStyle`) colors with `FORCE_COLOR=1` and stays plain with `FORCE_COLOR=0`. init's deps are built only inside its interactive `run`; that gap is a line on the follow-ups issue.
