# Design

## Where it goes

- `src/config.mts`: `Settings.version` becomes `2`. `beforeCommit` and `buildSetup` move under a `commands` object with `gate`, `testOne`, `endToEnd`, `coverage` (`{ run, report } | null`), and `relock`. `specs` stays the type string, so `factory config get specs` and every `s.specs` reader are unchanged, and a new `specCheck: string | null` holds the command. `Plugin.role` is replaced by `slot`, one of the seven names in line 37, parsed from the phase-grouped shape by one table that says, for each slot, its path, its kind, whether it is one or a list, and whether it takes `files`, `labels`, both optional, or neither. `SETTINGS_KEYS` gains the paths for `commands`, `commands.coverage`, `specs`, `plugins`, each phase, and each slot's block. `ROLES` becomes `SLOTS`. `pluginsOf` fills in the defaults of lines 40 to 44. `lookup` learns `commands.*` and `specs.check`.
- `settings.schema.json`: the same keys. `tests/settings-schema.test.ts` already fails when the two differ.
- `src/explain.mts`: lines 73 to 75, in the file's key order.
- `src/guard-commit.mts`: reads `commands.beforeCommit` (line 208 today), and takes the default branch's name from the new function in place of `"main"` at lines 170 to 178.
- New `src/lib/default-branch.mts`, following `src/lib/gh.mts`'s shape of a pure function over injected deps: the event payload at `GITHUB_EVENT_PATH` (`repository.default_branch`), then `git symbolic-ref --short refs/remotes/origin/HEAD`, then the code host's `defaultBranch()` (`src/code-host/github.mts:434`) followed by `git remote set-head origin NAME`; and with no `origin` remote, `git config init.defaultBranch` or `main`. A caller says which sources it allows: the commit guard in a checkout without settings allows `origin/HEAD` alone (line 69), and in one with settings allows all of them, so it asks the host at most once per checkout. `src/site/servers.mts:121-130` has a `defaultBranch` that falls back to `origin/main`: it is replaced by this one. `src/session-start.mts:27-49`, `src/deps.mts:49`, and `src/pr-watch.mts:120` take the name from it.
- New commands in `src/cli.mts`, each loading its module as the others do: `gate`, `test-one`, `end-to-end`, `specs check`, and `default-branch`. The four that run a settings command share one runner, `bash -c` from the root with the output passed through, as `guard-commit.mts` runs `before-commit` today. Put them in one new module, `src/commands.mts`, with its deps injected so tests give it a fake runner.
- `src/ticket.mts`, the `refined` case (line 614): the soundness check of lines 48 to 54, as a pure function over the ticket's body and labels, in `src/lib/` beside `work-status.mts`, with `--check` handled before the post.
- `src/sync.mts`: `NEEDS` gains `agents/factory-e2e-reviewer.md` on `commands.endToEnd !== null`. A new `withDefaultBranch(text, name, file)` beside `withSchedule` rewrites the one `branches:` line of the push trigger in `workflows/factory-check.yml` and `workflows/factory-conflicts.yml`, and fails when the file does not hold exactly one, as `withSchedule` does for the cron line. The comment at the top of `workflows/factory-conflicts.yml` that says it names main and master is reworded to match. `plan` takes the default branch as an argument, so it stays a pure function and `main` resolves the name.
- `src/init.mts:395`: `version` 2, and the "Left to do" line. `src/doctor.mts`: the off line, pushed where the parts' off lines are (line 155).
- `actions/factory-agent/action.yml:110`: `factory config get commands.build-setup`.
- New `agents/factory-e2e-reviewer.md`, holding what `agents/factory-test-reviewer.md` says today under "Playwright tests (e2e and smoke)" (lines 74 to 101) and its page-object and Tailwind-class checks.
- The skills, agents, `rules.md`, and `review.md`, as the tables above this section list, with these additions found in refinement:
  - Every "run the gate (`After every code change` in `CLAUDE.md`)" becomes `npx --no-install factory gate`: `factory-refine:221`, `factory-resolve-conflicts:141`, `factory-build:304`, `factory-deps:71,95`. The spec check at `factory-build:240,300` becomes `npx --no-install factory specs check`. One test alone at `factory-diagnose:19,27` becomes `factory test-one`, and an end-to-end spec `factory end-to-end`.
  - `factory-build:154,173` runs the skill `npx --no-install factory plugins refiner` prints. For a round that was waiting, it invokes that skill with the ticket's number and the words "approved while waiting: fold the owner's replies into the body, post no marker", then runs `factory ticket refined N --check` and stops with its output when the body is not sound. `factory-build:268-269` proves a new test with the skill `factory plugins prover` prints, and has each agent `factory plugins test-reviewer` prints read the tests, a reviewer with `files` only when the change touches them.
  - `factory-build:247-252` says the reviewers and everything after them still run after a builder plug-in, and that a reviewer the builder already ran gets the skip line "already run by the builder".
  - `factory-resolve-conflicts`: in the sweep, list the resolvers with `factory plugins resolver` and read each one's skill with `git show origin/BRANCH:.claude/skills/NAME/SKILL.md` before switching to a pull request's branch, and follow that text, never the branch's copy. A conflicted file matching a resolver's `files` is that resolver's; the package manager's lock file is `commands.relock`'s, after taking the default branch's copy of it.
  - `factory-mutate`'s example becomes a Node script that runs `npx --no-install factory test-one`, with no Python.
  - `factory-refine`'s front matter keeps `model: fable`: a model name is not a stack name.
  - `rules.md` "Small changes" names "the test reviewers (`factory plugins test-reviewer`)" where it names `factory-test-reviewer`.
