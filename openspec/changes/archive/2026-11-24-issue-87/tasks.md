# Tasks

## 1. The plan

- [x] 1.1 `secretsWithheldBy` reads the second sign (lines 11 and 12). Verify in `tests/code-host-github.test.ts`, in "whether the secrets the owner shares reach the repository", with `orgs/acme` answering `{ login: "acme" }` and `rules/branches/main` refused with GitHub's "Upgrade to GitHub Pro" 403, listed, and refused otherwise. Today's "by a member who is no owner" test gains the rules answer.

## 2. The stop

- [x] 2.1 `factory init` stops (lines 1, 2, 3, and 5). Verify in `tests/init-organization.test.ts`, in "in a private repository of an organization whose plan keeps its secrets from it", on the whole output from the presets question on, the exit status, `r.asked`, and that no file, commit, or secret was written. "turns on no part that reads a secret, and asks for none" becomes this test.
- [x] 2.2 It goes on where it should (lines 4, 6, and 7). Verify with own secrets that meet every part, with one part met and the others named, with `pr-review` in the repository's own settings, and with a runner whose `secretNames` rejects: the stop's line is not printed, and `init` ends as it does today.
- [x] 2.3 The row and the sentence (lines 8, 9, and 10). Verify in the same file, with no preset checked, with and without the repository's own Claude token. The tests that read the old row and sentence there change, and those under "in an organization's repository its secrets do not reach" do not.

## 3. Doctor

- [x] 3.1 The fix on each withheld secret's line (line 13). Verify in `tests/doctor.test.ts`, in "counts no secret the organization's plan keeps from a private repository as set, and says why".

## 4. Docs

- [x] 4.1 `docs/github/setup.md` as under "Proposed docs". Verify with the docs tests in the gate, and `docs-reader` on the two sections.

## 5. Verify

- [x] 5.1 Map each Spec line to the test that exercises it, and write any that is missing.
- [x] 5.2 `factory gate`, and "Mockup and result" of the transcripts in the pull request.
