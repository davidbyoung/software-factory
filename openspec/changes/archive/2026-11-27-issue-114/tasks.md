## 1. The day

- [x] 1.1 Read the expiry header in `tokenOwner`; test in `tests/code-host-github.test.ts` a dated header, none (`never`), and one that is not a date.
- [x] 1.2 Return `kept` from the token step's `verify` and `serves`; test in `tests/code-host-github-setup.test.ts` or beside the existing step tests.
- [x] 1.3 Add the access token's day and lines, and the NAMES and OLDER function; test them as `tests/claude-token.test.ts` tests #81's, with fixed dates.

## 2. factory doctor and factory status

- [x] 2.1 Lines 1 to 6 in `src/doctor.mts`; test in `tests/doctor.test.ts` each stage, `never`, older secrets, an organization, and no file.
- [x] 2.2 Lines 8 to 10 through `tokenWarning` and `status`; test in `tests/status.test.ts` and `tests/doctor.test.ts`, the order with Claude's line included.
- [x] 2.3 Update "Doctor is unchanged with today's tools" (line 7) and its test.

## 3. factory init

- [x] 3.1 Write `pasted` and `expires` on a paste, and `expires` on a store from the machine (lines 11 and 12); test in `tests/init-machine.test.ts`.
- [x] 3.2 Lines 13 to 16, each question's yes and no, both questions due together, `Replace them?` after a no, only OLDER secrets with a near machine token (line 13), and a file with no `expires` whose check returns a near day (line 16); test in `tests/init-machine.test.ts`.
- [x] 3.3 The step's line (line 17); update the existing transcript tests that print it.
- [x] 3.4 Update "Init is unchanged with today's tools" and "Only init reads the machine's tokens" in the specs.

## 4. The docs

- [x] 4.1 Write the `docs/credentials.md` sections as "Proposed docs" gives them, at the page's own levels (`###` under `## On GitHub`, right after "When the Claude token's year is up"), and the lines it gives for `docs/github/setup.md` and `docs/cli.md`.

## 5. Verify

- [x] 5.1 Map every Spec line to its test in the pull request, and write one for any line without.
- [x] 5.2 Compare each command's output with the transcripts in "Proposed docs", side by side in the pull request.
- [x] 5.3 Run `factory specs finish 114`, `npm run format`, and `factory gate`. There is no end-to-end suite here.
