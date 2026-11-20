# Tasks

## 1. The agent's question

- [ ] 1.1 Add `src/agent/types.mts` and the `agent` member on the registry's coding agent; implement Claude Code's `answer` with an injectable spawn. In `tests/agent-claude-code.test.ts` (new), stub the spawn: exit 0 returns `structured_output`, non-zero returns stderr's first line, and a run past the timeout returns the timeout. Check the argv it builds, including `--tools ""`, `--model haiku`, and a `cwd` that is an empty temporary folder.
- [ ] 1.2 Give Fake Agent in `tests/fake-tools.ts` and the memory registry a scripted `answer`.

## 2. The board's columns

- [ ] 2.1 Add `BoardOps.columns`, in the GitHub adapter and `tests/memory-tickets.ts`. Test the GitHub one in `tests/tickets-github.test.ts` against a recorded fields response: Status options in order, and `[]` without a Status field.

## 3. Lists in settings

- [ ] 3.1 `config.mts`, `work-status.mts`, and `settings.schema.json` take lists. In `tests/config.test.ts`, cover lines 17, 18, and 19, each message exact. In `tests/columns.test.ts`, cover lines 15 and 22 through `statusOfColumn` and `columnFor`.
- [ ] 3.2 `board.mts`: in `tests/board.test.ts`, cover line 16, where `planSync` writes the first name and leaves a ticket already in the second, and line 20, the `boardReport` row and a missing listed name.
- [ ] 3.3 `explain.mts`, `status.mts`, `ticket.mts`, and `poller.mts` follow the type. Cover line 23 in the config explain tests in `tests/config.test.ts`, and line 22's status heading in `tests/status.test.ts`. The existing poller tests stay green unchanged.
- [ ] 3.4 The board check that `doctor` and `init` print lives in `src/tickets/github-setup.mts` and calls `inspectBoard`. Cover line 21 in `tests/doctor.test.ts`: it passes with every listed name, and fails naming a missing one.

## 4. The column step in init

- [ ] 4.1 `src/columns-suggest.mts`: unit-test `check` for every reason in line 7, and `table` for line 4's three row forms, in `tests/columns-suggest.test.ts` (new).
- [ ] 4.2 Wire it into `init.mts`. In `tests/init.test.ts`, with the memory board holding Todo, In Progress, Code review, and Done:
  - lines 1, 3, 4, 8, 9, and 13: Yes writes exactly the YAML in Proposed docs and adds only the fields;
  - line 10: Change some, then Add, writes the second YAML and adds In refinement;
  - line 11: a clash, then a valid pick;
  - line 12: No adds Backlog, In refinement, Ready, and In review, and writes no columns;
  - line 5: not installed, exit 1, settings file absent, and no board call made;
  - line 6: an unusable answer, exit 1, nothing written;
  - line 2: each no-question case;
  - with builds from the board, ready none is unusable, and "No column" isn't offered for ready;
  - line 25: a re-run that turns on builds from the board with `ready: none`, where Add removes the key and a board column writes it, and no agent is called;
  - line 7's two new reasons, and the order when several apply;
  - line 14: Fake Agent's label in the lines, and no "Claude Code".
- [ ] 4.3 Write line 24's two sentences into the `tool-setup` change's MODIFIED requirement, and make sure the existing init tests still pass. The ones that pick an existing board without the six columns now meet the column step: give them a scripted answer.

## 5. Docs

- [ ] 5.1 Apply Proposed docs to `docs/existing-repo.md`, `docs/configuration.md`, `docs/design.md`, and `docs/developing.md`. `tests/docs.test.ts` passes, and `docs-reader` reads `existing-repo.md`'s section.

## 6. Verify

- [ ] 6.1 Map every Spec line, 1 to 25, to its test above in the pull request body, and write a test for any line without one.
- [ ] 6.2 Side-by-side: run init against the memory board, or a scratch GitHub Project, and put its output next to Proposed docs' transcripts under "Mockup and result".
- [ ] 6.3 `npx --no-install factory gate` and `npm run pack-check`. There are no end-to-end specs here.
