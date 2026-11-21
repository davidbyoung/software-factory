# Tasks

## 1. Usage

- [ ] 1.1 `group` and `summary` in `src/cli.mts`, and `usage()`. In `tests/cli.test.ts`, rewrite the tests that expect the old usage, and add: `factory` alone prints the five groups and the link and exits 2; `factory frobnicate` and `factory ticket frobnicate` print `factory has no command "..."` first; `factory --help` prints no such line. Lines 1 and 2.
- [ ] 1.2 In `tests/cli.test.ts`, beside the test that routes every command `docs/cli.md` lists, the usage's commands equal those under the five headings, matched by their words. Line 3.

## 2. Success lines

- [ ] 2.1 `sync` and `sync --check` in `src/sync.mts`; tests in `tests/sync.test.ts` for lines 4 to 6, `doesn't` for one file, and that `init`'s and `preset add`'s output has no line 4 sentence.
- [ ] 2.2 `config check` in `src/config.mts`; a test in `tests/config.test.ts` for line 7, with and without a warning.
- [ ] 2.3 `stopMessage` in `src/site.mts`; a test of both texts in `tests/site-servers.test.ts`, beside `stopKept`'s. Line 28.
- [ ] 2.4 `gate`, `test-one`, `end-to-end`, and `specs check` in `src/commands.mts`; tests in `tests/commands.test.ts` for lines 29 to 32 and the `commands` lines, with `npm_config_loglevel` passed and kept when set, the streams of each line, and `specs are off` alone. The existing test of the gate's failure text is rewritten.

## 3. board check

- [ ] 3.1 `inspectBoard`'s per-row results and `boardReport`'s rows in `src/board.mts`. In `tests/columns.test.ts`, rewrite the board check report tests to the new rows, one test per case of lines 8 to 19, and line 38's list row; the sync's `skipped` handling still passes `tests/board.test.ts`.
- [ ] 3.2 Colors in the existing color test in `tests/columns.test.ts`, and the `terminal-color` lines.
- [ ] 3.3 `doctor`'s board line and the sync's `apply` log keep their words: the existing tests in `tests/board.test.ts` pass unchanged, and those in `tests/doctor.test.ts` change only in the fix (`Run factory init`). Line 34.
- [ ] 3.4 `src/columns-suggest.mts`'s words; `tests/columns-suggest.test.ts` and `tests/init.test.ts` updated for the `column-suggestion` line.

## 4. doctor and init

- [ ] 4.1 `group` on `Check`, set in `checks()`, and `printChecks`. In `tests/doctor.test.ts`, rewrite the expected outputs to the grouped form; add tests for line 20's order and empty groups, line 21's placement of a preset, `.npmrc`, and ticket field check, line 23, and line 24 with a missing and a shared secret.
- [ ] 4.2 Drop the tool's name from its checks, the sign-in text, and `npx --no-install` from every message line 25 names; `tests/doctor.test.ts`, `tests/init.test.ts`, `tests/preset-commands.test.ts`, and the tool tests for lines 22, 25, 33, and the `tool-configuration`, `tool-setup`, and `npm-registry-secrets` lines; `tests/session-start.test.ts` and `tests/npm-sync.test.ts`, which quote the kept `npx` messages, pass unchanged; the fake agent's under `Fake Agent`.
- [ ] 4.3 `init`'s closing checks through `printChecks`; `tests/init.test.ts` snapshots updated for lines 26 and 47.

## 5. config explain

- [ ] 5.1 The two header lines at the print site. In `tests/config.test.ts` and `tests/preset.test.ts`, line 27 for both paths, and the `config-explain` lines against the lock.

## 6. Docs and guides

- [ ] 6.1 `docs/developing.md`'s new section, the `dx-first` skill's line, `CLAUDE.md`'s "Rules by area" words, and every docs page under "Docs that quote changed output". `tests/docs.test.ts` passes, and a grep of `docs/` and `README.md` for `gate failed on`, `prints nothing`, `out of sync`, and `Status     written` finds no quote of the old output.

## 7. Verify

- [ ] 7.1 Map each Spec line, 1 to 52, to the test that exercises it, and write one for any line without.
- [ ] 7.2 Run each changed command in a terminal, dark and light, and put the output beside the Proposed docs transcripts in the pull request.
- [ ] 7.3 Run the gate, `npx --no-install factory gate`. There is no end-to-end suite here.
