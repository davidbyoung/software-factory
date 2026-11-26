## 1. The fixes to approval policies

- [x] 1.1 Prompt on standard input, `model:` from front matter, and `Read(//proc/**)` denied (lines 14, 16, 17), in `tests/approval-agent.test.ts`, with a 200 KiB input that starts.
- [x] 1.2 The agent's input restricted to the command's files, and a cleared outcome's findings in the Details (lines 15, 18), in `tests/approval-job.test.ts`.
- [x] 1.3 The merge policy runs a `run`-and-`agent` policy's command and holds only when it found something (line 20), in `tests/merge-policy.test.ts`.
- [x] 1.4 `reviewsOf` by `head_sha` (line 21), in `tests/runner-github-actions.test.ts`.

## 2. The policy

- [x] 2.1 The factory layer, `off: true`, the agent-file check, and `config explain`'s marks (lines 1, 2, 4), in `tests/config.test.ts` and `tests/preset.test.ts`. Update the tests that assume no policy by default, such as "fills every default".
- [x] 2.1a A one-sentence docs change runs no agent (line 13), in `tests/approval-job.test.ts` with the real `find.mts`.
- [x] 2.1b `factory sync` on this repository: its `factory.yml` gains the part and the `edited` trigger, and its lock the policy. Commit them.
- [x] 2.2 `sync` writes and leaves out the two files (line 3), in `tests/sync.test.ts`.
- [x] 2.3 `find.mts`, each form and each exclusion (lines 5 to 11), in `tests/credentials-find.test.ts`, run on the real script against a temporary repository.
- [x] 2.4 The agent file's front matter and wording (line 12), in a test that reads it.
- [ ] 2.5 Measure the widened rule over the pinned set of changes. Over 40 picked: narrow `_KEY` as Decisions says, measure again, and give both counts in the pull request. Put the shipped rule's counts in the docs page.

## 3. Threats

- [x] 3.1 `missingParts` with a lookup, both lines and their exit (line 22), in `tests/refined-check.test.ts`.
- [ ] 3.2 The refine skill writes `## Threats`; `factory sync`; the trace.

## 4. Docs and verify

- [ ] 4.1 The docs (lines 19, 23), and the docs tests.
- [ ] 4.2 Map every Spec line to its test.
- [ ] 4.3 `factory gate`, `npm run pack-check`, and `factory specs check`.
