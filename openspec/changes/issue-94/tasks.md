# Tasks

## 1. Ask by hand

- [ ] 1.1 In `tests/init.test.ts`, "factory init, the field step", change the tests that expect exit 1: "words a failed or slow agent as the column step does" and "stops before the plan, changing nothing, when the answer can't be used" become tests of lines 1, 3, and 6, over each reason there, scripting the four selects and `yes`. See them fail before the code changes.
- [ ] 1.2 Add a test there of the whole transcript by hand, as "prints and asks the same on the way by hand, from the board's columns to the table" does, which holds lines 1, 2, and 5 and their order and blank lines.
- [ ] 1.3 Add tests there of line 3 (each select's `names` and `fallback`), line 4 (Decisions then For the builder in one field, and Spec with Acceptance criteria), line 5's two choices, line 7, and line 8 (by `looks`). Assert in the "registered labels" test's way that no line by hand says "Claude Code" or "GitHub" with the Fake Agent and memory tickets.
- [ ] 1.4 Change `src/ticket-fields.mts` and `src/init.mts` until 1.1 to 1.3 pass: `factory test-one tests/init.test.ts "NAME"`.

## 2. Docs

- [ ] 2.1 Replace the passage in `docs/existing-repo.md`, for Spec line 9. Verify with `git grep -n "Init stops, and changes nothing" docs`, which prints nothing, and the docs tests.

## 3. Verify

- [ ] 3.1 Map every Spec line to the test that exercises it, and write any that is missing. Spec line 9 is checked by 2.1.
- [ ] 3.2 Compare a real run's transcript with Proposed docs, "Mockup and result" in the pull request: `factory init` with the agent failing, up to `Use these ticket fields?`, or the test's transcript where no repository with text fields is at hand.
- [ ] 3.3 There is no end-to-end suite here. Run `npm run format` and `factory gate`.
