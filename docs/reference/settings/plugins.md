# `plugins`

Your own skills and agents, doing a job kodor would otherwise do
itself, or adding to it. Each job is a **role**. For example, an agent you
list in the `reviewers` role reads every change that touches its files,
alongside kodor's own reviewers. Roles are grouped by the part of
the work they belong to: `refine`, `build`, `test`, and `conflicts`.

```yaml
plugins:
  build:
    reviewers:
      - agent: migration-reviewer # .claude/agents/migration-reviewer.md
        files:
          - db/migrations/**
```

Every role is optional. Leaving one out never turns a step off: kodor does that step its own way. A reviewer is an agent, since it only
reads and reports. Every other role takes a skill, which the session
follows itself. [Your own skills and agents](../../customize/plugins.md) says what each role is handed and
what it has to give back.

| Role                  | What you list | How many | When it is used                                                                               | If you list none                                                                                                         |
| --------------------- | ------------- | -------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `refine.refiner`      | A skill       | One      | Whenever a ticket is refined                                                                  | `kodor-refine` refines tickets                                                                                           |
| `refine.mockups`      | A skill       | One      | Whenever a decision changes how something looks                                               | `kodor-design` draws mockups if you set [`site`](site.md#site), and otherwise the session describes the choices in words |
| `build.builders`      | Skills        | A list   | For a ticket with one of the builder's `labels`. Each builder needs at least one              | kodor's own build builds every ticket                                                                                    |
| `build.reviewers`     | Agents        | A list   | When a change touches one of the reviewer's `files`. Each reviewer needs at least one pattern | Only kodor's own reviewers read a change                                                                                 |
| `test.prover`         | A skill       | One      | Whenever a new test needs proof that it can fail                                              | `kodor-mutate` proves each new test can fail                                                                             |
| `test.reviewers`      | Agents        | A list   | When a change touches tests. A reviewer given `files` reads only changes to those             | `kodor-test-reviewer` reads new tests                                                                                    |
| `conflicts.resolvers` | Skills        | A list   | When a conflict is in one of the resolver's `files`. Each resolver needs at least one pattern | The session merges conflicts by hand, and [`commands.relock`](commands.md#commandsrelock) rebuilds the lock file         |

In [Claude Code](../../integrations/claude-code.md#skills-in-claude-code),
a skill lives at `.claude/skills/NAME/SKILL.md` and an agent at
`.claude/agents/NAME.md`.

- **`kodor plugins`** prints every plugin kodor will use, its own
  included, one per line: skill or agent, its name, its role, and its
  files or labels. `kodor plugins reviewer` prints one role's.
- **A plugin can come from a [preset](presets.md#presets),** which ships its agent
  or skill too. To leave out one that a preset adds to a list, name it
  here with `off: true`:

  ```yaml
  plugins:
    build:
      reviewers:
        - agent: acme-security-reviewer
          off: true
  ```

- **`kodor config check`** stops on an agent in a role that takes a
  skill, or the other way round; on `files` or `labels` in a role that
  doesn't take them; on a builder with no `labels`; on a build reviewer or
  resolver with no `files`; on a skill or agent whose file doesn't
  exist and no preset ships; and on `off: true` for a plugin no preset
  names, where the fix is to delete that entry. It warns on a `files`
  pattern that matches no file.

## `plugins.refine`

- **`refiner`:** your own skill for refining a ticket, used instead of
  `kodor-refine`.
- **`mockups`:** your own skill for drawing the choices when a decision
  changes how something looks.

A role that takes one plugin is a block, not a list:

```yaml
plugins:
  refine:
    refiner:
      skill: acme-refine # .claude/skills/acme-refine/SKILL.md
    mockups:
      skill: design-mockups
```

## `plugins.build`

- **`builders`:** your own skill for building certain tickets, used
  instead of kodor's build for any ticket with one of its `labels`.
  If two builders share a label, the first one listed builds the ticket.
- **`reviewers`:** your own agents, each asked to read a change that
  touches a file matching its `files`. The pattern only decides who is
  asked: the agent's own description says when it really applies. One
  that was asked but didn't apply gets a line in the pull request saying
  why.

```yaml
plugins:
  build:
    builders:
      - skill: add-endpoint
        labels:
          - new-endpoint
    reviewers:
      - agent: migration-reviewer
        files:
          - db/migrations/**
```

## `plugins.test`

- **`prover`:** your own skill for proving a new test can fail, used
  instead of `kodor-mutate`.
- **`reviewers`:** the agents that read new and changed tests. **This list
  replaces the default,** so `kodor-test-reviewer` runs only if you list
  it, and `reviewers: []` means no test reviewer runs. Without `files`, a
  reviewer reads every change to tests; with `files`, only changes to
  matching files. `kodor-e2e-reviewer` needs
  [`commands.end-to-end`](commands.md#commandsend-to-end).

```yaml
plugins:
  test:
    prover:
      skill: acme-mutation
    reviewers:
      - agent: kodor-test-reviewer
      - agent: kodor-e2e-reviewer
        files:
          - e2e/**
```

## `plugins.conflicts`

- **`resolvers`:** your own skills for files that should be rebuilt rather
  than merged by hand after a conflict, such as a generated API client.
  Each handles the files matching its `files`. If two match one file, the
  first one listed rebuilds it.
- **A new resolver is used once it has merged,** since conflicts are fixed
  using the default branch's copy of this file, never a pull request's.

```yaml
plugins:
  conflicts:
    resolvers:
      - skill: regenerate-api-client
        files:
          - src/generated/**
```
