# Proposal

From [davidbyoung/software-factory#13](https://github.com/davidbyoung/software-factory/issues/13), opened from #9.

## Why

Three parts the docs promise are not built: the `rules` setting, which `factory config check` refuses today; `factory config explain`; and the `factory-trace` skill, whose read a session does by hand today, as "Changing the process" in `rules.md` asks.

## What Changes

- `rules.small-change-lines` (default 30) and `rules.review-rounds` (default 2) become settings, and `factory sync` writes them into the copied rules and `factory-address-review`.
- `factory config explain` prints the settings filled in, marking each default.
- `factory sync` writes a `factory-trace` skill, and the rules call it.

Decisions carried from the issue:

- Build all three.
- `config explain` prints the settings file filled in, with `# default` beside each line you did not set. (Owner, 2026-11-16.)
- The numbers reach the agent through `sync`, as `session-minutes` does, not through a command at read time.
- `review-rounds` is the review's rounds only.
- `factory-trace` posts on the pull request when there is one.
- The rules call the skill; the build skills get no new step.

## Capabilities

### New Capabilities

- `rules-setting`: the two numbers the process rules use, as settings.
- `config-explain`: `factory config explain`.
- `trace-skill`: the `factory-trace` skill.

### Modified Capabilities

None.

## Impact

`src/config.mts`, `src/sync.mts`, `src/cli.mts`, `settings.schema.json`, `rules.md`, `skills/factory-trace/`, their tests, and `docs/`.
