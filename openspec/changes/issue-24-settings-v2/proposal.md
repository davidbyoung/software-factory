# Proposal

From [davidbyoung/software-factory#24](https://github.com/davidbyoung/software-factory/issues/24).

## Why

The factory was drawn out of one repository, a Next.js website, and it still shows. A company on GitHub with a different stack would hit three problems:

- **Repository facts are assumed or written as prose.** The gate, the single-test command and the end-to-end command live in `CLAUDE.md` where nothing checks them, and the default branch is assumed to be `main` (`src/guard-commit.mts:170`, `src/session-start.mts:27-49`, `workflows/factory-check.yml:9`).
- **The skills and agents name one stack and one layout.** `AGENTS.md`, `next dev`, Vitest, Playwright page objects, Tailwind, a `tests` folder, a ".ts sibling", Codecov, `coverage/lcov.info`, `package-lock.json`, and "visitor" all appear in files every repository gets.
- **A company cannot swap in its own behavior** beyond adding a reviewer, a builder for a label, or a mockups skill. It cannot change how tickets are refined, how a test is proved able to fail, which test reviewers run, or how a generated file is rebuilt after a conflict.

This ticket makes the settings hold every repository fact, takes the stack out of the skills and agents, and makes plug-ins, grouped by phase, the one place a company swaps in its own behavior.

## What Changes

- **BREAKING:** `.claude/factory.yaml` becomes version 2. A version 1 file is refused, with no migration command.
- A `commands` block holds every command a build runs: `build-setup` and `before-commit`, moved from the top level, and the new `gate`, `test-one`, `end-to-end`, `coverage`, and `relock`. `specs` gains `check`.
- `plugins` is grouped by phase, with new slots: a `refiner` that replaces `factory-refine`, a `prover` that replaces `factory-mutate`, test reviewers as a whole list, and conflict resolvers.
- New commands: `factory gate`, `factory test-one`, `factory end-to-end`, `factory specs check`, `factory default-branch`, and `factory ticket refined N --check`.
- The default branch is read from the workflow's event, git, or the code host. Nothing names `main`.
- The skills, agents, rules, and review instructions name no stack and no folder layout, and call plug-ins by slot. A new optional `factory-e2e-reviewer` holds the end-to-end checks.
- This repository's own settings move to version 2.

## Capabilities

### New Capabilities

- `commands`: the `commands` block, and the commands that run it.
- `plugins`: the phase-grouped plug-ins, their slots, and `factory plugins`.
- `refined-check`: what makes a refined ticket sound, and the marker's refusal when it is not.
- `default-branch`: where the default branch's name comes from, and everything that used to name `main`.

### Modified Capabilities

- `settings`: version 2, the refusals of the old shape, and `specs` with `check`.
- `tool-setup`: `init` writes version 2 and names a missing gate; `doctor` shows it.
- `config-explain`: the new blocks.
- `docs`: each page that changes.

## Impact

Every repository that uses the factory rewrites its settings on the release that carries this. `src/config.mts`, `src/explain.mts`, `src/sync.mts`, `src/guard-commit.mts`, `src/session-start.mts`, `src/ticket.mts`, `src/init.mts`, `src/doctor.mts`, `src/cli.mts`, `settings.schema.json`, every skill and agent, `rules.md`, `review.md`, two workflows, the build action, and the docs.

## Decisions carried from the issue

Where a decision differs from the text above, the decision stands.

- **When `commands.gate` is not set, `factory gate` fails and says so.** A missing gate that passed would look the same as a passing one.
- **Reviewers still run after a builder plug-in builds a ticket,** as `docs/plugins.md` says. A reviewer the builder already ran gets a skip line saying so.
- **One ticket.** `refiner` and `prover` are kept, there is no `framing` slot, the spec check is under `specs`, the default branch is not a setting, and version 1 files are refused with no migration command.
- **The coverage script is not ported here.** #23 ports `patch-coverage.py`. This ticket only moves the coverage command and the report's path into the settings. Neither ticket has to be built first: both edit section 1b of `factory-address-review`, which is a merge conflict and not a build order.
- **`factory sync` writes the default branch's name into the push triggers** of `factory-check.yml` and `factory-conflicts.yml`, in place of the `[main, master]` list the text above names. With a fixed list, a repository whose default branch has another name would get its conflict sweep only nightly.
- **When the default branch cannot be told, a command stops and names the fix.** The commit guard blocks the git command the same way. Nothing assumes `main`.
- **Where there is nothing to ask, the default branch is git's own.** A checkout with no `origin` remote, such as a repository on the day `factory init` first runs, takes `init.defaultBranch`, or `main`. The stop above applies only where a remote exists and nobody answers.
- **The commit guard governs only a checkout with the factory's settings.** Elsewhere it reads `origin/HEAD` and nothing more, and lets a command through when that is not set.
- **`factory plugins` with no slot prints the whole list the factory will use,** the built-in refiner, prover, and test reviewer included, as `docs/plugins.md` says of it today.
- **`factory ticket refined` refuses a body the build could not read,** for the factory's own refiner as for a company's. That is the script's check of what a refiner delivers.
- **On the small path, no test reviewer runs,** whichever are listed under `plugins.test.reviewers`. The two exceptions in "Small changes" in `rules.md` run the whole list.
- **Each slot takes one kind.** Reviewers are agents, since a reviewer is launched and edits nothing. Every other slot is a skill.
- **`factory-e2e-reviewer` is written when `commands.end-to-end` is set,** the way `factory-ui-reviewer` is written when `site` is set.
- **`commands.relock` defaults to `npm install`,** since the factory itself is an npm package and every repository has its lock file. Any other lock file is a resolver plug-in's.
- **A new end-to-end spec is run ten times with `factory end-to-end FILE --times 10`,** in place of Playwright's `--repeat-each=10`.
- **`factory init` asks no new question.** It adds one "Left to do" line when no gate is set, and `factory doctor` shows a missing gate as off, without failing.
- **No build order.** Nothing open blocks this. #14 and #23 touch some of the same files, which the conflict sweep handles. davidbyoung/cfi#316 waits on this ticket's release; it is in another repository, so the relationship is stated there and not recorded.

## Not doing

- `approvers` and whose words a session obeys: #14.
- Porting `patch-coverage.py` or `tests/check-links.py`: #23.
- Renovate or any dependency bot but Dependabot; `dependabot[bot]` stays where it is in the code and workflows.
- Self-hosted runners and a `runs-on` setting.
- Package managers other than npm for installing the factory.
- Other ticket systems and code hosts.
- A `framing` plug-in slot, a `factory migrate` command, and reading version 1 files.
- A new question in `factory init`.
- The squash-merge assumption in `workflows/factory-merge-policy.yml` and `src/session-start.mts`.
- A script's check of what a `prover` reports: the pull request records it, as it records `factory-mutate`'s today.
