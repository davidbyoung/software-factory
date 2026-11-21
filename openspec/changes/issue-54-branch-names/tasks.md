# Tasks

## 1. The setting

- [ ] 1.1 `src/config.mts`: the key, the type, and `branchPatternFault`, with tests in `tests/config.test.ts` for lines 1 to 9 and 17, each message, a preset supplying it (line 3), and `code-host: github` (line 2).
- [ ] 1.2 Add `branch-name: "{ticket}"` to every test fixture that writes settings (22 files hold `version: 2`; `tests/locked.ts`, `tests/preset-fixture.ts`, and `tests/pack-check.mts` among them), preferring one shared fixture line over 125 copies. The gate passes.
- [ ] 1.3 `settings.schema.json`, checked by `tests/settings-schema.test.ts`.
- [ ] 1.4 `src/explain.mts`, line 23, with a test in the explain tests for the file's pattern and a preset's.
- [ ] 1.5 This repository's `.claude/factory.yaml`, then `node bin/factory.js sync`; `npx --no-install factory config check` passes.

## 2. The commands

- [ ] 2.1 `factory ticket branch N`, lines 10 to 12, tested in `tests/ticket.test.ts` with `tests/memory-tickets.ts` and `tests/memory-code-host.ts`, including a pattern without `{user}` that never calls `signedInAs`.
- [ ] 2.2 `factory specs change-name N`, lines 13 and 14, tested in `tests/commands.test.ts`.
- [ ] 2.3 `factory pr for-branch BRANCH` and `lastForBranch`, lines 15 and 16, tested in `tests/pr.test.ts` with the memory code host, and the GitHub call in `tests/code-host-github.test.ts`: open, merged, closed without merging, the newest of two, and none.
- [ ] 2.4 All three in the usage lists `tests/usage.test.ts` and `tests/cli.test.ts` check.

## 3. Init

- [ ] 3.1 `src/init.mts`, lines 18 to 22, tested in `tests/init.test.ts` with a scripted `Ask`: the question and its position, the quoted write, a refused answer asked again, a re-run with the key, a preset supplying it, and #53's read of a file missing only this key.

## 4. The build skill

- [ ] 4.1 `skills/factory-build/SKILL.md` steps 1, 2, and the archive step as "Where it goes" says; `node bin/factory.js sync`; `grep -rn "issue-N-short-slug" skills agents rules.md review.md workflows actions` prints nothing.
- [ ] 4.2 The fresh-agent trace with the `factory-trace` skill, since a build now deletes or stops on a branch already on `origin`, the follow-ups ticket's repeat builds included; fix what it finds.

## 5. Docs

- [ ] 5.1 `docs/configuration.md`, `docs/cli.md`, `docs/updating.md`, and `docs/presets.md` as Spec lines 24 to 26; `tests/docs.test.ts` passes, its settings examples included. Run `docs-reader` on the changed sections and fix its findings.

## 6. Verify

- [ ] 6.1 Map each Spec line, 1 to 26, to the test that exercises it in the pull request, and write a test for any line without one. Lines checked by review are named as such.
- [ ] 6.2 The "Mockup and result" comparison: each transcript under Proposed docs beside the real command's output.
- [ ] 6.3 `npm run format`, then `npx --no-install factory gate`, and `npm run pack-check`.
