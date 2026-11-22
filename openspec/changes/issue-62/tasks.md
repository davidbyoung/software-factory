# Tasks

## 1. The credential and the file

- [ ] 1.1 Add the `credential` step kind to `src/setup.mts`, and make `secretSteps`, `neededSecrets`, and `partsOn` read its names. Verify with tests in `tests/setup-ops.test.ts` and `tests/parts.test.ts`, red first.
- [ ] 1.2 Write `src/lib/credentials.mts` with path, read, and write. Tests in `tests/credentials.test.ts` (new), against a temporary `XDG_CONFIG_HOME`: lines 1, 2, and 4, the modes after a first write and over a looser folder (line 17), an entry kept beside another, a half-set or empty environment, and invalid YAML.
- [ ] 1.3 Make Fake Tickets' token a two-part credential in `tests/fake-tools.ts`, as Design says.

## 2. Opening the adapter

- [ ] 2.1 Move GitHub's opener to `src/tickets/github-open.mts`, open the ticket system through the registry in `openTickets` and in the poller's `sources`, with `DEFAULT_TICKETS` for a hosted poller, and add the boundary check. Tests: line 26 with Fake Tickets, in `tests/ticket.test.ts` and `tests/poller.test.ts`; the boundary test in `tests/boundary.test.ts` red with an import left in `src/poller.mts`.
- [ ] 2.2 Add `CredentialError`, its messages (lines 3 to 6), the wrapping of a `401`, and the CLI's handling. Tests in `tests/ticket.test.ts`: each message and exit 1, a `403` passed through unchanged, the `::error::` prefix under `GITHUB_ACTIONS=true`, and that no value is printed (line 8).
- [ ] 2.3 Print the error in the session-start hook (line 7). Test in `tests/session-start.test.ts`.

## 3. Setup and checks

- [ ] 3.1 Store a credential in `init` on a first setup: lines 12 to 17. Tests in `tests/init.test.ts` with Fake Tickets, asserting the transcript lines and the file's mode.
- [ ] 3.2 The re-run for this machine: lines 18 to 24. Tests in `tests/init.test.ts`: missing, refused, accepted, an unreadable file, a skipped part, the answer no, the answer yes, a failed listing, and GitHub's unchanged transcript.
- [ ] 3.3 The `doctor` line of line 25. Tests in `tests/doctor.test.ts`, one per state.

## 4. Workflows and the guard

- [ ] 4.1 `withTicketEnv` in `src/sync.mts` (lines 10 and 11). Tests in `tests/sync.test.ts`: the lines in each picked job of the seven workflows with Fake Tickets, none in `factory-check`, `factory-review-verdict`, or `factory-merge-policy`, a name the `.npmrc` also reads written once, only lines added, and byte-for-byte the same with GitHub.
- [ ] 4.2 The guard (line 9) and its hook group. Tests in `tests/guard-credentials.test.ts` (new) for `Bash`, `Read`, `Grep`, and `Glob`, and in `tests/sync.test.ts` and `tests/remove.test.ts` for the group written and removed.

## 5. Removing

- [ ] 5.1 Group `factory remove`'s list by tool, and move the label and secret lines (lines 27 to 29). Tests in `tests/remove.test.ts`, the GitHub transcript of Proposed docs section 9.
- [ ] 5.2 The credential's leftover lines (line 30). Tests in `tests/remove.test.ts` with Fake Tickets: secrets set, file entry present, file unreadable, and settings unreadable.

## 6. Specs, docs, and checks

- [ ] 6.1 Write `docs/credentials.md` from Proposed docs, and the changes in its section 11, plus "Six hook entries" in `docs/github/reference.md`. The docs tests in the gate pass.
- [ ] 6.2 Run `docs-reader` on `docs/credentials.md` before opening the pull request, and fix its findings.
- [ ] 6.3 Verify: map each Spec line to the test that exercises it, in the pull request body, and write a test for any line without one.
- [ ] 6.4 Run the side-by-side comparison of Fake Tickets' transcripts against Proposed docs sections 1, 4, 6, 7, 8, and 9.
- [ ] 6.5 Run `npx --no-install factory specs check` and `npx --no-install factory gate`. No end-to-end specs are added.
