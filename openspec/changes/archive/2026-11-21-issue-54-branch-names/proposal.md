# Proposal

From [davidbyoung/software-factory#54](https://github.com/davidbyoung/software-factory/issues/54).

## Why

A build names its branch `issue-N-short-slug`, and only the build skill's text says so: nothing in the code builds the name or checks it. Companies have their own conventions, such as `feature/{user}/{ticket}`, and Jira's and Linear's integrations link a branch to its ticket by the key in its name, so the factory should follow the repository's convention rather than impose its own.

## What Changes

- **BREAKING** for a repository set up earlier: a new required setting, `code-host.branch-name`, a pattern with `{ticket}` and `{user}`. `factory config check` refuses a missing, mistyped, or faulty pattern, and `code-host: github` on one line.
- `factory init` asks for the pattern, offering `{ticket}`, and a re-run on settings missing only it, or #53's columns, fills it in.
- `factory ticket branch N` prints a ticket's branch; `factory specs change-name N` prints the OpenSpec change's name, `issue-N`; `factory pr for-branch BRANCH` prints the newest pull request from a branch.
- `factory config explain` prints `code-host` as a block.
- The build skill names its branch and change with those commands, and replaces an old branch whose pull request merged, or stops on any other.
- The docs say so, and `docs/updating.md` gains a section for a repository set up earlier.

## Capabilities

### New Capabilities

- `branch-name`: the setting, its checks, and the commands that read it.

### Modified Capabilities

- `tool-setup`: init's new question.
- `config-explain`: `code-host` printed as a block.
- `docs`: the configuration, CLI, updating, and presets pages.

## Impact

`src/config.mts`, `src/explain.mts`, `src/init.mts`, `src/ticket.mts`, `src/pr.mts`, `src/commands.mts`, `src/cli.mts`, `src/code-host/`, `settings.schema.json`, `skills/factory-build/SKILL.md`, this repository's `.claude/factory.yaml`, the docs, and every test fixture that writes settings.

## Decisions

- **Where the setting lives:** `code-host.branch-name`, as the ticket proposed, since branches belong to the code host.
- **Placeholders:** `{ticket}` and `{user}` only. No `{slug}` for now (owner, round 2), so `{ticket}` is required in every pattern: without it every build gets the same branch.
- **Required, with no default** (owner, round 3): the settings in effect must name it, from `.claude/factory.yaml` or a preset, as #53 does for `tickets.columns`. `factory init` asks for it, offering `{ticket}`. `code-host: github` on one line no longer passes, since the pattern needs the block.
- **A re-run of init** asks nothing when `branch-name` is already set, from the file or a preset, as for every other value init asks for (owner, in refinement; the draft had said it would ask again).
- **The command:** `factory ticket branch N` prints the branch; the build skill runs it and never spells a pattern itself.
- **The OpenSpec change's name** is `issue-{ticket}`, lowercased, printed by `factory specs change-name N`, whatever `branch-name` says. The build reads it once and keeps it through the archive.
- **A branch already on `origin`** (owner, in refinement): when the newest pull request from it merged and nothing was pushed to it since, the build deletes it and starts fresh, so the follow-ups ticket and a reopened ticket build again in a repository that keeps merged branches; otherwise the build stops before any work, naming the open pull request to work with `/factory-address-review N`, or saying how to delete the branch. No build resumes an unmerged branch. A new `factory pr for-branch BRANCH` tells the cases apart, since `factory pr` finds only a branch's open pull request today.
- **Not doing:** a pattern for the pull request's title, a `{type}` placeholder, and a placeholder that changes case, each left for the ticket system that needs it.
- **This repository's own pattern** is `"{ticket}"` (owner).
- **Blocked by #53.** A repository set up earlier meets the required setting at its next update, through the path #53 builds for columns: `factory-deps` stops on the settings error and opens a ticket, and `factory init` reads a file whose only fault is a missing required setting and asks for just that. Building #54 first would mean building that path here, then again in #53.
