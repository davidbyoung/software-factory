# Tasks

## 1. Settings

- [ ] 1.1 Parse items, `commands.ignore`, site lists, and folder preset entries in `src/config.mts` and `settings.schema.json`; tests in `tests/config.test.ts` for lines 1 to 5 and 51.
- [ ] 1.2 `factory config check` stops and warnings, lines 19 to 26 and 52, each with a test.

## 2. The change and the plan

- [ ] 2.1 `src/lib/changes.mts`, tested against a scratch git repository for lines 2, 6 to 8, 14 to 16.
- [ ] 2.2 `src/lib/plan.mts`, tested for lines 9 to 13, 17, 18, with a red run for each of 10, 12, and 14 before the code.

## 3. Commands

- [ ] 3.1 `factory gate` output and flags, lines 27 to 37, in `tests/commands.test.ts`.
- [ ] 3.2 `test-one` and `end-to-end` lists, lines 38 and 39.
- [ ] 3.3 `factory coverage`, lines 40 to 44, with `src/pr.mts`'s reading shared; `factory relock`, lines 45 and 46; `factory build-setup`, line 47; `--dry-run`, line 48; `config get`, line 50.
- [ ] 3.4 The commit guard through the plan, lines 7 and 49, in `tests/guard-commit.test.ts`.
- [ ] 3.5 `factory site compare` with several sites, lines 53 to 57.

## 4. Presets

- [ ] 4.1 Folder presets in `combine`, lines 58 to 65, in `tests/preset.test.ts`; the summary, line 66, in `tests/preset-commands.test.ts`.

## 5. Everything that reads these settings

- [ ] 5.1 `config explain` (line 67), `init` (`runGate` as `--all`), `sync` (`NEEDS`), `session.yml` (`factory build-setup`).
- [ ] 5.2 The skills listed under Where it goes, then `node bin/factory.js sync`; run `factory-trace` before the pull request is marked ready.

## 6. Docs and specs

- [ ] 6.1 The docs from the comment's Proposed docs at the real heading levels, plus `docs/presets.md`, `docs/cli.md`, and `README.md`; the docs tests pass.
- [ ] 6.2 `factory specs new 75`, then `factory specs finish 75` and `factory specs check`.

## 7. Verify

- [ ] 7.1 Map every Spec line to the test that exercises it in the pull request; write one for any line without.
- [ ] 7.2 The builder's comparison of each command's output against the comment's transcripts.
- [ ] 7.3 `npm run format`, then `factory gate` and `npm run pack-check`.
