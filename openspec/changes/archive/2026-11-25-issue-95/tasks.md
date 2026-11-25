# Tasks

## 1. What init reads

- [x] 1.1 The variables' pages (line 17). Verify in `tests/setup-ops.test.ts`, "lists every page of the organization's variables shared with the repository", with a first page of 30.
- [x] 1.2 The listing that failed, and its row (lines 11 and 12). Verify in `tests/init-organization.test.ts` with `runnerFails` for `organizationSecretNames`, for `organizationVariableNames`, and for both, with a preset that turns parts on: the row, no stop, no "stay off" line, and no "not set up".
- [x] 1.3 `secretsPage` and `variablesPage`. Verify in `tests/code-host-github.test.ts`, beside the test of `appsPage`.

## 2. The stops

- [x] 2.1 The narrowed stop (lines 1, 2, 5, and 6). Verify in `tests/init-organization.test.ts`, in "factory init, in an organization's repository its secrets do not reach", on the whole output from the presets question on, the exit status, `r.asked`, and that no file, commit, or secret was written; then one case each for only the key missing, only the variable, and only the credential. "leaves the parts a preset turns on without asking for the tokens they read" becomes this test.
- [x] 2.2 The not set up stop (lines 3 and 4). Verify in the same describe with `--preset`, and, with `private: true` and `secretsWithheldBy`, "does not stop in an organization that is not set up" becomes line 4's test.
- [x] 2.3 However named, and where it goes on (lines 7, 8, 9, and 10). Verify for each stop, as the plan's tests do, with `--preset`, with the settings' list, with the part in the repository's own settings, with own secrets that meet every part, and with `secretNames` rejecting.

## 3. What stays off

- [x] 3.1 The line's place and its words (lines 13 and 14). Verify in the same file, with no preset checked. The existing tests that read the line right under `Found` change; "leaves one blank line before the plan when the settings answer everything" keeps its blank lines, and "leaves one blank line before the plan when the presets answer everything", which now would stop, gets the repository's own `FACTORY_BOARD_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN`.
- [x] 3.2 Where it is not printed (line 15). Verify with `pr-review` in the repository's own settings, with the credential among the repository's own secrets and among those shared, and with `secretNames` rejecting. "ends as it does today, with no stop for the presets, when the repository's own secrets cannot be listed" changes with it.

## 4. The checkbox

- [x] 4.1 "Builds in the cloud" is not offered (line 16). Verify with the repository's own secrets meeting every part: the second checkbox's names, and that the plan prints no `turn off` and no "so they are off too". "goes on when the repository's own secrets meet every part" is beside it.

## 5. Docs

- [x] 5.1 `docs/github/setup.md` and `docs/credentials.md` as under "Proposed docs". Verify with the docs tests in the gate, and `docs-reader` on the changed sections.

## 6. Verify

- [x] 6.1 Map each Spec line to the test that exercises it, and write any that is missing.
- [x] 6.2 `factory gate`, and "Mockup and result" of the transcripts in the pull request.
