## 1. The check on a pull request

- [ ] 1.1 Give `review.yml` and `reviewWorkflow` `actions: read`, and run `node bin/factory.js sync`. Tests, changed first and seen red: the two of `tests/workflows.test.ts` under "the files GitHub runs from a pull request's copy", and "may only read the code, and passes nothing to the job it calls" in `tests/workflow-files.test.ts`, whose names now say the code and Actions. Add to `tests/workflows.test.ts` that what `factory-review.yml` grants equals what `review.yml` asks for, as "what factory.yml grants the jobs it calls" does.
- [ ] 1.2 Add the step to `review.yml`. Tests in `tests/workflows.test.ts` under "review.yml", with `sandbox` and `runScript` and a stub `gh`: one for each of Spec lines 1 to 7, with its exit code and its output, line 2 with `disabled_manually`; one that the `gh` call names the repository in `GITHUB_REPOSITORY`; and one that reads the step's `if`, for line 8, and that the job's other steps have no `GH_TOKEN`.

## 2. factory doctor

- [ ] 2.1 Check `factory.yml` for every repository, and turn a failed read into an `unknown` check. Tests in `tests/runner-setup.test.ts`: lines 11, 12, and 13 for each of `github-action`, `own-server`, and `manual`, replacing "is not checked with the %s trigger", and line 14 with a runner whose `workflowState` fails.
- [ ] 2.2 In `tests/doctor.test.ts`: line 14 through the whole command, with the other checks still printed and exit 0; and, where the organization's poller starts the builds, line 9's two lines in that order, which line 17 states too, rewriting "says its workflow is enabled there, in place of this repository's own workflow" and the three tests after it, which filter on `.yml`. Other tests there that list a whole "GitHub Actions" section, such as the one at "passes a token set for Actions and for Dependabot", gain the line.

## 3. The docs

- [ ] 3.1 Change the lines under "Proposed docs". `docs-reader` is skipped: no section is added or rewritten. The docs tests in the gate check the links.

## 4. Verify

- [ ] 4.1 Map every Spec line to the test that exercises it, name any without one, and write it. The "Mockup and result" comparison in the pull request sets "Proposed docs" beside what `factory doctor` and the live check printed.
- [ ] 4.2 Live check, from a person's machine, in a private scratch repository whose `factory-review.yml` calls `review.yml` at this branch: the check passes with `factory.yml is enabled`, fails with line 2's error after `gh workflow disable factory.yml`, and, after `gh workflow enable factory.yml` and a push, passes, with the verdict's job started. GitHub cannot be made to give `disabled_inactivity`, so line 1 rests on its test. Archive the repository after.
- [ ] 4.3 Run `factory-trace`, since the change alters what fails the check of `review.yml`, and what its two files ask for, in every repository.
- [ ] 4.4 `npm run format`, then `factory gate`, and `npm run pack-check`.
