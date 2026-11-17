# Tasks

## 1. Lock today's behavior first

- [ ] 1.1 In `tests/init.test.ts`, add transcript tests that record every line `init` prints and every question it asks, in order, for a first run with every part and for a re-run with every part on, with the memory fakes. Commit them green against today's code before any refactor (line 1).
- [ ] 1.2 In `tests/doctor.test.ts`, do the same for `doctor`'s full output on the existing fixtures (line 10).
- [ ] 1.3 Add a test for the edge under Decisions: cloud builds on, no board, and only `FACTORY_BOARD_TOKEN` set. It asks for no token. Watch it fail against today's code.

## 2. The contract and the registries

- [ ] 2.1 Add `src/setup.mts`, and move `Check` there. Typecheck passes.
- [ ] 2.2 Add the registries and `src/agent/`, and make `parseSettings`, the openers, and the messages take a registry. In `tests/config.test.ts`, test with a registry that holds the fake: `tickets.type: fake` with `site` is accepted, `tickets.site` under `github` is refused, and an unknown type is refused, naming the built ones (lines 13 and 14).
- [ ] 2.3 Move the Claude Code step to `src/agent/claude-code.mts`, and the access-token step to the GitHub code host. 1.1 and the existing "the access token" tests stay green.

## 3. `init` walks the steps

- [ ] 3.1 Replace the agent and token blocks in `src/init.mts` with the loop over steps, and `parseRemote`, `TOOLS`, and the `Found` rows with the registries. 1.1 stays green, and 1.3 turns green.
- [ ] 3.2 Add `tests/fake-tickets-tool.ts`, the fake under "Contracts", built on `tests/memory-tickets.ts`. In `tests/init.test.ts`, add "factory init, a tool's own setup", with one test each for lines 2 to 7, each seen red once, by its run before 3.1 or by one mutation of the loop.
- [ ] 3.3 With the fake registered beside GitHub Issues, test line 8: `init` asks "Which ticket system?", defaults to the one the settings name, and writes `tickets.type`. Test line 9 with a registry of two code hosts and a remote that neither recognizes.

## 4. `doctor` asks each tool

- [ ] 4.1 Move the sign-in check and the board check into the tools' `checks`, and the secret lines onto `neededSecrets` from the steps. 1.2 stays green.
- [ ] 4.2 In `tests/doctor.test.ts`, test line 11 with `FAKE_TICKETS_TOKEN` unset (`for Fake Tickets`), and line 12 with `site: down` and a non-zero exit, each seen red once.

- [ ] 4.3 Add Claude Code's configuration checks, and `tests/fake-agent-tool.ts`, a coding agent named "Fake Agent" whose one check is that `FAKEAGENT.md` exists, with the fix "Run fake-agent init". In `tests/doctor.test.ts`, test line 25 on a synced fixture; line 26 with the import line removed, and again with one hook removed; line 27 with `hasCommand` false; and line 28 with the fake agent registered in place of Claude Code and `FAKEAGENT.md` absent. See each one red once. Update 1.1's and 1.2's transcripts for the added lines in the same commit, and say so in its message.

## 5. `factory remove`

- [ ] 5.1 Add `leftovers` to each tool's setup, and to the fake ("Delete your Fake Tickets token").
- [ ] 5.2 Add `src/remove.mts` and its `cli.mts` entry. In `tests/remove.test.ts`, start from a repository that `sync` set up with every part, and test each of lines 15 to 24, each seen red once. Line 17's test has a `.claude/settings.json` with a hook of the user's own and a `CLAUDE.md` with other lines, and checks that both survive. Line 22's starts with only `.claude/factory/` and the `CLAUDE.md` line left.
- [ ] 5.3 Update `docs/cli.md` (the `remove` row loses its Planned mark, the way a built command's row reads), `docs/removing.md` (the mark, what it prints, and the "Two files belong to you" paragraph, which now names only the review notes and says the review's workflow is the factory's, rewritten by every sync and deleted by `remove`), and `docs/github/reference.md` (the mark). In "What is built", split the "`remove` and `config explain`" row so `remove` says Working and `config explain` stays Planned. `tests/docs.test.ts` passes.

## 6. Docs

- [ ] 6.1 Write "What a tool asks `init` for" in `docs/developing.md`, covering `steps`, `checks`, and `leftovers`. Point "Adding a ticket system" to it, and update the table's row. `tests/docs.test.ts` passes, and the comparison of the page goes in the pull request.

## 7. The trial

- [ ] 7.1 With everything above green, pack the branch, create `davidbyoung/factory-trial` (private, with a README so it has a default branch), clone it to a scratch folder, and run the cold agent as the Design says.
- [ ] 7.2 Fix each step it reports in the docs. List each report line and its fix in the pull request body. Rerun on a fresh clone if a fix changed a step.
- [ ] 7.3 Mark "A second repository using it" Working in "What is built", and say in the body that the owner deletes `davidbyoung/factory-trial`.

## 8. Verify

- [ ] 8.1 Map every Spec line to its test in the pull request body: 1 and 10 to the transcripts, 2 to 9 to 3.2 and 3.3, 11 and 12 to 4.2, 13 and 14 to 2.2, 15 to 24 to 5.2, and 25 to 28 to 4.3. Name any line without one, and write it.
- [ ] 8.2 Run `npm run format`, `npm run check`, and `npm run pack-check`. Coverage must not drop.
