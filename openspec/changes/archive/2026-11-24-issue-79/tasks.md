# Tasks

## 1. The printer and the prompts

- [x] 1.1 `src/lib/output.mts` with the roles, the line kinds, the automatic coloring, and the printers; `src/lib/color.mts` folded in. `tests/output.test.ts` (new): one test for each kind and each automatic rule, the false matches above included, and that `render(line, true)` with its codes out is `render(line, false)`; `tests/color.test.ts` still passes on `colorOn`.
- [x] 1.2 `src/lib/prompts.mts`: the theme, `terminalAsk`, `readSecret`, and the typed question. The `readSecret` tests in `tests/init-shared.test.ts` move with it, and one asserts the theme's marks and colors.
- [x] 1.3 `reads` on each `COMMANDS` entry, `printersFor`, and `COMMANDS` in its own module. `tests/cli.test.ts`: every usage entry is a person's but the six, and each of the six, and one `ticket` and one `pr` command, print no code with `FORCE_COLOR=1`.

## 2. The stand-in and the boundary

- [x] 2.1 `tests/printed.ts` (new): the stand-in every command's test prints through. It keeps the plain lines, as the `out` arrays the tests hold today, and the colored ones, and fails on a `text` whose plain form looks like a row (`/^\s+\S.*?\S {2,}\S/`) or a step (`/^\s*\d+\. /`). A test of its own feeds it one of each and sees it fail.
- [x] 2.2 `tests/boundary.test.ts`: no file under `src/` but the two, and no file under `bin/` but the launcher, holds `console.`, `process.stdout.write`, `process.stderr.write`, `styleText`, an escape character in code that prints, or an import of `@inquirer/prompts`; and no test but `tests/printed.ts` and `tests/output.test.ts` imports `render`. Reading an escape, as `src/runner/github-actions.mts` does to strip them, is let through.

## 3. The commands

- [x] 3.1 `doctor`, `board check`, and `init`'s checks: `tests/doctor.test.ts`, `tests/board.test.ts`.
- [x] 3.2 `init`, `init --org`, the column and ticket field steps, and `init-shared`: the transcript tests in `tests/init-organization.test.ts` and `tests/init-org.test.ts` also assert the marked transcripts above, with the codes written as marks.
- [x] 3.3 The `preset` commands and `config explain`: `tests/preset-commands.test.ts`, `tests/config.test.ts`.
- [x] 3.4 `status`: `tests/status.test.ts`, lines 22 to 24 and the headings.
- [x] 3.5 `update`, `remove`, `sync`, `gate` and its siblings, `build`, `pr watch`, `site`, `config check`, and the usage: each command's own test file.
- [x] 3.5a The machine's commands: every other file under `src/` that holds a `console.` or a `process` write moves to `plainPrinter`, its text unchanged. Their own tests pass as they stand, and 2.2 finds any left.
- [x] 3.6 The launcher: `tests/launch.test.ts`, lines 20 and 26.
- [x] 3.7 Line 3: a test that gives a command a colored standard output and a plain standard error, and one that the real printers are made from their own streams.

## 4. The docs

- [x] 4.1 `docs/developing.md`, "A command's output", and `docs/cli.md`'s paragraph on color, as Proposed docs has them, and the new files under "The folder". `tests/docs.test.ts`: the table's first column is the keys of `ROLES`, each in backticks, one row each and in its order.

## 5. Verify

- [x] 5.1 Map each Spec line to the test that exercises it, and write one for any line without.
- [x] 5.2 The pull request's "Mockup and result": each transcript printed by the real command or its test fixture with color on, beside its mockup, dark and light.
- [x] 5.3 `factory gate`, and coverage has not dropped.
