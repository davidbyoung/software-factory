# What it changes, and removing it

What kodor adds to your repository, your code host, and your board,
and how to undo it. Read this before you set it up, and again if you
decide to take it out. Each tool's page lists what setup adds there:
[Claude Code](../integrations/claude-code.md#what-setup-adds) for the
files in your repository,
[GitHub](../integrations/github.md#what-setup-adds),
[GitHub Projects](../integrations/github-projects.md#what-setup-adds), and
[GitHub organizations](../integrations/github-organizations.md#what-setup-adds).

## What it adds

- **In your repository:** its settings file, `.claude/kodor.yaml`, and a
  lock file beside it; its own skills, agents, and rules, all named
  `kodor-...`; two CI workflow files, `kodor.yml` and
  `kodor-review.yml`; one line in your agent's instructions file that
  imports its rules; and, in your agent's settings, a few hooks that guard
  every session and the folder a ticket's other repositories are cloned
  into. Nothing is installed there: no `package.json` entry and
  no `node_modules/`.
- **On your machine:** the `kodor` command, installed once, and the
  versions of kodor it downloads, in `~/.cache/kodor/`.
  In `~/.local/share/kodor/work/`, the clones of a ticket's other
  repositories, until `kodor workspace N --remove` removes them.
  In `~/.config/kodor/`, on your own account, the access
  token and the coding agent's token that `kodor init` also stored in
  your repository's secrets, and, for any account, the presets you last
  followed ([The file on your machine](../security/credentials.md#the-file-on-your-machine)).
- **On your code host:** the secrets you create for the parts you turn on;
  the labels and statuses that say who merges a pull request and whether
  the automated review found it ready; comments on the tickets it works;
  the tickets it opened; and, on a public repository, the policy named
  "kodor", which lets kodor's workflow run where the code
  host needs one ([GitHub](../integrations/github.md#a-public-repository)).
- **On your code host, once for an organization,** when an owner set it
  up with `kodor init --org`: the organization's App, which its
  cloud builds act as; the App's key and the coding agent's token, as
  secrets, and a variable that names the App; a repository named
  `kodor-config`, for the settings its repositories share; a property
  named `kodor`, a value the organization keeps for each
  repository; and a rule that requires the review's verdict wherever
  that property is "on".
  [Taking an organization's setup out](#taking-an-organizations-setup-out)
  lists them.
- **On your board,** if you have one: three fields, Session, Runs in, and
  Cost, which `kodor init` adds when the board lacks
  them, and the board's own Status, which
  [the board sync](../features/board.md) sets. `init` adds the
  columns your settings name that the board lacked.
- **Outside both,** only if you host the poller: the poller, wherever you
  host it. `kodor remove` names it in what is left by hand.

## On your machine

| What                                                                                              | Added when                                                                                                                   | To undo                                                                 |
| ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| The `kodor` command, and each version it downloads, in `~/.cache/kodor/`                          | You install it, and a repository names a version                                                                             | `npm uninstall -g @kodor-ai/kodor`, and delete the folder               |
| The code host's access token and the coding agent's token, in `~/.config/kodor/credentials.yaml`  | `init`, on your own account, when you paste them ([Tokens and secrets](../security/credentials.md#the-file-on-your-machine)) | Delete your account's entries from the file, which `kodor remove` names |
| The presets you last followed for each account or organization, in `~/.config/kodor/presets.yaml` | `init`, when you follow a preset                                                                                             | Delete the file                                                         |

## What it never touches

Your code, your tickets, and your pull requests. Your own skills, agents,
plugins, and CI workflows, which kodor never writes to.

One file belongs to you, and removing kodor leaves it: the review
notes you write for the automated review. The two workflow files are
kodor's: every sync rewrites them, and removing kodor
deletes them.

## Removing it

```bash
kodor remove
```

It shows every file it will delete or change and asks
before changing anything. It then deletes kodor's files, takes its
hooks and its import line out of the files it shares with your coding
agent, and prints what is left outside the repository for you to remove by
hand, grouped by the tool it belongs to: secrets, the rule that requires
the review's verdict, labels, the board's fields, and each token kept on
your machine, which on your own account are the access token and the
coding agent's token. Each tool you use adds its own lines to that list.
In a repository of an organization that is set up, the list starts with
the one thing only an owner can do:

```text
Ask an owner of acme to set the kodor property to "off" for acme/web: until then every pull request waits on its "Review verdict" check
```

It commits nothing. Review the changes, commit them on a branch, and
merge.

It does not name the "kodor" policy that `kodor init` adds
on a public repository. Delete that one by hand too, from where
[GitHub's A public repository, under By hand](../integrations/github.md#a-public-repository-1)
says it is added.

If your settings file is gone or cannot be read, it says so, removes what
it finds, and names what the tools it ships with leave behind.

It leaves the setting that turns off your agent's lines naming itself in
commits and pull requests, as
[What setup adds](../integrations/claude-code.md#what-setup-adds) says. If setup
installed a spec tool with npm, it also leaves that tool's
`package.json` entry and the `node_modules/` line in your `.gitignore`:
remove them with npm if nothing else uses them.

The `kodor` command stays on your machine, for your other
repositories. If you no longer want it anywhere:

```bash
npm uninstall -g @kodor-ai/kodor
```

Then delete `~/.cache/kodor/`, where it kept each version it
downloaded.

## Before you remove it

- **If builds are running,** let them finish or stop them first. Open
  tickets and pull requests stay exactly as they are.
- **If you made the review's verdict a required check** on your default
  branch, remove that requirement first, or every pull request waits on it
  forever.
- **If an owner set your organization up** with `kodor init --org`,
  the organization's rule requires that check, in every repository
  whose `kodor` property is "on". Ask an owner to set that
  property to "off" for your repository first, under the organization's
  Settings, Custom properties.
- **Deleting a label removes it from every ticket.** Keep the labels if
  you want their history.
- **The comments it posted on tickets stay.** They hold each ticket's
  history.

## Taking an organization's setup out

For an owner of an organization that was set up with
`kodor init --org`. No command does this: each step is by hand, on
the code host, in this order.

1. **Delete the rule, then the property.** In the organization's
   Settings, under Rules, delete the rule "kodor". Then,
   under Custom properties, delete the property `kodor`. With
   the rule gone, no pull request waits on "Review verdict", so the next
   step's pull requests can merge.
2. **Take kodor out of each repository.** Run `kodor remove`
   there, as [Removing it](#removing-it) shows, and merge what it
   changed. Do this before step 4: once the app is gone, a repository
   that still has kodor's workflows fails its runs.
3. **Delete the repository `kodor-config`.** That stops the
   organization's one [poller](../features/builds-from-the-board.md#the-poller), which starts
   builds from the board.
4. **Uninstall the app, then delete it.** Uninstall the app whose name
   starts "kodor for", then delete it, as
   [By hand on GitHub organizations](../integrations/github-organizations.md#by-hand)
   shows.
5. **Delete the secrets and the variable.** In the organization's
   Settings, under Secrets and variables, Actions, delete the secrets
   `KODOR_APP_PRIVATE_KEY` and `CLAUDE_CODE_OAUTH_TOKEN`, or
   `ANTHROPIC_API_KEY`, and the variable `KODOR_APP_CLIENT_ID`. Leave the
   coding agent's secret if another workflow of yours reads it.
6. **Keep the board, or delete it,** in the organization's Projects. It
   is an ordinary Project.

**It worked when** a pull request in a repository that was set up can
merge with no "Review verdict" check listed as required.

## Undoing one part, not all of it

Each optional part can be turned off by itself. Remove its key from
`.claude/kodor.yaml`, then:

```bash
kodor sync
```

That turns the part's job off in the two workflow files. Delete its
secret afterward.
