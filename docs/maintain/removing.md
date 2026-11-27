# What it changes, and removing it

What the factory adds to your repository, your code host, and your board,
and how to undo it. Read this before you set it up, and again if you
decide to take it out. On GitHub with Claude Code,
[the reference](../integrations/claude-code.md#what-setup-adds) names every file,
hook, label, and setting.

## What it adds

- **In your repository:** its settings file, `.claude/factory.yaml`, and a
  lock file beside it; its own skills, agents, and rules, all named
  `factory-...`; two CI workflow files, `factory.yml` and
  `factory-review.yml`; one line in your agent's instructions file that
  imports its rules; and, in your agent's settings, a few hooks that guard
  every session and the folder a ticket's other repositories are cloned
  into. Nothing is installed there: no `package.json` entry and
  no `node_modules/`.
- **On your machine:** the `factory` command, installed once, and the
  versions of the factory it downloads, in `~/.cache/software-factory/`.
  In `~/.local/share/software-factory/work/`, the clones of a ticket's other
  repositories, until `factory workspace N --remove` removes them.
  In `~/.config/software-factory/`, on your own account, the access
  token and the coding agent's token that `factory init` also stored in
  your repository's secrets, and, for any account, the presets you last
  followed ([The file on your machine](../security/credentials.md#the-file-on-your-machine)).
- **On your code host:** the secrets you create for the parts you turn on;
  the labels and statuses that say who merges a pull request and whether
  the automated review found it ready; comments on the tickets it works;
  the tickets it opened; and, on a public repository on GitHub, the
  Actions policy named "Software factory", which lets the factory's
  workflow run.
- **On your code host, once for an organization,** when an owner set it
  up with `factory init --org`: the organization's own app, which its
  cloud builds act as; the app's key and the coding agent's token, as
  secrets, and a variable that names the app; a repository named
  `factory-config`, for the settings its repositories share; a property
  named `software-factory`, a value the organization keeps for each
  repository; and a rule that requires the review's verdict wherever
  that property is "on".
  [Taking an organization's setup out](#taking-an-organizations-setup-out)
  lists them.
- **On your board,** if you have one: three fields, Session, Runs in, and
  Cost, which `factory init` adds when the board lacks
  them, and the board's own Status, which the sync sets. `init` adds the
  columns your settings name that the board lacked.
- **Outside both,** only if you host the poller: the poller, wherever you
  host it. `factory remove` names it in what is left by hand.

## On your machine

| What                                                                                                         | Added when                                                                                                                   | To undo                                                                   |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| The `factory` command, and each version it downloads, in `~/.cache/software-factory/`                        | You install it, and a repository names a version                                                                             | `npm uninstall -g @davidbyoung/software-factory`, and delete the folder   |
| A GitHub access token and a Claude token, in `~/.config/software-factory/credentials.yaml`                   | `init`, on your own account, when you paste them ([Tokens and secrets](../security/credentials.md#the-file-on-your-machine)) | Delete your account's entries from the file, which `factory remove` names |
| The presets you last followed for each account or organization, in `~/.config/software-factory/presets.yaml` | `init`, when you follow a preset                                                                                             | Delete the file                                                           |

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
the review's verdict, labels, the board's fields, and each token kept on
your machine, which on your own account are the access token and the
coding agent's token. Each tool you use adds its own lines to that list.
In a repository of an organization that is set up, the list starts with
the one thing only an owner can do:

```text
Ask an owner of acme to set the software-factory property to "off" for acme/web: until then every pull request waits on its "Review verdict" check
```

It commits nothing. Review the changes, commit them on a branch, and
merge.

It does not name the "Software factory" policy that `factory init` adds
on a public repository on GitHub. Delete that one by hand too, in the
repository's Settings, under Actions, Policies.

If your settings file is gone or cannot be read, it says so, removes what
it finds, and names what the tools it ships with leave behind.

It leaves the setting that turns off your agent's lines naming itself in
commits and pull requests, as
[the reference](../integrations/claude-code.md#what-setup-adds) says. If setup
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
- **If an owner set your organization up** with `factory init --org`,
  the organization's rule requires that check, in every repository
  whose `software-factory` property is "on". Ask an owner to set that
  property to "off" for your repository first, under the organization's
  Settings, Custom properties.
- **Deleting a label removes it from every ticket.** Keep the labels if
  you want their history.
- **The comments it posted on tickets stay.** They hold each ticket's
  history.

## Taking an organization's setup out

For an owner of an organization that was set up with
`factory init --org`. No command does this: each step is by hand, on
GitHub, in this order.

1. **Delete the rule, then the property.** In the organization's
   Settings, under Rules, delete the rule "Software factory". Then,
   under Custom properties, delete the property `software-factory`. With
   the rule gone, no pull request waits on "Review verdict", so the next
   step's pull requests can merge.
2. **Take the factory out of each repository.** Run `factory remove`
   there, as [Removing it](#removing-it) shows, and merge what it
   changed. Do this before step 4: once the app is gone, a repository
   that still has the factory's workflows fails its runs.
3. **Delete the repository `factory-config`.** That stops the
   organization's one [poller](../features/builds-from-the-board.md#the-poller), which starts
   builds from the board.
4. **Uninstall the app, then delete it.** In the organization's
   Settings, under GitHub Apps, uninstall the app whose name starts
   "Software Factory for". Then, under Developer settings, GitHub Apps,
   delete it.
5. **Delete the secrets and the variable.** In the organization's
   Settings, under Secrets and variables, Actions, delete the secrets
   `FACTORY_APP_PRIVATE_KEY` and `CLAUDE_CODE_OAUTH_TOKEN`, or
   `ANTHROPIC_API_KEY`, and the variable `FACTORY_APP_CLIENT_ID`. Leave the
   coding agent's secret if another workflow of yours reads it.
6. **Keep the board, or delete it,** in the organization's Projects. It
   is an ordinary Project.

**It worked when** a pull request in a repository that was set up can
merge with no "Review verdict" check listed as required.

## Undoing one part, not all of it

Each optional part can be turned off by itself. Remove its key from
`.claude/factory.yaml`, then:

```bash
factory sync
```

That turns the part's job off in the two workflow files. Delete its
secret afterward.
