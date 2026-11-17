# Tasks

## 1. The `rules` setting

- [x] 1.1 Add `rules` to `SETTINGS_KEYS`, `Settings`, `parseSettings`, and `settings.schema.json`. In `tests/config.test.ts`, test lines 1 and 2, including `rules: {}`, each seen red first.
- [x] 1.2 Add `withRules` in `src/sync.mts` and apply it in `plan()`. In `tests/sync.test.ts`, test lines 3, 4, and 5 (the copies are byte-for-byte the package's with the defaults), and that a source missing a phrase throws naming the file, each seen red first.
- [x] 1.3 In `tests/sync.test.ts`, test line 6: change a number, and `sync --check` fails naming the two copies.

## 2. `factory config explain`

- [x] 2.1 Add the `explain` branch and the CLI entry. In `tests/config.test.ts`, test lines 7 and 8 with an inline snapshot of a small file's output, line 9 with `ci-review` and `site` off, line 10 with and without a board, line 11 by stripping the comments and parsing the result, and line 12 with an invalid file, each seen red first or by one mutation.
- [x] 2.2 Change `tests/cli.test.ts`'s unbuilt-command test to an unknown word, and drop `factory config explain` from `tests/docs.test.ts`'s expected planned commands.

## 3. The `factory-trace` skill

- [x] 3.1 Write `skills/factory-trace/SKILL.md`, and point "Changing the process" in `rules.md` at it. Run `node bin/factory.js sync` so this repository's copies match.
- [x] 3.2 In `tests/sync.test.ts`, test line 13, and that the skill names `.claude/change-types.md` and `factory pr comment`, seen red before the file exists.

## 4. Docs

- [x] 4.1 Take off the Planned marks and update the rows under "Checked by review". In `docs/workflow.md`, "under about 30 lines" names the setting: "(30 by default, `rules.small-change-lines`)". `tests/docs.test.ts` passes, and `python3 tests/check-links.py .` resolves every link.

## 5. Verify

- [x] 5.1 Map every Spec line to its test in the pull request body, naming the lines checked by review (14, 15, and 18).
- [x] 5.2 Run `npm run format`, `npm run check`, and `npm run pack-check`, which now counts one more skill.
