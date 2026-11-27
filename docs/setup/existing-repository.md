# Add it to an existing repository

For someone adding the factory to a repository that already has a
toolchain, a board, instructions for a coding agent, a team, or several
packages. At the end you know what the factory leaves alone, and which
page covers your case.

## Try it without committing to it

Do the [quick start](../get-started/quick-start.md), and do not merge the pull request
`factory init` opens. Your checkout is left on that pull request's
branch, `set-up-factory`: start an agent session there and refine and
build one ticket. If you decide against it, close the pull request and
delete the branch. [Removing it](../maintain/removing.md) covers the case where you
have already merged.

## Your case

| What your repository already has                    | Where to go                                                                        |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| A board, or tickets with fields of their own        | [The board](../features/board.md#you-already-have-a-board)                         |
| Several packages in one repository                  | [A monorepo](../customize/monorepo.md)                                             |
| A language other than JavaScript                    | [Any language](../customize/any-language.md)                                       |
| Several people working on it                        | [Work as a team](team.md)                                                          |
| Commands of its own to check a change               | [Your commands](../customize/commands.md)                                          |
| Agent instructions, agent settings, or CI workflows | [The section below](#you-already-have-agent-instructions-settings-or-ci-workflows) |

## You already have agent instructions, settings, or CI workflows

- **Your agent's instructions file:** one line is added at the end,
  importing the factory's rules. Nothing else in it changes. Your own rules
  win where the two disagree.
- **Your agent's settings:** a few hooks are added, and the agent's
  attribution lines are turned off, so a session's commits and pull
  requests carry no line naming an AI: they are yours. A cloud build's
  commits name the agent as their author instead
  ([Builds in the cloud](../features/cloud-builds.md)). If your settings already
  say how to attribute, that stays. Your existing hooks, permissions, and
  settings stay as they are.
- **Your skills and agents:** untouched. Everything the factory adds is
  named `factory-...`, so nothing collides.
- **Your CI workflows:** untouched. The factory's are two files,
  `factory.yml` and `factory-review.yml`.
- **`factory init` says what it will write** before it writes, as three
  rows of its plan, `settings`, `files`, and `workflows`, and changes
  nothing if you say no. The pull request it opens shows every file.

The coding agent's page lists each file setup adds
([What setup adds](../integrations/claude-code.md#what-setup-adds)).

## What it does to your repository, in short

[What it changes](../maintain/removing.md) says what kinds of things the factory adds,
and how to undo each. The short version:

- Files it owns, all named `factory-...`, and its rules.
- One line in your agent's instructions file, and a few hooks in your
  agent's settings.
- Hooks that stop a session committing on your default branch or force
  pushing, and that run your
  [`commands.before-commit`](../reference/settings/commands.md#commandsbefore-commit)
  commands. They apply to agent sessions on a machine, not to your own
  terminal, and not in the cloud.
- Two CI workflow files, `factory.yml` and `factory-review.yml`. Their
  jobs check that the factory's files are in step, run sessions in the
  cloud, open the factory's updates as pull requests, and run each
  optional part you turn on. A job whose part is off is skipped.
- Comments on tickets it works, and a ticket for each
  [follow-up](../workflow/follow-ups.md) you tick in a pull request.
