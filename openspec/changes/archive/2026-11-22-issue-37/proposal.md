# Proposal

From [davidbyoung/software-factory#37](https://github.com/davidbyoung/software-factory/issues/37).

## Why

Some teams don't use spec-driven development. `specs` already defaults to `none`, but `factory init` never asks, and with `none` no ticket gets the `spec` label, so a large change is refined as a bare list of acceptance criteria, with no design and no tasks, and its build has less to go on. The factory also calls OpenSpec by name from its skills, so no other spec tool could ever take its place.

## What Changes

- The `spec` label, and the ticket body that goes with it (Decisions, numbered Spec lines, and "For the builder" with its Design and Tasks), no longer depend on `specs`. A spec tool only adds a copy of the Spec in the repository.
- `factory init` asks "Which spec tool do you use?" when neither the settings file nor a preset sets `specs`, writes the answer, `specs: none` included, and installs OpenSpec with npm when it is chosen and `package.json` doesn't list it.
- Spec tools go behind an adapter interface in `src/specs/`. New commands `factory specs list`, `factory specs new N`, and `factory specs finish N`, beside `factory specs check`, are the only way skills reach a spec tool; `factory specs change-name N` is removed. With `specs: none` each prints `- No spec tool (specs: none): each ticket holds its own spec.`
- The refine and build skills, the readiness agent, and the rules run those commands, never `openspec`, and a test holds them to it.
- The docs say so.

## Capabilities

### New Capabilities

- `spec-tools`: the `factory specs` commands and the rule that nothing else runs a spec tool.

### Modified Capabilities

- `tool-setup`: init's spec tool question and install.
- `commands`: `factory specs check` with no spec tool.
- `cli-output`: the specs check's output with no spec tool.
- `branch-name`: the change's folder, with `change-name` removed.
- `docs`: the configuration, workflow, setup, CLI, limitations, glossary, and developing pages.

## Impact

- Every repository that installs the factory: a large visible change gets the full ticket body with `specs: none`, and its build runs `factory specs new` and `finish` in place of OpenSpec's commands.
- `src/merge-policy.mts` holds the adapters' process files in place of a literal path.

## Decisions

The issue's Decisions section holds them in full.
