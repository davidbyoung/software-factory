# Proposal

From [davidbyoung/software-factory#27](https://github.com/davidbyoung/software-factory/pull/27).

## Why

Three names in the settings and the docs read wrong to a developer new to the factory:

- `ci-review` configures the automated pull request review, not CI, so it reads as a duplicate of the repository's CI files.
- "Slot" is not what anyone calls the job a skill or an agent is given. "Role" is.
- "Plug-in" is hyphenated where every tool a developer knows writes "plugin".

## What Changes

- **BREAKING:** the settings key `ci-review` becomes `pr-review`. A file that still says `ci-review` fails `factory config check` with `ci-review: unknown key`. `docs/updating.md` lists the rename.
- `factory config explain` prints `# pr-review: off` where it printed `# ci-review: off`.
- "Slot" becomes "role" in the docs, the specs, the code, and the `factory plugins` usage line. The role names and their paths do not change.
- "Plug-in" becomes "plugin" everywhere.

## Capabilities

### Modified Capabilities

- `config-explain`: the comment for the review when it is off.
- `plugins`: "role" for "slot".
- `docs`: the page names and wording that follow.
