# Set up an organization

For an owner of an organization, before any of its repositories turns
on a feature that runs in the cloud. At the end the organization holds
the settings and secrets its repositories share, and each developer sets
a repository up with one command.
[Which setup is yours](README.md) says whether to start here.

## Set an organization up, once

For an owner of the organization, with the GitHub CLI signed in, Claude
Code, and the `factory` command ([What you need](repository.md#what-you-need)). You
need no repository. The command needs three permissions for the GitHub
CLI that a plain sign-in lacks, `admin:org`, `project`, and `workflow`.
When one is missing, its first question is whether to open your browser
so you can grant it. Give the organization's address, from any folder:

```bash
factory init --org https://github.com/acme
```

It asks which board to use: a new one, made with the factory's columns,
or one the organization already has. For a board you already have, it
reads the board's own columns and has Claude Code suggest which column
shows each of a ticket's six states, as
[You already have a board](../features/board.md#you-already-have-a-board)
shows for a repository. You confirm or change the answer, and the
command adds only the columns and fields still missing, which its plan
names on the `board` row.

It asks how a build names its branch, with `{ticket}` offered, so ticket
12 is built on a branch named `12`. Press Enter for that, or type the
pattern your teams use. The answer goes in the preset, as
[`code-host.branch-name`](../reference/settings/code-host.md#code-host), so a developer
setting up a repository is not asked.

It then asks what pays for
[builds in the cloud](../features/cloud-builds.md): a Claude subscription, for which it
runs `claude setup-token` and you paste the token it prints, or an API
key, which you paste. The command creates a repository named
`factory-config` in the organization, to hold the settings its
repositories share. It is private, except on GitHub's Free plan. When it
is private, the command also asks how often
[the poller](../features/builds-from-the-board.md#the-poller) reads the board, because each run
of the poller then bills at least one Actions minute. Then it lists what
it will do and asks "Go ahead?", where Enter alone answers no. After
`y`, it prints:

```text
✓ Created board 12, "Software factory".
✓ Created acme/factory-config.

Registering the GitHub App "Software Factory for acme". Two steps, both in your browser.

1. Create the app. Your browser should open this address. If it does not, open it yourself:
     http://127.0.0.1:4100/
   Then press "Create GitHub App".
   Waiting for GitHub to send your browser back. If that page does not load, paste its address here:
✓ Created the app, and stored its key for acme.

2. Install it. Your browser should open this address. If it does not, open it yourself:
     https://github.com/apps/software-factory-for-acme/installations/new/permissions?suggested_target_id=4242
   Choose all repositories, or a selection that includes factory-config, and press "Install".
   Waiting up to 10 minutes for the installation to show.
✓ Installed the app on 212 repositories.

The coding agent's token: running claude setup-token...
? Paste the token it printed, the line that starts sk-ant-oat01- (leave empty to do this later):
Trying the token...
✓ Stored 2 secrets and 1 variable for acme.
✓ Required "Review verdict" where the property software-factory is "on".

✓ acme is set up.

Next, in each repository you want the factory in:
  1. A developer installs the factory once on their machine:
       npm install -g @davidbyoung/software-factory
  2. In the repository's checkout, they run:
       factory init
     It asks them for no token, and opens the pull request that sets the repository up.

The settings every repository shares are yours to edit:
     https://github.com/acme/factory-config/blob/HEAD/factory-preset.yaml
The steps in full:
     https://github.com/davidbyoung/software-factory/blob/v0.4.0/docs/setup/organization.md#what-each-developer-does-next
```

The terminal says what to press at each of the two steps in your
browser. What it does not say:

- **The first address is on your own machine,** where the command hands
  GitHub the form it has filled in. If GitHub says the App's name is
  taken, change it on the form before you press the button.
- **Step 1's page may not load when it sends your browser back,** as
  when you reach the machine over SSH and the browser is on another.
  Copy that page's address from the browser into the terminal.
- **Which repositories you choose in step 2 decides where a build can
  act as the App.**
  [Who can use the App's key](../security/credentials.md#who-can-use-the-apps-key)
  says what follows from it.
- **Under WSL,** the command opens each page in your Windows browser
  when `wslview` or `explorer.exe` is there. It prints the address
  either way.

**It worked when** it prints `✓ acme is set up.` It leaves you with:

| What it created                                                                                                    | Where to find it                                            |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| The GitHub App "Software Factory for acme", which builds in the cloud act as                                       | The organization's Settings, GitHub Apps                    |
| Two secrets and a variable, which [Tokens and secrets](../security/credentials.md#on-github) names                 | The organization's Settings, Secrets and variables, Actions |
| The repository `acme/factory-config`, with the organization's preset and its one poller                            | Among the organization's repositories                       |
| The rule "Software factory", which requires "Review verdict" in each repository set up with the factory            | The organization's Settings                                 |
| A board with the factory's columns and fields, or the board you chose, with its own columns and whatever it lacked | The organization's Projects                                 |

The preset, `factory-preset.yaml`, is yours to edit. Under
[`code-host`](../reference/settings/code-host.md#code-host) it holds the pattern builds
name their branches by. Under
[`tickets.columns`](../reference/settings/tickets.md#ticketscolumns) it names the
board's column for each state: the factory's own names on a new board,
and the columns you confirmed on a board you already had. Edit them
there if the board's columns change.

**To run it again,** as after a run that stopped, give the same command.
It does only what is missing, and asks whether to replace the Claude
token, with the day it stops working. In its last 30 days, Enter
replaces it; otherwise Enter keeps it, and you answer yes only if it has
been revoked
([When the Claude token's year is up](../integrations/claude-code.md#when-the-claude-tokens-year-is-up)).
Where the App is registered and not installed yet, it prints only the
step that installs it, with the address to open. With
nothing missing, it ends `✓ acme is set up. Nothing to do.`

```text
? CLAUDE_CODE_OAUTH_TOKEN is already stored for acme, and works until 2027-11-25. Replace it? Only if it has been revoked. Press Enter for no:
```

Three things stay by hand, on GitHub:

| What has happened                                              | What you do                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The App's key has to be replaced                               | Follow [Replacing the App's key](../integrations/github-organizations.md#replacing-the-apps-key)                                                                                                                                                                       |
| A run fails because the App is not installed on its repository | The failed run prints the address of the organization's installations page. Add the repository there. A ticket moved to Ready in such a repository starts no build and gets no comment: the poller's run in `factory-config` shows a warning that names the repository |
| A later release of the factory needs a new permission          | In the organization's Settings, GitHub Apps, GitHub shows a request to review beside the App after such a release. Accept it                                                                                                                                           |

## What each developer does next

Send each developer who will use the factory these two steps, which the
command printed after `✓ acme is set up.`:

1. Install the factory once on their machine
   ([Install](../get-started/install.md)).
2. In each repository's checkout, run `factory init`. It asks them for no
   token, and opens the pull request that sets the repository up.

[In an organization](repository.md#in-an-organization) says what that run
shows them, and what to do when it stops.
