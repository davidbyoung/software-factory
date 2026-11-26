# Design

## Where it goes

- **The default policy:** a factory layer before the presets in `resolveFiles` (`src/config.mts`) and `combine` (`src/preset.mts`), holding `approval-policies: [credentials]`, whose sources `config explain` marks `# default`. `off: true` on it is not refused as "no preset names it". The agent-file check in `approvalPoliciesOf` accepts the factory's own agent as it accepts a preset's shipped file.
- **The files:** `approval-policies/credentials/find.mts` and `agents/factory-credentials-reader.md` in the package (add `approval-policies` to `package.json` `files`), written by `copies()` in `src/sync.mts` when the settings have the factory's `credentials` policy, through `NEEDS`.
- **`find.mts`:** reads the input JSON on standard input, as any check does. Lines 5 to 10 parse `diff` (unified, `+` lines with their new line numbers) and `files` (status `added` or `renamed` under `.github/workflows/`). Line 6's lookup runs `git grep -qwF NAME HEAD -- ':!**/docs/**' ':!**/test/**' ...` in the checkout it runs in: in the jobs that is the default branch's tip, and in `factory approval-policies check` it greps `origin/DEFAULT` instead, since the working folder holds the change. The commands job's checkout needs no more history for this. It imports nothing from the factory, so it runs in any repository.
- **The reader:** `agents/factory-credentials-reader.md`, front matter `model: opus`, body round 3's wording (kept below), with the answer shape the runner adds. Its second paragraph becomes: "A script found that this change touches a credential or widens what a workflow may do. The findings you are handed are the lines it found. Your working folder holds the default branch's code, and the diff you are handed is the change: the code after it is that folder with the diff applied." Its last paragraph becomes: "Report only a High, in the answer's shape. If you find nothing, answer with no findings." Test 2.4 checks those two paragraphs and `model: opus`.
- **`src/approval-agent.mts`:** the prompt on standard input (`claude -p` with stdin, no prompt argument); `model:` from front matter as `--model`; `Read(//proc/**)` in `AGENT_SETTINGS`' deny list.
- **`src/approval-job.mts`:** `agent` restricts the input's `files` and `diff` to the files the command's findings name; `resultsOf` and `summaryOf` keep a cleared outcome's findings.
- **`src/approval-policies.mts`:** the `cleared` outcome carries `found: Finding[]`.
- **`src/merge-policy.mts`:** `agentReasons` runs a `run`-and-`agent` policy's command with `runCommand` from `approval-policies.mts` (no credential), its input built from git as `prepare` builds it, the ticket included; the merge-policy job checks out with `fetch-depth: 0`, and the fetch of `refs/pull/N/head` is in code, as in `prepare`, so `workflows.test.ts`'s guard holds. This edits `.github/workflows/run.yml`, so the build runs on a person's machine.
- **`src/runner/github-actions.mts`:** `reviewsOf` asks `actions/workflows/factory.yml/runs?event=pull_request_target&head_sha=SHA`.
- **`src/lib/refined-check.mts`** and `src/ticket.mts`: `missingParts` takes a `has(name)` lookup, run by `refined` with `git grep` against `origin/DEFAULT` where it exists and `HEAD` otherwise, as in a cloud run's checkout of the default branch, outside docs and tests. The Threats check runs before the early return for a ticket without `spec`.
- **Skills:** `skills/factory-refine/SKILL.md` step 2 writes `## Threats` for such a ticket (the trace runs, since this changes a skill). `factory sync`, and commit the copies.
- **Docs:** as "Proposed docs".

## The reader's wording (round 3, tested)

The agent file's body is this text, round 3's, tested on six changes, with its last paragraph replaced by "Report only a High, in the answer's shape. If you find nothing, answer with no findings.", and its second paragraph's "FLAGGED.txt" and `git diff` read as "the findings and the diff you are handed":

```text
You are reading a change for security, and nothing else. You did not write it. Change nothing.

A script found that this change touches a credential or widens what a workflow may do. The lines it found are in FLAGGED.txt, as they stand after the change. The change is `git diff origin/main...HEAD` (leave out tests and docs), and the folder is the whole repository after it.

Take each credential and each permission those lines touch. Follow it from where it is stored to every process that can read it or use it, in the code, not in the comments. For each, work out:

1. What it opens, how far, and for how long: one repository or many, read or write, and when it ends.
2. Who can reach it: each job, step, and process that runs beside it, including one left running, its environment and its files. Count an AI agent as someone an attacker may be steering, since it reads text strangers write and runs commands. Count anyone who can open a pull request or push a branch.
3. What they could do with it that they could not do without it, and whether that outlasts the run or reaches past the repository.
4. Whether a person is needed for that to happen, and whether it can be undone.

Report only what you can trace, with each step's file and line. Rate by the worst real outcome, how likely it is, and whether it can be undone: High when a credential that outlasts the run, or reaches past the repository, can be taken by someone who should not have it, or when someone can do what a person had to approve. Medium when it takes an unlikely step first, or can be undone. Leave out anything lower, and anything that was as it is before this change.

Take the platform as given. Someone who can push to the repository can already edit a workflow on a branch and read any secret stored for the repository, so that alone is not a finding, for a person or for an automation that signs in as one. A finding is what this change itself adds past that: a credential in reach of a process that runs text or code from someone who cannot push, such as an AI agent, a package's install script, or a fork's pull request, or a person's approval that can now be skipped.

Answer with a list: severity, file and line, the threat in two sentences a person who has not read the code can follow, and how established tools handle the same thing, if you know. If you find nothing, say so in one line.
```

## Contracts

- `find.mts`: input and answer as any check's. Finding titles as lines 6 to 10.
- `refined` lines as line 21.
- `reviewsOf` URL as line 20.

## Edge cases

- A name defined in the same change in docs only: counts as new (line 6 looks outside docs).
- A renamed workflow with no added lines: line 9 still finds it.
- A pull request too large for one argument: line 13.
- A repository that has its own policy named `credentials`: it replaces the factory's (line 2).

## Risks and rollback

- False alarms on `KEY`: a pull request waits for a label. `off: true` turns the policy off in one line; the measurement task shows the rate before release.
- Every repository's pull requests gain the approval jobs and a required status on its next update: the release notes say so.

## Dependencies

- #104 merged. No ticket waits on this. The owner holds Release until it merges.