- `CLAUDE.md` and `.claude/factory.yaml` of this repository: the settings file in version 2 as the text above gives it, and "After every code change" pointing at `factory gate` and the settings, keeping `npm run format`, `pack-check`, and `site-check` as the commands they are.
- `openspec/config.yaml` line 22 names the gate as `npm run format, ...`: reword to `factory gate`.

## The OpenSpec delta

Most lines are additions. Three groups change a requirement the current specs have, and are written as MODIFIED on it, not added beside it:

- `tool-setup`: "Init is unchanged with today's tools" gains lines 70 and 71, and "Doctor is unchanged with today's tools" gains line 72.
- `config-explain`: "Parts that are off and empty defaults print as comments" gains the comment lines of 73 and 75, and "Explain prints the settings filled in" the blocks of 73 to 75.
- `settings` has no requirement about `version`, `specs`, or `plugins`, so lines 1 to 9 are additions there.

## Contracts

- The environment variables a settings command gets: `FILE` and `NAME` for `commands.test-one`, `FILE` for `commands.end-to-end`, `DO_NOT_TRACK=1` for `specs.check`. Nothing else is added to the environment.
- `factory plugins` line format: `KIND NAME SLOT [FILES or LABELS...]`, space separated, as today with the slot where the role was.
- What a `refiner` is handed and returns, for `docs/plugins.md`: called with the ticket's number; posts `refining`, `waiting`, and `refined` with `factory ticket`; decides the `spec` label; records blockers with `factory ticket block`; writes the body with `factory ticket edit`; and is done when `factory ticket refined N` posts.
- What a `prover` is handed and returns: the new or changed tests; for each, the red run or the one mutation that made it fail, as lines the pull request body takes.
- What a resolver is handed and returns: the conflicted files matching its `files`, in a merge in progress; it leaves each resolved and staged, or says it cannot, which the sweep treats as a stop.

## States

n/a: no user interface.

## Edge cases

- `specs: none` written as a block with a `check`: line 7.
- `factory config get commands.coverage`, `factory config get before-commit`, and `factory config get build-setup` fail with `not a setting that prints`, as `lookup` already does for a block and for a key that is not one. No new line.
- The files line 45's patterns are matched against are the ones `listFiles` in `defaultDeps` gives today (`git ls-files --cached --others --exclude-standard`).
- The code host answers but `git remote set-head origin NAME` fails, as it can in a shallow or single-branch checkout: the host's answer stands, the command prints the name and exits 0, and the next run asks the host again.
- `factory end-to-end` with no FILE, `--times` with no value or a value that is not a whole number above zero, and any argument the command does not know, for it and for `factory test-one`, `factory gate`, `factory specs check`, and `factory default-branch`: usage on standard error and exit 2, as line 22.
- An empty `NAME`: check what the test runner does with an empty name filter before writing this repository's `commands.test-one`. If `npx vitest run $FILE -t ""` does not run the whole file, write it as `npx vitest run $FILE ${NAME:+-t "$NAME"}`, and use that form in the docs' example.
- A file that is version 1 and also has a top-level `before-commit`: the version is checked first, so line 2's message is the one printed. A file with no `version` fails with `version: must be 2`, as it fails with `must be 1` today (`src/config.mts:388`).
- Lines 11 and 35 give no wording: the message is whatever `strings` and `object` in `src/config.mts` print for the key today, and the test checks that the key's path is in it.
- A plug-in that trips both line 36 and line 47 prints whichever check runs first.
- `factory init` in a repository with no remote, and `npm run pack-check`, which installs into an empty repository: line 68 answers, so the sync inside them writes the two triggers with git's own default and does not fail.
- `plugins: {}` and a phase written with no slot: accepted, every slot at its default.
- `plugins.test.reviewers: []`: written, so no test reviewer runs, by line 43.
- Two builders sharing a label, or two resolvers matching one file: undefined today for builders (`factory-build:247-250`), and left so. The first listed is used; say so in `docs/plugins.md`.
- `origin/HEAD` pointing at a branch that was since renamed on the host: the name is stale until `git remote set-head origin --auto` runs. `docs/limitations.md` says so.
- `factory sync --check` in CI on a pull request: the event payload has the default branch, so it asks nobody.
- A settings command that reads standard input: the runner gives it none, as the build action does for `build-setup`.
- A ticket whose body has `## Spec` and `## Acceptance criteria` and no `spec` label, the small change that makes a spec line false: sound by line 49.

## Risks and rollback

- Every repository's settings break on the release that carries this, by design. The release notes and `docs/updating.md` lead with it, and issue 316 of the repository the factory was drawn out of tracks the one known repository to move.
- A wrong default branch would let the commit guard pass a commit on it. The guard blocks when it cannot tell, by line 61.
- The skills' rewording changes what every session does. The `factory-trace` read covers it before the pull request is marked ready, and the pull request waits for the owner.
- Rollback is the previous release: `factory.yaml` and the synced copies go back with the pull request that updated them.

## Dependencies

- No owner-only step.
- No blocked-by relationship in either direction (see Decisions).
