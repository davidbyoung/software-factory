## 1. Reading `.npmrc`

- [x] 1.1 `src/npmrc.mts`: names from sign-in lines (line 1), addresses (line 10, the longest match), registries, and the name errors (lines 6 and 7). `tests/npmrc.test.ts`: one test per rule of line 1 (`${NAME}`, `${NAME?}`, `\${`, a non-sign-in line, duplicates, CRLF, comments), line 10's both cases, and each refused name.
- [x] 1.2 Move `npmrcRegistry` from `src/preset-commands.mts`; `tests/preset-commands.test.ts` stays green.

## 2. Sync writes the variables

- [x] 2.1 `withNpmEnv` and its use in `plan()`. `tests/sync.test.ts`: with `NPM_TOKEN`, each job of lines 2 and 3 has it in its `env`, read back as YAML, as `tests/release-workflow.test.ts` reads a workflow, and line 3a: deleting the added lines gives today's text.
- [x] 2.2 Line 4: with no `.npmrc`, and with one naming only `cache=${HOME}`, every file `plan()` writes equals today's.
- [x] 2.3 Line 5: `GITHUB_TOKEN` adds `packages: read` and the token's env.
- [x] 2.4 Lines 6 and 7: `main` exits 1 with the message and writes nothing.

## 3. The lock

- [x] 3.1 `lockText` writes `npmrc-variables` after `settings-hash` (line 26); `readLock` reads it, missing as `[]`. Tests in `tests/sync.test.ts` and `tests/preset.test.ts`.
- [x] 3.2 `staleReason` and `staleOf`: lines 27 (a refused name included) and 28, in `tests/preset.test.ts` (names changed, renamed, unchanged with a new registry, missing key with no names) and `tests/sync.test.ts` for `--check`.

## 4. The runner's secrets

- [x] 4.1 The four runner methods in `src/runner/github-actions.mts`, with `tests/runner-github-actions.test.ts` against a stubbed transport: each endpoint, `--app dependabot`, a person's repository, a refused organization call as `null`, and the `selected` and `private` visibilities.
- [x] 4.2 `tests/memory-runner.ts` gains them, from options, and `tests/memory-code-host.ts` gains `ownerIsOrganization`, with `src/code-host/github.mts`'s tested in `tests/code-host-github.test.ts`.

## 5. Init

- [x] 5.1 The "Found" row (line 8) and the plan's `Secrets` rows (line 9, each case), in `tests/init.test.ts`.
- [x] 5.2 Lines 9, 11, 12 (both of its cases), 13, 14, 15, 15a, and 24a, one test each, with the memory runner and scripted answers, asserting the printed lines and the secrets stored where.
- [x] 5.3 Line 22 for `init`: an organization Actions secret, or a listed organization Dependabot secret, is not asked for, and turning a part off offers to delete only the repository's own secrets.

## 6. Doctor

- [x] 6.1 `Check` `unknown` and `line()`'s `? `, and `main` exiting 0 with only unknown lines (line 25), in `tests/doctor.test.ts`.
- [x] 6.2 Lines 16, 17, 18, and 21, with the memory runner.
- [x] 6.3 Lines 19 and 20: a matching entry and npm update, a missing top-level entry, a top-level entry the npm update doesn't name, `registries: "*"`, a trailing slash, the public registry skipped, and no `dependabot.yml`.
- [x] 6.4 Lines 22, 23, 24, and 24a, and line 21's order with the gate line showing.

## 7. Docs

- [x] 7.1 The pages of line 29, from Proposed docs. `tests/docs.test.ts` stays green; the _Planned_ marks about private presets go.

## 8. Verify

- [x] 8.1 Map every Spec line to the test that exercises it, in the pull request body, and write a test for any line without one. Line 29 is checked by the docs tests and the review.
- [x] 8.2 The "For the build to confirm" facts: confirmed, or named as unverified in the body.
- [x] 8.3 The transcripts of `init`, `doctor`, and `sync` on a scratch repository beside Proposed docs' ("Checked by review").
- [x] 8.4 `npm run format`, `npx --no-install factory gate`, and `npm run pack-check`.
- [x] 8.5 `/factory-trace`: this changes every factory workflow a repository with an `.npmrc` gets.
