# Tasks

## 1. The command

- [x] 1.1 `parseLcov` in `src/patch-coverage.mts`, with tests in `tests/patch-coverage.test.ts`, each seen failing first: a `DA` line with 0 hits is a miss and one with hits is not; a `DA` line with a checksum parses; a `BRDA` line taken `0` or `-` is a part and one taken `1` is not; a full `SF:` path is made relative to `cwd`; an unknown line is skipped.
- [x] 1.2 `changedLines`, same file of tests: one added line; a hunk with a count; `+12,0` adds nothing; `+++ /dev/null` starts no file; two files in one diff.
- [x] 1.3 `uncovered`, same file: Spec lines 1 to 6 and 14, one test each, with `source` given as a function over a fixture map. The 110-character cut and the trim are one test with a long, indented line.
- [x] 1.4 `case "uncovered"` in `src/pr.mts`, `USAGE`, and `PR_STEPS` and its arguments in `src/cli.mts`. Tests in `tests/pr.test.ts`, in a `describe("uncovered")` beside `describe("unverified")` (line 1052), with `git`, `readFile`, and the code host faked as that file's other tests fake them: Spec lines 7 to 13, one test each, and line 15 in `tests/cli.test.ts` where the other `pr` steps' usage is checked.
- [x] 1.5 Before deleting the Python: make a scratch lcov file and a scratch branch, run `python3 skills/factory-address-review/patch-coverage.py BASE LCOV` and `node bin/factory.js pr uncovered BASE LCOV`, and confirm the two outputs are identical. Put both in the pull request under "Mockup and result".

## 2. The skills

- [x] 2.1 Section 1b of `skills/factory-address-review/SKILL.md` names the command and its defaults; `skills/factory-address-review/patch-coverage.py` is deleted. Verify: `grep -rn "patch-coverage" skills src docs` prints nothing.
- [x] 2.2 The example in `skills/factory-mutate/SKILL.md` is a Node script. Verify by saving it as `mutate.mjs` in the scratchpad with one real mutation of `src/patch-coverage.mts` and its test file: it prints `RED`, and `git diff --stat` shows the same lines for `src/patch-coverage.mts` after the run as before it, so the file was restored.
- [x] 2.3 `node bin/factory.js sync`, then `node bin/factory.js sync --check` exits 0, and `.claude/factory.lock` no longer lists `patch-coverage.py`.

## 3. The link check

- [x] 3.1 `headingSlug` in `tests/docs.test.ts`, with tests seen failing first: backticks and asterisks dropped; `FACTORY_BOARD_TOKEN` keeps its underscores and `_Planned_` loses them; a link in a heading keeps its words; punctuation dropped; spaces to hyphens.
- [x] 3.2 `anchorsOf`: a heading in a fenced block is no anchor; a repeated heading gets `-1`.
- [x] 3.3 `brokenLinks`: a missing file; a missing heading; a link to another site skipped; `#anchor` alone checked against its own page; an anchor on a file that is not `.md` not checked.
- [x] 3.4 One test under `describe("the docs")`: every page's links resolve, with the failing links listed in the assertion as `unlinkedSettings`' test lists its findings. Prove it can fail with one mutation: change one anchor in `docs/quick-start.md`, see it red, and restore the page, so `git diff docs/quick-start.md` prints nothing.
- [x] 3.5 Before deleting `tests/check-links.py`, run `python3 tests/check-links.py .` and the new test on the same tree: both pass. Then delete it.

## 4. No Python left

- [x] 4.1 The two tests in `tests/boundary.test.ts`, each seen failing first: add a scratch `x.py` under `skills/` and see the first red; put `python3` in a scratch `.md` under `skills/` and see the second red; remove both.

## 5. Docs and the follow-up

- [x] 5.1 The row in `docs/cli.md`. `tests/cli.test.ts` and `tests/docs.test.ts` pass.
- [x] 5.2 The pull request body starts with `Closes #23`.
- [x] 5.3 Once the pull request is open, check off the line on #4 that begins `tests/check-links.py:` and add "Settled by #23." to it, with `npx --no-install factory ticket view 4 --field body` and `npx --no-install factory ticket edit 4 --body-file`. The pull request body says it settles that line, without the words "Part of", which the board sync reads as a partial follow-ups build.

## 6. Verify

- [x] 6.1 Map every Spec line to its test: lines 1 to 6 and 14 to `tests/patch-coverage.test.ts`; lines 7 to 13 to `tests/pr.test.ts`; line 15 to `tests/cli.test.ts`; line 16 to `tests/cli.test.ts`'s check that every routed command is in `docs/cli.md`, with the row's wording read in review. Name any line left without one and write it.
- [x] 6.2 `npm run format`, `npm run check`, and `npm run pack-check` pass. `git ls-files '*.py'` prints nothing.
- [x] 6.3 `factory-test-reviewer` reads the new tests. `docs-reader` is considered for `docs/cli.md`: one table row is not a section added or rewritten, so the pull request says it was skipped and why.
