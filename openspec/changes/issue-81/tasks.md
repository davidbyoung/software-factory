## 1. The day

- [ ] 1.1 Add `src/lib/claude-token.mts` with `tokenDay`, `daysLeft`, `stage`, `inDays`, and the line builders; test each in `tests/claude-token.test.ts` with fixed dates, including 29 February, day 30, day 31, day 0, and a day past.
- [ ] 1.2 Add `StoredSecret`, `secrets()`, and `organizationSecrets()` to the runner, and `secrets()` beside `secretNames()` on the organization in `src/code-host/github.mts`; test in `tests/runner-github-actions.test.ts` that `updated_at` comes through, over two pages, and that `secretNames` is unchanged.
- [ ] 1.3 Add `pastedDay` to `src/lib/credentials.mts`; test in `tests/credentials.test.ts` a day, no `pasted`, another owner's entry, and an unreadable file (null, no throw).

## 2. factory doctor

- [ ] 2.1 Print lines 1 to 6 in `src/doctor.mts`; test in `tests/doctor.test.ts` each stage for a repository secret, an organization's, one counted from `pasted`, `ANTHROPIC_API_KEY`, and secrets that cannot be listed, and that `?` keeps exit 0 and ✗ makes it 1.
- [ ] 2.2 Update "Doctor is unchanged with today's tools" and "Init is unchanged with today's tools" in the spec (lines 7 and 8) and their tests.

## 3. factory status

- [ ] 3.1 Add the token line to `src/status.mts` for the terminal and `--hook` forms (lines 9 to 11); test in `tests/status.test.ts` each stage, the organization's wording, no line when listing fails, and one read under `--watch`.

## 4. factory init

- [ ] 4.1 Write `pasted` with a pasted token (line 12); test in `tests/init-machine.test.ts` that the file gets today's day.
- [ ] 4.2 Ask line 14's or line 15's question in the last 30 days, and keep `CLAUDE_CODE_OAUTH_TOKEN` out of `Replace them?` (lines 13 to 16); test both questions, yes and no, and the line after a new paste, in `tests/init-machine.test.ts`.
- [ ] 4.3 Refuse to copy an expiring token from the file (line 17); test it, and a file with no `pasted` copying as today.
- [ ] 4.4 Show the day in `init --org`'s question and set its default (lines 18 to 20); test in `tests/init-org.test.ts` the two stages and an API key.

## 5. The session's error

- [ ] 5.1 Export `REFUSAL` for both users, and add lines 21 to 23 in `src/session-jobs.mts`, printed after commands resume; test in `tests/session-jobs.test.ts` a refused token in a personal and an organization's repository, a refused API key, another error, and a result with no error printing as today, and that the line comes after the `::TOKEN::` that resumes commands.

## 6. The docs

- [ ] 6.1 Write the `docs/credentials.md` sections as "Proposed docs" gives them, at the page's own levels: "Checking the setup" and the new "When the Claude token's year is up" are both `###` under `## On GitHub`, the new one right after the other. The page's Jira section "When a token stops working" is about a ticket system's token and stays as it is. Write also the lines it gives for `docs/cli.md`, `docs/github/setup.md`, and `docs/github/by-hand.md`; the docs tests in the gate check the links.
- [ ] 6.2 Fold the Spec into `openspec/specs/` with `factory specs finish 81`, and run `factory specs check`.

## 7. Verify

- [ ] 7.1 Map every Spec line to the test that exercises it in the pull request body, and write a test for any line without one.
- [ ] 7.2 Compare each command's output with the transcripts in "Proposed docs", side by side in the pull request.
- [ ] 7.3 Run `npm run format` and `factory gate`. There is no end-to-end suite here.
