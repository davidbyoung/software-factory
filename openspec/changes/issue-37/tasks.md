# Tasks

## 1. The adapter and the registry

- [ ] 1.1 Add `src/specs/types.mts`, `openspec.mts`, and `index.mts`, and `specs` to `BUILT` and `Registry`; `SPECS` and `settings.schema.json` take their names from it. Check with `tests/config.test.ts` (an unknown value's message is unchanged) and `tests/settings-schema.test.ts`.
- [ ] 1.2 Move `OPENSPEC_CHECK` and `DO_NOT_TRACK` into the adapter; `factory specs check` runs the adapter's default when `specs.check` is unset. Existing `tests/commands.test.ts` cases for the check pass unchanged except line 25's text.
- [ ] 1.3 Add `tests/specs-openspec.test.ts`: in a temporary folder with a stubbed command runner, `list` (lines 2 and 3), `start` for a new and an existing change (lines 4 to 7, and line 27's folder name), and `finish` for open, folded, absent, and failing changes (lines 9 to 12), and that each command's environment has `DO_NOT_TRACK=1` (line 14).
- [ ] 1.0 Before writing the adapter, run in a scratch folder: `npx --no-install openspec new change issue-1` with no `openspec/` folder (it creates one; this was seen while drafting), `npx --no-install openspec --version` (the `runs` probe), and `openspec archive issue-1 --yes` (the archived folder's name ends `-issue-1`, line 10). Where one differs, change the adapter and say so in the pull request.
- [ ] 1.4 Add a second, fake adapter in `tests/memory-tools.ts` that keeps its spec where `start` wrote it, has no check, and installs with a non-npm command; the command and init tests run against it too, so nothing outside `src/specs/` assumes OpenSpec.

## 2. The commands

- [ ] 2.1 `factory specs list`, `new N`, and `finish N` in `src/commands.mts` and `src/cli.mts`, with usage lines (line 13); remove `specs-change-name`. Check in `tests/commands.test.ts`: lines 1, 4 to 13 through the command, line 8 with `runs` false, and line 6 with a ticket without `spec` from `tests/memory-tickets.ts`.
- [ ] 2.2 Help: line 16 in `tests/cli.test.ts`.
- [ ] 2.3 `factory specs check` with `none`: lines 25 and 26 in `tests/commands.test.ts`.

## 3. Init

- [ ] 3.1 The question, its skip, and the written answer: lines 17 to 20 in `tests/init.test.ts`, including a preset that sets `specs` and a run where the branch-name question is skipped.
- [ ] 3.2 The `Install` row, the install, its failure, and no row when installed or `none`: lines 21 to 24, with `InitDeps.install` stubbed, for OpenSpec and for task 1.4's fake adapter, including a repository with no `package.json`.
- [ ] 3.3 The question is asked when a preset follows but writes no `specs`, and skipped when the preset writes `specs: none` (line 20).

## 4. Merge policy

- [ ] 4.1 `FACTORY_FILES` from the adapters' `processFiles`; `tests/merge-policy.test.ts` keeps `openspec/config.yaml` held, with `specs: none` too.

## 5. Skills, agents, rules, and the boundary

- [ ] 5.1 Rewrite `rules.md`, `skills/factory-refine/SKILL.md`, `skills/factory-build/SKILL.md`, and `agents/factory-ticket-readiness.md` as Design says; drop the `DO_NOT_TRACK` sentence from this repository's `CLAUDE.md`; run `node bin/factory.js sync` and commit sources and copies together.
- [ ] 5.2 Line 15: a check in `tests/boundary.test.ts`, beside the `gh issue` one, that finds a line running `openspec` (such as `npx --no-install openspec ...` or `openspec archive`) in the package's skills, agents, `rules.md`, `review.md`, workflows, and actions, with its own case showing it catches one and passes a path such as `openspec/specs/`.
- [ ] 5.3 Run `factory-trace` on the rule and skill changes and on `merge-policy.mts`, and fix what it finds before marking the pull request ready.

## 6. Docs

- [ ] 6.1 Write the sections under "The sections that change" into `docs/configuration.md`, `docs/workflow.md`, `docs/github/setup.md`, and `docs/cli.md`, the lines for `docs/limitations.md` and `docs/glossary.md`, and "Adding a spec tool" in `docs/developing.md`; `tests/docs.test.ts` checks lines 28 to 34.
- [ ] 6.2 Run `docs-reader` on the changed sections (they are not small) and fix its findings.

## 7. Verify

- [ ] 7.1 Map every Spec line to the test that exercises it, in the pull request body; a line without one gets one. Lines checked by review: the transcripts' side-by-side comparison with Proposed docs.
- [ ] 7.2 Run `npm run format` and `npx --no-install factory gate`, then `npm run pack-check`, since init's install and the new commands run in an installed copy.
