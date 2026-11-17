# Proposal

From [davidbyoung/software-factory#8](https://github.com/davidbyoung/software-factory/issues/8),
with two items from [#9](https://github.com/davidbyoung/software-factory/issues/9).

## Why

`factory init` sets up the code host, the ticket system, the cloud runner,
and the coding agent, but a tool cannot tell `init` what it needs: a
second ticket system such as Jira would have to edit `init` to ask for its
site address and token, and Claude Code is written into `init` with no
interface at all. Each tool should say what it needs, so that adding one
makes `init` ask for its setup, `doctor` check it, and `remove` take it
out.

## What Changes

- Each kind of tool (code host, ticket system, cloud runner, and coding
  agent) declares its setup: values for the settings, secrets with how to
  get them, its own checks, its own configuration, and what is left
  behind when the factory is removed. `init` and `doctor` walk those
  declarations instead of naming GitHub and Claude Code.
- Claude Code gets an interface of its own, with no setting yet.
- `factory remove` is built, as `docs/removing.md` describes it.
- A repository that has never had the factory is set up from the quick
  start alone, by a cold agent, and the docs it trips on are fixed.

Decisions carried from the issue:

- **Scope:** the setup contract is built now, for all four kinds, proven
  with test-only fakes. (Owner, 2026-11-16.)
- **Doctor too:** `doctor` asks each tool for its checks. (Owner,
  2026-11-16.)
- **Re-initialize** is a re-run of `init`, which skips what is already
  set unless you choose to replace the secrets.
- **Today's wording stays,** word for word; a tool supplies its own text.
- **A ticket system's own settings go under `tickets`,** accepted only
  when the chosen ticket system declares them.
- **Choosing a tool:** the code host comes from the git remote; ticket
  systems and runners are asked for only when more than one is available.
- **One edge changes:** with cloud builds on, no board, and
  `FACTORY_BOARD_TOKEN` set, `init` no longer asks for
  `FACTORY_BUILD_TOKEN`, since cloud builds read either.
- **A tool's own configuration is checked,** so a missing configuration
  of a future tool such as Codex is flagged the way Claude Code's is.
  (Owner, 2026-11-16.)
- **`factory remove`** deletes only the factory's files in the repository
  and prints what is left outside it. The review's workflow is the
  factory's, so `remove` deletes it.
- **The trial** is run by a cold agent with no tokens, on a throwaway
  private repository. (Owner, 2026-11-16.)

## Capabilities

### New Capabilities

- `tool-setup`: what `init`, `doctor`, and `config check` ask of each tool
  to set it up and check its secrets.
- `remove`: `factory remove`, taking the factory out of a repository.
- `tool-configuration`: each tool's own configuration, and `doctor`'s
  check of it.

### Modified Capabilities

None.

## Impact

`src/init.mts`, `src/doctor.mts`, `src/parts.mts`, `src/config.mts`,
`src/cli.mts`, `src/sync.mts` (exports), the three tool folders and a new
`src/agent/`, a new `src/setup.mts`, `src/tools.mts`, and
`src/remove.mts`, their tests, and `docs/`. No setting or secret changes
shape.
