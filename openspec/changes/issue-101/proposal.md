# Proposal

From [davidbyoung/software-factory#101](https://github.com/davidbyoung/software-factory/issues/101).

## Why

The poller of an organization starts builds in a repository whose `builds.trigger` is `manual` because nothing sets it: `specs/org-poller` says a file that does not set the key is polled, and "Branching, pushing, and review" in `.claude/factory/rules.md` and `docs/configuration.md` say no poller runs where it is `manual`. Found by factory-trace while building #86.

- **The poller leaves a repository whose settings in effect say `manual`** (the owner, 2026-11-27). When the repository's own `.claude/factory.yaml` sets no `builds.trigger`, the poller works it out from the presets the repository pins in `.claude/factory.lock`, with the choice in `.claude/factory.choices.yaml` where two disagree, and failing those the factory's default, `manual`, as `factory config get builds.trigger` would there.
- **Only the layers are combined:** the poller does not run the settings' full check, which looks for agent and skill files it cannot see.

## What Changes

- The organization's poller reads a repository's lock and choices as well as its settings file, and leaves the repository when the trigger they give is not `github-action`.

## Capabilities

### Modified Capabilities

- `org-poller`
