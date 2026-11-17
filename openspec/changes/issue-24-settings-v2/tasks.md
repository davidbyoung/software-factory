# Tasks

## 1. Settings version 2

- [ ] 1.1 `version` 2, the refusals of lines 2 to 4, and `specs` as a block with `check` (lines 5 to 9), in `src/config.mts`, with a test for each line in `tests/config.test.ts`, each seen failing first.
- [ ] 1.2 The `commands` block (lines 10 to 14) in `src/config.mts` and `settings.schema.json`. Tests in `tests/config.test.ts`; `tests/settings-schema.test.ts` passes.
- [ ] 1.3 The phase-grouped `plugins` (lines 28 to 36, 45, 47) and `factory plugins` (lines 37 to 44). Tests in `tests/config.test.ts`, with a fake `exists`.
- [ ] 1.4 `factory config explain` (lines 73 to 75) in `src/explain.mts`. The existing test that the output passes `config check` still passes.
- [ ] 1.5 `src/init.mts` writes version 2 and the "Left to do" line (70, 71), and `src/doctor.mts` the off line (72). Tests in `tests/init.test.ts` and `tests/doctor.test.ts`.

## 2. Commands

- [ ] 2.1 `src/commands.mts` with `gate`, `test-one`, `end-to-end`, and `specs check` (lines 17 to 27), wired in `src/cli.mts`. Tests in a new `tests/commands.test.ts` with a fake runner that records each command, its directory, and its environment.
- [ ] 2.2 The commit guard reads `commands.before-commit` (line 15). Test in `tests/guard-commit.test.ts`.
- [ ] 2.3 The build action reads `commands.build-setup` (line 16). Test in `tests/actions-workflows.test.ts`, reading the action's YAML.
- [ ] 2.4 Every other reader of the two moved keys names the new one. `git grep -n "build-setup\|before-commit"` over the package, outside `openspec/changes/archive/`, shows only `commands.build-setup` and `commands.before-commit`: `skills/factory-design/SKILL.md:102` (`config get build-setup`), `skills/factory-resolve-conflicts/SKILL.md:20`, the prompts in `workflows/factory-build.yml`, `factory-conflicts.yml`, `factory-deps.yml`, and `factory-review.yml`, the comment in `src/guard-commit.mts:4`, and the docs pages. Verified by that grep, pasted in the pull request.

## 3. The default branch

- [ ] 3.1 `src/lib/default-branch.mts` and `factory default-branch` (lines 55 to 58, and 68). Tests in a new `tests/default-branch.test.ts`, with fakes for the event file, git, and the code host, including that the host's answer is written to `origin/HEAD`.
- [ ] 3.2 The commit guard (lines 59 to 61, and 69) and the session start (62). Tests in `tests/guard-commit.test.ts` and `tests/session-start.test.ts` with a default branch named `develop`.
- [ ] 3.3 `factory sync` writes the push triggers (63 to 65). Tests in `tests/sync.test.ts`, and the workflow tests that read `branches:` updated.
- [ ] 3.4 `pr watch`, `deps`, and `site compare` (66, 67). Tests in `tests/pr-watch.test.ts`, `tests/deps.test.ts`, and `tests/site-servers.test.ts`.

## 4. The refined check

- [ ] 4.1 The soundness function and `factory ticket refined N [--check]` (lines 48 to 54). Tests in `tests/ticket.test.ts`, one body per line, with the memory ticket system.

## 5. Plug-in slots in the skills and agents

- [ ] 5.1 `agents/factory-e2e-reviewer.md`, and `NEEDS` in `src/sync.mts` (line 46). Test in `tests/sync.test.ts`.
- [ ] 5.2 `factory-build`, `factory-refine`, `factory-resolve-conflicts`, and `rules.md` call the refiner, the prover, the test reviewers, and the resolvers by slot, as "Where it goes" says. Verified by the trace in 8.2.

## 6. No stack names in what every repository gets

- [ ] 6.1 A test in `tests/boundary.test.ts`, seen failing first, that reads every `.md` file under `skills/` and `agents/`, and `rules.md` and `review.md`, and fails on any of: `AGENTS.md`, `next dev`, `Next.js`, `vitest`, `Vitest`, `Tailwind`, `React`, `.tsx`, `.ts sibling`, `python`, `Codecov` outside a sentence that starts "If the repository reports to Codecov", `visitor`, `origin/main`, `After every code change`, `Playwright`, `package-lock.json`, `npm ci`, and `npm install`, each matched as a whole word or phrase, so `React` does not match "reaction". The three files written only for a website or an end-to-end suite, `factory-ui-reviewer.md`, `factory-e2e-reviewer.md`, and `factory-design`, are the only ones that may name Playwright and say `visitor`, since a website has visitors; `origin/main` is reworded in them like anywhere else. `patch-coverage.py` is not read: it is #23's. `factory-deps` alone may name `package-lock.json`, `npm ci`, and `npm install`, since the factory's own update is an npm package's; Dependabot is not on the list. No file names `commands.relock`'s default: a skill says to run `commands.relock`.
- [ ] 6.2 Reword every file 6.1 fails on until it passes: the ones the tables above list, and any other, such as `skills/factory-trace/SKILL.md:40` (`origin/main`), `review.md` (`AGENTS.md`, `origin/main`, `visitor`), and `rules.md` (`visitor`, `origin/main`). Then run `node bin/factory.js sync` and commit the copies with the sources.

## 7. Docs and this repository

- [ ] 7.1 The docs of lines 76 to 82. `tests/docs.test.ts` passes, and `docs-reader` reads each page that gained or lost a section.
- [ ] 7.2 `.claude/factory.yaml` in version 2, `CLAUDE.md`'s "After every code change", and `openspec/config.yaml`'s gate line. `node bin/factory.js config check` and `sync --check` pass.

## 8. Verify

- [ ] 8.1 Map every Spec line to the test that exercises it, in the pull request, and write the test for any line without one.
- [ ] 8.2 Run the `factory-trace` skill on the branch and fix what holds up.
- [ ] 8.3 Run `npm run format`, `npm run check`, and `npm run pack-check`. There is no end-to-end suite here.
