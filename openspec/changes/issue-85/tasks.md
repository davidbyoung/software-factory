# Tasks

## 1. Share the question

- [ ] 1.1 Move `askBranchName` and `BRANCH_QUESTION` to `src/init-shared.mts`, and import it in `src/init.mts`. Verify with `npx vitest run tests/init.test.ts tests/init-organization.test.ts`, with no test changed.

## 2. Ask and write it

- [ ] 2.1 In `tests/init-org.test.ts`, let the harness answer `input`, from an `input` queue in `Answers`, recording the question and its fallback and pushing `? input: ...` to the transcript. With no scripted answer it returns the fallback, as Enter does. The tests that a preset already there asks nothing must be able to fail on it, so they assert on the questions recorded.
- [ ] 2.2 Write the tests for lines 1 and 3 first and watch each go red: the test "prints what the draft shows, from what it found to the line a developer runs" gains the two lines and the question, with the fallback `{ticket}`, and `PRESET` gains the block. Add a test that a board with columns of its own is asked about before it. Then build it.
- [ ] 2.3 Line 2: a test that answers `feature/{user}` and then `{user}/{ticket}` sees the reason between the two questions, and the second in the preset. A second case answers `a"b/{ticket}` and loads the preset as YAML, to see the answer come back whole. Prove each with one mutation.
- [ ] 2.4 Line 4: the README test asserts the line as written.
- [ ] 2.5 Line 5: a run with the preset there and the poller's file missing, and one with nothing missing, each with a preset that has no `code-host`, ask no `input`, print neither line, and leave the preset's text the same. Prove with one mutation: ask outside `if (needsPreset)`.
- [ ] 2.6 The looks test, "has bold labels...", gains the two lines as plain text.

## 3. Docs

- [ ] 3.1 Line 6: change the three pages, and add to `tests/docs.test.ts` one test that each page has its new text, seen red before the pages change. `npx vitest run tests/docs.test.ts` also checks the links.

## 4. Verify

- [ ] 4.1 Fold lines 1 to 6 into the specs: lines 1 and 2 change "The questions it asks", lines 3 and 4 change "The factory-config repository", and line 5 adds a requirement, in `org-setup`. Line 6 adds a requirement in `docs`, and "The configuration page's code-host" there gains that its `branch-name` entry reads as line 6 says. Check with `factory specs check`.
- [ ] 4.2 Map lines 1 to 6 to the test that exercises each: 1 to 2.2, 2 to 2.3, 3 to 2.2, 4 to 2.4, 5 to 2.5, and 6 to 3.1. Write a test for any without one.
- [ ] 4.3 Put the transcript of a run, as the test prints it, beside "Priya sets the organization up" in the pull request body.
- [ ] 4.4 Run `npm run format` and `factory gate`. There is no end-to-end suite.
