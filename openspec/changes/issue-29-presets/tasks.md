## 1. The lock

- [ ] 1.1 `lockText` and `lockedFiles` write and read the new shape as YAML (lines 1, 2). Tests in `tests/sync.test.ts`, including a `presets` list that the old pattern would have misread.
- [ ] 1.2 `loadSettings` reads the lock's `settings`, with `FACTORY_LOCK` and `FACTORY_SETTINGS` (lines 3, 11, 12). Tests in `tests/config.test.ts`, with the lock and the settings file as fixtures.
- [ ] 1.3 The stale check, its order, and its messages (lines 4 to 7, 69, 70). One test per reason in `tests/config.test.ts`.
- [ ] 1.4 The commit hook blocks and the session-start hook warns (lines 8, 9). Tests in `tests/guard-commit.test.ts` and `tests/session-start.test.ts`.
- [ ] 1.5 `factory sync --check` fails on a stale lock (line 10). Test in `tests/sync.test.ts`.
- [ ] 1.6 The review workflow reads the base lock, or the base settings when that lock predates this release (line 13). Test in `tests/claude-review-workflow.test.ts`, reading the workflow's YAML.

## 2. Combining presets

- [ ] 2.1 `src/preset.mts` finds a preset by NAME, in a package's root and in a subfolder, from fixture packages under `tests/fixtures/presets/`.
- [ ] 2.2 `resolve` combines layers by lines 15 to 22 and 71 to 73, one test per kind of setting, in `tests/preset.test.ts`.
- [ ] 2.3 Plugins: union by name, the repository's entry over a preset's, and `off: true` (lines 18, 19), with `factory plugins` in `tests/reviewers.test.ts` or wherever `factory plugins` is tested today.
- [ ] 2.4 The refusals of lines 24 to 30, one test each, through `factory config check` and `factory sync`.
- [ ] 2.5 A plugin whose file a preset ships counts as present (line 66). Test in `tests/config.test.ts`.

## 3. Explain and sync with presets

- [ ] 3.1 The marks of lines 62 to 64 and explain reading the lock (line 65). Tests in the explain tests, from a fixture with two presets and a choice.
- [ ] 3.2 The lock's `settings` equal `config explain`'s lines, and parsing them gives the same `Settings` as resolving the files. One test.
- [ ] 3.3 `sync` writes preset agents and skills, keeps a repository's own file (line 23), and drops stale choices (line 54). Tests in `tests/sync.test.ts`.
- [ ] 3.4 `withPresetPackages` writes each preset package into the auto-merge exclusion (line 14). Test in `tests/deps-auto-merge-workflow.test.ts`, reading the written workflow's YAML.

## 4. Adding and removing

- [ ] 4.1 `preset add`'s summary, prompts, choices, `drop`, and apply (lines 31 to 34), with a fake npm and a fake terminal. Tests in `tests/preset.test.ts`.
- [ ] 4.2 Declining, outside a terminal, `--yes`, `--dry-run`, already listed, npm failures, not a preset, and prompts asked again (lines 35 to 41, 74). One test each.
- [ ] 4.3 The Dependabot lines (lines 42, 43), from fixture `.github/dependabot.yml` and `.npmrc` files.
- [ ] 4.4 `preset remove` (lines 44 to 48), including two presets from one package. One test each.

## 5. Choices, check, and changes

- [ ] 5.1 The choices file's shape, creation, and deletion (line 49).
- [ ] 5.2 `preset choices` in and out of a terminal, and with nothing to choose (lines 50 to 52).
- [ ] 5.3 `preset choose` and its two refusals (line 53).
- [ ] 5.4 `preset check` (lines 55 to 58), from fixture packages.
- [ ] 5.5 `preset changes REF` (line 60), from two lock fixtures, one test per section of the comment, and one with no change.

## 6. The rest of the factory

- [ ] 6.1 `factory deps` reports a preset update as needing a sync (line 59). Test in `tests/deps.test.ts`.
- [ ] 6.2 `skills/factory-deps/SKILL.md` step 4 covers preset updates (line 61). Synced with `node bin/factory.js sync`.
- [ ] 6.3 `factory remove` (line 67). Test in `tests/remove.test.ts`.
- [ ] 6.4 `factory doctor`'s preset lines and its lock read (line 75). Test in `tests/doctor.test.ts`.
- [ ] 6.5 `settings.schema.json`. Test in `tests/settings-schema.test.ts`.
- [ ] 6.6 The `preset` commands in `src/cli.mts`'s table. Test in `tests/cli.test.ts`.

## 7. Docs

- [ ] 7.1 The pages of line 68, with `docs/presets.md` from Proposed docs. The docs tests pass, and `docs-reader` reads the new page and the changed sections.

## 8. Verify

- [ ] 8.1 Map every Spec line, 1 to 75, to the test that exercises it, in the pull request body. Write a test for any line without one.
- [ ] 8.2 Put each command's real output beside Proposed docs' version of it in the pull request body, and fix any difference.
- [ ] 8.3 `factory-trace` on the pull request, since it changes workflows, a skill, and the code that reads settings.
- [ ] 8.4 `npx --no-install factory gate` and `npm run pack-check` pass.
