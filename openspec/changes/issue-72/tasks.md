# Tasks

## 1. The list on the ticket

- [ ] 1.1 `lib/repositories.mts` and `tests/repositories.test.ts`: parse, write, order, circles, `nextToBuild`, `waitsFor`, derived state, reopened. Each refusal of lines 9 to 13 red first.
- [ ] 1.5 The confirmation, in `tests/repositories.test.ts` and `tests/ticket.test.ts`: lines 73 to 78 and the cloud half of 14, each way round it red first (a section edited by hand, a note by someone who cannot write to one, an unreadable answer, a session's forged marker).
- [ ] 1.2 Keys in the GitHub adapter, `tests/tickets-github.test.ts` and the test adapter's: lines 22, 23, 27, and every other call routed by its key. Stub the transport.
- [ ] 1.3 `factory ticket repositories`, `edit`, `link`, `branch`, `claim`, and `refined --check` in `tests/ticket.test.ts`: lines 1 to 21, 24, each output whole.
- [ ] 1.4 `tickets.fields.repositories` in the settings, the schema, and the lock: line 69, in `tests/config.test.ts` and the lock's test.

## 2. On a machine

- [ ] 2.1 `factory workspace`, against real git repositories in a temporary home: lines 28 to 34, 36.
- [ ] 2.2 `.claude/settings.json` in `tests/sync.test.ts` and `tests/remove.test.ts`: lines 35, 72.
- [ ] 2.3 `openspec.mts`'s change name: line 25. Run name: line 26, reading the written YAML.
- [ ] 2.4 `factory status`: lines 67, 68, from fixtures.

## 3. State and done

- [ ] 3.1 `derive`, `toClear`, and the notes, in `tests/work-status.test.ts`: lines 16, 48 to 50, 52.
- [ ] 3.2 `factory across` and the board's reads and nightly, in `tests/across.test.ts` and `tests/board.test.ts`: lines 51, 53 to 55, 57, with both last merges at once.

## 4. The order

- [ ] 4.1 "Merge order" and the verdict, in `tests/review-verdict.test.ts` and `tests/review-record.test.ts`: lines 56, 58 to 61, the override and review-off cases each red first.
- [ ] 4.2 The merge policy: line 62.

## 5. In the cloud

- [ ] 5.1 The second token, in `tests/session-token.test.ts`: lines 63, 64, the permissions asserted exactly, and no token in any output.
- [ ] 5.2 Prepare and Publish: lines 37 to 47, in their tests, with the private and public case and a refused start each red first.
- [ ] 5.3 The sandbox's settings name `others/` under `denyWrite`.
- [ ] 5.4 `run.yml`, `session.yml`, and `factory.yml`, read as YAML in `tests/workflows.test.ts`: lines 65, 66, and that the App's key reaches no job that runs a session or a pull request's code.

## 6. The repository line

- [ ] 6.1 `targetOf`, the board, and the merge policy with both names set and different: line 70. `reachOf` unchanged.
- [ ] 6.2 `factory sync --check` on a pull request event: line 71, and nothing said on a push.

## 7. Skills, rules, and docs

- [ ] 7.1 The skills and `rules.md`, then `node bin/factory.js sync`, both committed.
- [ ] 7.2 The docs as "Proposed docs" holds them: line 79, `docs-reader` on the new page, and no `Planned` mark left on what this builds.
- [ ] 7.3 The fresh-agent trace, since the skills, rules, `run.yml`, and the merge policy change what runs and when.

## 8. Verify

- [ ] 8.1 Map every Spec line to its test in the pull request; write any that is missing.
- [ ] 8.2 Live, in scratch repositories, the riskiest first: the second token reading a private ticket, asking who can write (`collaborators/LOGIN/permission`), and starting a build in the other repository; "Merge order" clearing after a merge; the close at the last merge; then a whole build in the cloud, and one on a machine.
- [ ] 8.3 The gate, `factory gate`, with the coverage floors, and `npm run pack-check`.
