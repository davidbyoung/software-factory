# Proposal

From [davidbyoung/software-factory#101](https://github.com/davidbyoung/software-factory/issues/101).

## Why

The poller of an organization starts builds in a repository whose `builds.trigger` is `manual` because nothing sets it: `specs/org-poller` says a file that does not set the key is polled, and "Branching, pushing, and review" in `.claude/factory/rules.md` and `docs/configuration.md` say no poller runs where it is `manual`. Found by factory-trace while building #86.

- **The poller leaves a repository whose settings in effect say `manual`** (the owner, 2026-11-27). When the repository's own `.claude/factory.yaml` sets no `builds.trigger`, the poller works it out from the presets the repository pins in `.claude/factory.lock`, with the choice in `.claude/factory.choices.yaml` where two disagree, and failing those the factory's default, `manual`, as `factory config get builds.trigger` would there.
- **The lock gives the settings in effect:** `factory sync` records them in `.claude/factory.lock`, combined from the presets, the choices, and the defaults, so the poller reads the trigger there rather than combining the layers again. The issue's notes had it combine them; the lock already holds the result, and CI keeps it in step with the settings file.

- **The settings-lock spec names what the poller reads** (the owner, follow-up 1 on the pull request): its line said `factory poller --once --preset FILE` reads FILE alone, which was false once it read each repository's settings file.

## What Changes

- The organization's poller reads a repository's lock when its settings file sets no `builds.trigger`, and leaves the repository when the trigger in effect is not `github-action`.
- The settings-lock line names the files the organization's poller reads from each repository.

## Capabilities

### Modified Capabilities

- `org-poller`
- `settings-lock`
