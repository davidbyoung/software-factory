# Integrations

For someone who wants to know which tools Lunamill works with, or
what one of them needs. Lunamill works through six kinds of tool,
and the other sections of these docs name only the kind. This section
names the product: one page for each, all on the same headings, Jira's
aside until it is built.

| Kind of tool  | What Lunamill uses it for                                                  | Supported today                                                                        | Needed for                                                                                                                                                            |
| ------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code host     | Your repository, its pull requests, the checks on each commit, and secrets | [GitHub](github.md)                                                                    | Everything                                                                                                                                                            |
| Ticket system | Your tickets, their labels, and which one waits on another                 | [GitHub Issues](github-issues.md). Jira is _[Planned](../developing.md#what-is-built)_ | Everything                                                                                                                                                            |
| Board         | Every ticket's state in one view                                           | [GitHub Projects](github-projects.md)                                                  | The board, and builds that start from it                                                                                                                              |
| Cloud runner  | Work that runs with no one at a keyboard                                   | [GitHub Actions](github-actions.md)                                                    | The automated review, the board, builds in the cloud, pull requests that merge themselves, dependency updates, and approval policies, the credentials policy included |
| Coding agent  | The sessions that refine, build, and answer a review                       | [Claude Code](claude-code.md)                                                          | Everything                                                                                                                                                            |
| Spec tool     | Keeping each ticket's spec in your repository                              | [OpenSpec](openspec.md)                                                                | Only keeping specs in your repository, which is optional                                                                                                              |

Two more pages cover what is not a kind of tool:

- [GitHub organizations](github-organizations.md): what an
  organization's owner sets up once, for every repository in it.
- [Private npm registries](private-npm.md): letting Lunamill's jobs
  in the cloud install your private packages.

## How each coding agent runs a skill

A skill is a set of instructions a session follows, such as
`lunamill-refine`. These docs write one the way Claude Code runs it,
`/lunamill-refine 12`, and this table gives each coding agent's way:

| Coding agent | How you run a skill   |
| ------------ | --------------------- |
| Claude Code  | `/lunamill-refine 12` |
