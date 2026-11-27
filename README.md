# Software factory

> **Early, and not yet for general use.** This is below 1.0: it changes
> weekly, and any minor version may break what the one before it did,
> without notice. A repository stays on one exact version until you merge
> an update.

You already ask an AI assistant to write code. The hard part is everything
around it: saying clearly what you want, checking it built that, getting it
reviewed, fixing what the review finds, and doing it the same careful way
the hundredth time as the first.

The software factory does that part. You write a ticket. Your coding agent
turns it into a spec, a written statement of what the change must do,
asking you only the decisions that are yours, builds
it with tests, has it reviewed, answers the review, and hands you a pull
request to read. You decide what merges.

Two steps are yours: approving a ticket, and merging its pull request.
[How it works](docs/get-started/how-it-works.md) shows a ticket's path in
one picture.

## What you need

- A repository on GitHub, in any language, cloned on your machine, with
  the GitHub CLI signed in.
- Claude Code, signed in.
- Node 22.18 or later.

Nothing else to start: no board, no secrets, and nothing to host. If
your repository belongs to an organization, an owner may need to set the
organization up first: [Which setup is yours](docs/setup/README.md) says.

## Install

Once on your machine, for every repository you use it in:

```bash
npm install -g @davidbyoung/software-factory
```

Then [the quick start](docs/get-started/quick-start.md) takes you from
setting your repository up with `factory init` to your first built
ticket. [Install](docs/get-started/install.md) has the rest of what to
know about the command.

## Three commands in a session

Once the setup is merged, you work a ticket from a
[session](docs/reference/glossary.md), one conversation with your coding
agent in your repository:

| Run                          | What the session does                                          |
| ---------------------------- | -------------------------------------------------------------- |
| `/factory-refine 12`         | Asks the decisions that are yours, and writes ticket 12's spec |
| `/factory-build 12`          | Builds it with tests, and opens a pull request                 |
| `/factory-address-review 15` | Fixes or answers each comment on pull request 15               |

## Every day

| Run                | What it does                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| `factory status`   | Shows each ticket's state, which session has it, and its cost                                   |
| `factory doctor`   | Checks the setup, and says what to do about each fault                                          |
| `factory build 12` | Builds ticket 12 in the cloud, once [builds in the cloud](docs/features/cloud-builds.md) are on |
| `factory update`   | Opens a pull request that moves to a newer version                                              |

[Commands](docs/reference/cli.md) lists every one.

## What it works with

These are the tools it works with today, one choice of each kind.
[Integrations](docs/integrations/README.md) lists them all, with the
optional spec tool, which keeps specs in your repository.

| You need                   | Supported today | Page                                                    |
| -------------------------- | --------------- | ------------------------------------------------------- |
| A code host                | GitHub          | [GitHub](docs/integrations/github.md)                   |
| A ticket system            | GitHub Issues   | [GitHub Issues](docs/integrations/github-issues.md)     |
| A board, optionally        | GitHub Projects | [GitHub Projects](docs/integrations/github-projects.md) |
| A cloud runner, optionally | GitHub Actions  | [GitHub Actions](docs/integrations/github-actions.md)   |
| A coding agent             | Claude Code     | [Claude Code](docs/integrations/claude-code.md)         |

## What it holds to

1. **Your agent writes the code; a person approves it.** People approve
   the ticket, review the pull request, and merge it, and whoever merges
   answers for it.
2. **In the cloud, your agent holds no key.** It works in a sandbox with no
   sign-in to your code host. A separate step with no AI checks what the
   agent left before carrying any of it out
   ([How a cloud run is contained](docs/security/cloud-runs.md)).
3. **Everything waits for you unless you said otherwise.**
4. **It asks for almost nothing.** Every setting has a default, and a
   build needs one thing from you: the
   [commands that check a change](docs/reference/settings/commands.md).

## The docs

- [Get started](docs/get-started/how-it-works.md): how it works, installing
  it, and your first built ticket.
- [Set up](docs/setup/README.md): a repository, an organization, an
  existing repository, or a team.
- [Working a ticket](docs/workflow/README.md): each step from a ticket to a
  merge.
- [Features](docs/features/README.md): the review, the board, builds in the
  cloud, and the rest you can turn on.
- [Customize](docs/customize/commands.md): your commands, a monorepo, your
  own skills and agents, presets, and rules.
- [Integrations](docs/integrations/README.md): one page for each tool it
  works with.
- [Security](docs/security/cloud-runs.md): what a cloud run can reach, where
  tokens are kept, and the risks that remain.
- [Keep it running](docs/maintain/updating.md): updating, upgrade notes,
  troubleshooting, and removing it.
- [Reference](docs/reference/cli.md): commands, settings, skills, labels,
  and the glossary.
- [About](docs/about/design.md): why it works this way, and its
  limitations.

Anything these pages describe that is not built yet is marked
_Planned_, with what to do until then. Working on the factory itself:
[Developing](docs/developing.md).

## License

MIT.
