# What it changes, and removing it

What the factory adds to your repository, your code host, and your board,
and how to undo it. Read this before you set it up, and again if you
decide to take it out. On GitHub with Claude Code,
[the reference](github/reference.md#what-setup-adds) names every file,
hook, label, and setting.

## What it adds

- **In your repository:** its settings file, `.claude/factory.yaml`, and a
  lock file beside it; its own skills, agents, and rules, all named
  `factory-...`; two CI workflow files, `factory.yml` and
  `factory-review.yml`; one line in your agent's instructions file that
  imports its rules; and a few hooks in your agent's settings that guard
  every session. Nothing is installed there: no `package.json` entry and
  no `node_modules/`.
- **On your machine:** the `factory` command, installed once, and the
  versions of the factory it downloads, in `~/.cache/software-factory/`.
- **On your code host:** the secrets you create for the parts you turn on;
  the labels and statuses that say who merges a pull request and whether
  the automated review found it ready; comments on the tickets it works;
  and one "Follow-ups" ticket.
- **On your board,** if you have one: three fields, Session, Runs in, and
  Cost, which `factory init` adds when the board lacks
  them, and the board's own Status, which the sync sets. `init` adds the
  columns your settings name that the board lacked.
- **Outside both,** only if you host the poller: the poller, wherever you
  host it. `factory remove` names it in what is left by hand.

## What it never touches

Your code, your tickets, and your pull requests. Your own skills, agents,
plugins, and CI workflows, which the factory never writes to.

One file belongs to you, and removing the factory leaves it: the review
notes you write for the automated review. The two workflow files are
the factory's: every sync rewrites them, and removing the factory
deletes them.

## Removing it

```bash
factory remove
```

It shows every file it will delete or change and asks
before changing anything. It then deletes the factory's files, takes its
hooks and its import line out of the files it shares with your coding
agent, and prints what is left outside the repository for you to remove by
hand, grouped by the tool it belongs to: secrets, the rule that requires
the review's verdict, labels, the board's fields, and a token kept on your
machine. Each tool you use adds its own lines to that list. It
commits nothing. Review the changes, commit them on a branch, and merge.

If your settings file is gone or cannot be read, it says so, removes what
it finds, and names what the tools it ships with leave behind.

It leaves the setting that turns off your agent's lines naming itself in
commits and pull requests, as
[the reference](github/reference.md#what-setup-adds) says. If setup
installed a spec tool with npm, it also leaves that tool's
`package.json` entry and the `node_modules/` line in your `.gitignore`:
remove them with npm if nothing else uses them.

The `factory` command stays on your machine, for your other
repositories. If you no longer want it anywhere:

```bash
npm uninstall -g @davidbyoung/software-factory
```

Then delete `~/.cache/software-factory/`, where it kept each version it
downloaded.

## Before you remove it

- **If builds are running,** let them finish or stop them first. Open
  tickets and pull requests stay exactly as they are.
- **If you made the review's verdict a required check** on your default
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

That turns the part's job off in the two workflow files. Delete its
secret afterward.
