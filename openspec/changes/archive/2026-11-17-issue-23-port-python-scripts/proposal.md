# Proposal

From [davidbyoung/software-factory#23](https://github.com/davidbyoung/software-factory/issues/23).

## Why

The package is TypeScript run by Node, and Node is the only requirement the docs state. Two scripts are Python, carried over unchanged from the first commit: `skills/factory-address-review/patch-coverage.py`, which ships to every repository that installs the factory and is run with `python3`, and `tests/check-links.py`, which nothing runs but a person. The example in the `factory-mutate` skill is Python too. Neither script has a test.

## What Changes

- `factory pr uncovered [BASE] [LCOV]` prints what `patch-coverage.py` printed, and the script is deleted.
- Section 1b of `factory-address-review` names the command, and the example in `factory-mutate` is a Node script.
- The link check becomes tests in `tests/docs.test.ts`, so a relative link or an anchor that does not resolve fails the gate, and `tests/check-links.py` is deleted.
- Two tests fail on a `.py` file in the package, and on `python3` or a `python` fence in a skill, an agent, the rules, or the review instructions.

Decisions carried from the issue:

- The coverage check is the command `factory pr uncovered [BASE] [LCOV]`, beside `factory pr failed` and `factory pr unverified`. (Owner, 2026-11-17.)
- The Python example in `factory-mutate` is ported here too. (Owner, 2026-11-17.)
- `BASE` defaults to the default branch on `origin`, asked of the code host as `factory pr open` does, not to `origin/main`.
- The output is the Python script's, to the character.
- A missing coverage report is an error with a message.
- The link check is this repository's own test, so it has no requirement here.
- No build order with #24, and no `factory-trace` read: the two skill edits change a command's name and an example's language.

## Capabilities

### New Capabilities

- `pr-uncovered`: `factory pr uncovered`.

### Modified Capabilities

- `docs`: `docs/cli.md` lists the command.

## Impact

`src/patch-coverage.mts` (new), `src/pr.mts`, `src/cli.mts`, `skills/factory-address-review/`, `skills/factory-mutate/SKILL.md` and their copies under `.claude/skills/`, `tests/docs.test.ts`, `tests/boundary.test.ts`, and `docs/cli.md`. No setting changes, and nothing a workflow runs.
