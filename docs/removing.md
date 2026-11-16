# What it changes, and removing it

What the factory adds to your repository, your code host, and your board,
and how to undo it. Read this before you install, and again if you decide
to take it out. On GitHub with Claude Code,
[the reference](github/reference.md#what-setup-adds) names every file,
hook, label, and setting.

## What it adds

- **In your repository:** its settings file, `.claude/factory.yaml`, and a
  lock file beside it; its own skills, agents, rules, and CI workflows, all
  named `factory-...`; one line in your agent's instructions file that
  imports its rules; and a few hooks in your agent's settings that guard
  every session. If you had no `package.json`, setup adds a small one to
  install the factory with.
- **On your code host:** the secrets you create for the parts you turn on;
  the labels and statuses that say who merges a pull request and whether
  the automated review found it ready; comments on the tickets it works;
  and one "Follow-ups" ticket.
- **On your board,** if you have one: three fields, Session, Runs in, and
  Cost, which `factory init` adds when the board lacks
  them, and the board's own Status, which the sync sets. `init` adds any of
  the six columns the board lacked.
- **Outside both,** only if builds start from your board: the poller,
  wherever you host it.

## What it never touches

Your code, your tickets, and your pull requests. Your own skills, agents,
plug-ins, and CI workflows, which the factory never writes to.

Two files belong to you, and removing the factory leaves them: the CI
workflow that runs the automated review, which you edit to install your
project, and the review notes you write for it.

## Removing it _[Planned](developing.md#what-is-built)_

Until `factory remove` is built, delete by hand what
[the reference](github/reference.md#what-setup-adds) lists.

```bash
factory remove
```

```bash
npm uninstall @davidbyoung/software-factory
```

The first command removes everything it added to your repository and
prints what is left for you to remove by hand: secrets, labels, and
anything outside the repository. It commits nothing. Review the changes,
commit them on a branch, and merge.

## Before you remove it

- **If builds are running,** let them finish or stop them first. Open
  tickets and pull requests stay exactly as they are.
- **If you made the review's verdict a required check** on your main
  branch, remove that requirement first, or every pull request waits on it
  forever.
- **Deleting a label removes it from every ticket.** Keep the labels if
  you want their history.
- **The comments it posted on tickets stay.** They hold each ticket's
  history.

## Undoing one part, not all of it

Each optional part can be turned off by itself. Remove its key from
`.claude/factory.yaml`, then:

```bash
factory sync
```

That deletes the CI workflows the part used. Delete its secret afterward.
