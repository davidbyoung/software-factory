# Setting up on GitHub, with Claude Code

For someone setting the factory up with GitHub as the code host, GitHub
Issues for tickets, a GitHub Project for the board, GitHub Actions for
[builds](../glossary.md) in the cloud, and Claude Code as the coding
agent. Start where this table sends you:

| Who you are                                             | Where to start                                                                                                      | What you have at the end                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| One person, with repositories on your own account       | [Run `factory init`](#run-factory-init), then [On your own account](#on-your-own-account)                           | A pull request that sets your repository up, with the parts you chose      |
| A developer in an organization that an owner has set up | [Run `factory init`](#run-factory-init), then [In an organization](#in-an-organization)                             | The same pull request, with no token pasted                                |
| An owner of an organization that is not set up yet      | [Set an organization up, once](#set-an-organization-up-once). You need no repository, and skip "Run `factory init`" | An organization whose developers each set a repository up with one command |

## What you need

| Tool                                | Check it with                        | If it is not ready                                                      |
| ----------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| A GitHub repository, with Issues on | Its Issues tab                       | On GitHub: Settings, General, Features, check "Issues"                  |
| The GitHub CLI, signed in           | `gh auth status`                     | `gh auth login`                                                         |
| Claude Code, signed in              | `claude --version`                   | [Install it](https://claude.com/claude-code), run `claude`, and sign in |
| Node 22.18 or later                 | `node --version`                     | [nodejs.org](https://nodejs.org)                                        |
| The `factory` command               | `factory`, which prints its commands | [Install it](../quick-start.md#1-install), once on your machine         |

Nothing of the factory's is installed in a repository. Without Claude
Code, `factory init` stops and changes nothing. An owner setting an
organization up needs every row but the first, and goes straight to
[Set an organization up, once](#set-an-organization-up-once).

## Run `factory init`

In the repository you are setting up:

```bash
factory init
```

It names the repository on its first line, which it works out from your
checkout's remotes. When they hold a fork, or more than one repository,
it asks which one you are setting up. It stops when your checkout has
commits the default branch lacks, so run it from the default branch. In
a repository with no commits yet, it first offers to make an empty
first commit and push it, or to push the commits your checkout has,
since a pull request needs a branch to merge into.

Before it asks anything else, it reads [presets](../presets.md), the
settings several repositories share, and it asks only what they leave
open. It looks for a repository named `factory-config` in your account
or your organization, and asks which of its presets this repository
follows. When there is none, it offers the presets your machine last
followed there. To name the presets yourself, give each one with
`--preset`, as in `factory init --preset acme/platform-settings`. For
each preset you follow, it prints what that preset changes here, as
[`factory preset add`](../presets.md#adding-a-preset) does.

It asks which parts you want, less any that a preset or a stored secret
decides. Each is optional. With none, you refine and build tickets in a
[session](../glossary.md) on your machine, as the
[quick start](../quick-start.md) does:

| Part                                            | What you get                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An automated review of every pull request       | Claude reads each pull request once it is ready, comments, and gives a verdict, the "Review verdict" status. From the first workflow run after the setup's pull request merges, that status is required, so a pull request cannot merge until the review passes it. It posts as `github-actions`, so there is no app of Claude's to install |
| A board                                         | A GitHub Project showing each ticket's state, its session, and its cost                                                                                                                                                                                                                                                                     |
| Builds in the cloud                             | A ticket builds in GitHub Actions, with no session open on your machine                                                                                                                                                                                                                                                                     |
| Builds that start when you move a card to Ready | Moving a ticket to Ready on the board builds it                                                                                                                                                                                                                                                                                             |
| Pull requests that merge themselves             | A pull request that touches only files you listed merges once its checks pass                                                                                                                                                                                                                                                               |
| Signed commits on the factory's updates         | The pull requests that update the factory show as "Verified". A session's own commits in the cloud are never signed. Not offered in an organization's repository, where an update acts as the organization's App ([Where your tokens are kept](../credentials.md#on-github))                                                                |

On a first run, the first three start checked, where they are offered.

It asks these, and skips any that a preset or your settings already
answer:

| Question                                         | When it is asked                                                        | What you do                                                                                                                                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What to name the branch a build pushes           | Always                                                                  | Press Enter for `{ticket}`, so ticket 12 is built on a branch named `12`, or type your team's pattern, such as `feature/{user}/{ticket}` ([`code-host`](../configuration.md#code-host)) |
| Which spec tool you use                          | Always                                                                  | Choose None, unless you want OpenSpec to keep a folder in your repository that describes what your project does ([`specs`](../configuration.md#specs))                                  |
| Which board                                      | With "A board"                                                          | Choose a new one, made with the factory's columns, or a Project you already have                                                                                                        |
| Which files may merge without you                | With "Pull requests that merge themselves"                              | Type their patterns, such as `docs/**`. Start with a short list                                                                                                                         |
| Where [the poller](../builds.md#the-poller) runs | With "Builds that start when you move a card to Ready"                  | Choose a schedule on GitHub Actions or a server you host. [Builds in the cloud](../builds.md) compares them                                                                             |
| Which command checks a change                    | Always                                                                  | Type it, such as `npm test`. A build cannot finish without one ([`commands.gate`](../configuration.md#commandsgate))                                                                    |
| The token your `.npmrc` reads                    | When `.npmrc` reads one ([Private npm packages](#private-npm-packages)) | Paste a token that can only read from your registry                                                                                                                                     |

Before it changes anything, it lists what it will do and asks "Go
ahead?". Type `y`: Enter alone answers no, and nothing changes. Then it
writes the settings and the factory's files
([What it changes](../removing.md) lists them), runs the command you
gave to check a change, and opens a pull request from a new branch,
`set-up-factory`. When that command fails, it commits nothing.

```text
✓ npm run check passes here.
✓ Opened acme/web#41, "Set up the software factory".
Merge it to finish. Nothing else is left to do.

After it merges:
  1. Come back to main and bring it up to date:
       git switch main && git pull
  2. Start a new session of your coding agent here. It loads the factory from the files now in your repository.
  3. Refine a ticket with /factory-refine N, then build it with /factory-build N.
The steps in full:
     https://github.com/davidbyoung/software-factory/blob/v0.4.0/docs/quick-start.md#4-open-a-ticket
```

Merge the pull request, then do what those lines say: your checkout is
left on `set-up-factory`, and the first step names your own default
branch.

**It worked when** init printed `✓ Opened` with the pull request's
number, and, after the merge, `factory doctor` shows ✓ on every line, or
`-` for a part you left off.

### On your own account

After "Go ahead?", the [steps above](#run-factory-init) also ask you
for up to two tokens, each when a part you chose reads it, plus the
token your `.npmrc` reads when it reads one:

| Token                                 | Asked for when you chose                                                   | What you do                                                                                                                                                                                                                                                                                                              |
| ------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The token `claude setup-token` prints | "An automated review of every pull request" or "Builds in the cloud"       | Init runs the command for you. If it gives you a code in the browser, paste that back to it. Then copy the token it prints, the line that starts `sk-ant-oat01-`, and paste it to init, over two lines if that is how it was printed. Init tries the token before it stores it, and asks again if Claude Code refuses it |
| A GitHub access token                 | "A board", "Builds in the cloud", or "Pull requests that merge themselves" | Init opens GitHub's page with the right scopes checked. Choose an expiry, generate the token, and paste it                                                                                                                                                                                                               |

Each of the two is typed into a masked prompt, stored in the
repository's secrets, and kept on your machine, so your next repository
asks for neither
([Where your tokens are kept](../credentials.md#on-github)). Leave a
prompt empty to skip it, and run `factory init` again when you have the
token. To share settings between your repositories, put a preset in a
repository named `factory-config`
([Writing a preset](../presets.md#writing-a-preset)).

**It worked when** init prints the first line here, and in your next
repository the second:

```text
It belongs to sam. Stored for sam/api, and on this machine for your next repository.
✓ Stored 2 secrets for sam/web from this machine.
```

### In an organization

The [steps above](#run-factory-init) ask you for no token. In the list
init prints first, headed `Found`, the `Organization` row reads one of
five ways:

```text
  Organization     acme, set up: its app's key and its Claude token are stored
  Organization     acme, not set up: an owner runs factory init --org https://github.com/acme
  Organization     acme, set up, but its secrets do not reach this repository: GitHub Free shares them only with public repositories
  Organization     acme, set up, but its secrets do not reach this repository: GitHub Free shares them only with public repositories, or an owner narrowed them
  Organization     acme: its secrets could not be listed (gh api repos/acme/web/actions/organization-secrets?per_page=100&page=1: gh: You must have repository read permissions or have the repository secrets fine-grained permission. (HTTP 403))
```

- **With the first,** init lists the presets in the organization's
  `factory-config`, and you check the ones this repository follows. It
  offers "Pull requests that merge themselves", and any other part the
  presets leave open.
- **With the second,** ask an owner to
  [set the organization up](#set-an-organization-up-once). If they say it
  is set up already, its secrets are not shared with your repository:
  [When the organization's secrets do not reach you](#when-the-organizations-secrets-do-not-reach-you).
- **With the third,** which ends at "public repositories", yours is a
  private repository on GitHub's Free plan.
  [On GitHub's Free plan](#on-githubs-free-plan) says what to do.
- **With the fourth,** which ends "or an owner narrowed them", init could
  not tell which of the two it is.
  [When the organization's secrets do not reach you](#when-the-organizations-secrets-do-not-reach-you)
  says what to ask an owner for. If yours is a private repository, ask them
  first whether the organization is on GitHub's Free plan: if it is, sharing
  the secrets does not help, and
  [On GitHub's Free plan](#on-githubs-free-plan) says what does.
- **With the fifth,** init could not look, and the parentheses hold
  GitHub's reason. If it is that you lack access, ask an admin of the
  repository for write access, which setting it up needs anyway, and run
  `factory init` again. For any other reason, run it again later.

With the second, the third, or the fourth, init stops and changes nothing
if one of the repository's [presets](../presets.md) turns on a board, the
review, or builds that start from the board, as the one
`factory init --org` writes does. Its line that starts ✗ names which.
Otherwise it goes on, the review and builds in the cloud stay off, and
builds on your machine work. Once the owner has made the change, run
`factory init` again.

**It worked when** the row is the first, and, once the setup's pull
request has merged, `factory doctor` shows ✓ on every line, or `-` for a
part that is off. Your first build in the cloud then opens its pull
request. If that build fails with the line below, the organization's App
is not installed on your repository, and the page it names is where an
owner of the organization adds it:

```text
The software factory's app for acme is not installed on acme/web. An owner of acme adds it: https://github.com/organizations/acme/settings/installations
```

#### When the organization's secrets do not reach you

You need an owner of the organization for this. If init stopped, send them
what it printed, which lists only what your repository lacks:

```text
✗ The presets turn on a board, the review, and builds that start from the board. They need acme's secrets, and those do not reach acme/web.
An owner of acme gives acme/web access to each of these, under "Repository access". Then run factory init again.
  Secrets: FACTORY_APP_PRIVATE_KEY, and CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY
     https://github.com/organizations/acme/settings/secrets/actions
  Variable: FACTORY_APP_CLIENT_ID
     https://github.com/organizations/acme/settings/variables/actions
```

If it went on instead, it listed nothing, and said that the review and
builds in the cloud stay off until the organization's secrets reach your
repository. Send the owner the lines above from "Secrets" on, with your
organization's name in place of `acme` in the two addresses, and your
repository's name.

On those two pages the owner opens each secret and the variable, and under
"Repository access" picks a choice that includes your repository, such as
all repositories. Of the two names for what pays for Claude, only the one
the organization stored is there. If one is missing from the page, the
owner first [sets the organization up](#set-an-organization-up-once).

**It worked when** the `Organization` row says the app's key and the
Claude token are stored, once you run `factory init` again.

If the owner keeps the secrets from your repository on purpose, you have
two choices:

- **Build only on your machine.** Run `factory init` and leave the presets
  that turn those parts on unchecked. If `.claude/factory.yaml` lists one
  under [`presets`](../configuration.md#presets), take its line out first.
  It worked when init asks "Go ahead?".
- **Store tokens on the repository in place of the organization's
  secrets.** You need two, a GitHub token as `FACTORY_BOARD_TOKEN` and a
  Claude token as `CLAUDE_CODE_OAUTH_TOKEN`, and neither of the App's
  values. [Secrets](by-hand.md#secrets) says how to make each, and the
  command that stores it. It worked when `factory init` asks "Go ahead?"
  with the presets checked.

## Set an organization up, once

For an owner of the organization, with the GitHub CLI signed in, Claude
Code, and the `factory` command ([What you need](#what-you-need)). You
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
[You already have a board](../existing-repo.md#you-already-have-a-board)
shows for a repository. You confirm or change the answer, and the
command adds only the columns and fields still missing, which its plan
names on the `board` row.

It asks how a build names its branch, with `{ticket}` offered, so ticket
12 is built on a branch named `12`. Press Enter for that, or type the
pattern your teams use. The answer goes in the preset, as
[`code-host.branch-name`](../configuration.md#code-host), so a developer
setting up a repository is not asked.

It then asks what pays for
[builds in the cloud](../builds.md): a Claude subscription, for which it
runs `claude setup-token` and you paste the token it prints, or an API
key, which you paste. The command creates a repository named
`factory-config` in the organization, to hold the settings its
repositories share. It is private, except on GitHub's Free plan. When it
is private, the command also asks how often
[the poller](../builds.md#the-poller) reads the board, because each run
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
     https://github.com/davidbyoung/software-factory/blob/v0.4.0/docs/github/setup.md#in-an-organization
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
  [Who can use the App's key](../credentials.md#who-can-use-the-apps-key)
  says what follows from it.
- **Under WSL,** the command opens each page in your Windows browser
  when `wslview` or `explorer.exe` is there. It prints the address
  either way.

**It worked when** it prints `✓ acme is set up.` It leaves you with:

| What it created                                                                                                    | Where to find it                                            |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| The GitHub App "Software Factory for acme", which builds in the cloud act as                                       | The organization's Settings, GitHub Apps                    |
| Two secrets and a variable, which [Where your tokens are kept](../credentials.md#on-github) names                  | The organization's Settings, Secrets and variables, Actions |
| The repository `acme/factory-config`, with the organization's preset and its one poller                            | Among the organization's repositories                       |
| The rule "Software factory", which requires "Review verdict" in each repository set up with the factory            | The organization's Settings                                 |
| A board with the factory's columns and fields, or the board you chose, with its own columns and whatever it lacked | The organization's Projects                                 |

The preset, `factory-preset.yaml`, is yours to edit. Under
[`code-host`](../configuration.md#code-host) it holds the pattern builds
name their branches by. Under
[`tickets.columns`](../configuration.md#ticketscolumns) it names the
board's column for each state: the factory's own names on a new board,
and the columns you confirmed on a board you already had. Edit them
there if the board's columns change.

**To run it again,** as after a run that stopped, give the same command.
It does only what is missing, and asks whether to replace the Claude
token, with the words below. Answer yes only if the token has expired
or been revoked. Where the App is registered and not installed yet, it
prints only the step that installs it, with the address to open. With
nothing missing, it ends `✓ acme is set up. Nothing to do.`

```text
? CLAUDE_CODE_OAUTH_TOKEN is already stored for acme. Replace it? Only if it has expired or been revoked.
```

Three things stay by hand, on GitHub:

| What has happened                                              | What you do                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The App's key has to be replaced                               | Follow [Replacing the App's key](../credentials.md#replacing-the-apps-key)                                                                                                                                                                                             |
| A run fails because the App is not installed on its repository | The failed run prints the address of the organization's installations page. Add the repository there. A ticket moved to Ready in such a repository starts no build and gets no comment: the poller's run in `factory-config` shows a warning that names the repository |
| A later release of the factory needs a new permission          | In the organization's Settings, GitHub Apps, GitHub shows a request to review beside the App after such a release. Accept it                                                                                                                                           |

### On GitHub's Free plan

The `Plan` row, in the list the command prints first, headed `Found`,
says when the organization is on it. Then
`factory-config` is public, so anyone can read the shared settings in
it. What follows differs for the organization's public and private
repositories:

- **A public repository** gets the review and builds in the cloud. There
  is no organization-wide rule, so once its setup merges, an admin of
  that repository runs `factory init` again, which requires "Review
  verdict" there. The command's closing lines list that as a third
  step:

  ```text
    3. Once that pull request merges, an admin of the repository runs factory init there
       again, to require "Review verdict". GitHub Free has no organization-wide rules.
  ```

- **A private repository** can't use a [preset](../presets.md) that turns
  on a board, the review, or builds that start from the board, since the
  plan does not share the organization's secrets with it. `factory init`
  there stops, changes nothing, and names them:

  ```text
  ✗ The presets turn on a board, the review, and builds that start from the board. They need acme's secrets, and GitHub Free does not share them with a private repository.
  ```

  Make the repository public, or move the organization to a paid plan, and
  run `factory init` again. To build only on your machine, run it and leave
  that preset unchecked. The preset `factory init --org` writes turns on
  all three.

  The plan has no branch rules for a private repository either, so "Review
  verdict" cannot be required there. Where such a preset was already
  followed, `factory doctor` shows a line for each:

  ```text
  ✗ CLAUDE_CODE_OAUTH_TOKEN is stored for acme, and GitHub Free does not share it with a private repository: make the repository public, or move acme to a paid plan
  - "Review verdict" cannot be required here: GitHub Free has no branch rules for a private repository
  ```

## What is left for you

When nothing is left, `init` prints
`Merge it to finish. Nothing else is left to do.` after the pull
request's line. Otherwise it says what is left:

| What happened during setup                                                         | What you do                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| You left the gate question empty                                                   | Add the commands that check a change, such as your tests and linter, under `commands.gate`. A build cannot finish without them                                                                                                                                                                                                                           |
| "Left to do" says an admin runs `factory init` once the pull request merges        | Merge it, then run `factory init` again, as an admin of the repository, to require "Review verdict". No workflow run could: the organization has no organization-wide rule ([On GitHub's Free plan](#on-githubs-free-plan)), or your own repository has no GitHub token stored, or one that belongs to another account than the one you are signed in as |
| You chose "Builds that start when you move a card to Ready", on a server you host  | Run the poller's image with the values `init` prints. [Hosting the poller](../builds.md#hosting-the-poller-own-server) has the steps                                                                                                                                                                                                                     |
| You chose "Signed commits on the factory's updates", and it could not add the key  | Add the public key it prints to the GitHub account that made the access token you pasted: Settings, "SSH and GPG keys", "New SSH key", key type "Signing Key"                                                                                                                                                                                            |
| You chose "Pull requests that merge themselves", and it could not allow auto-merge | An admin of the repository allows it: Settings, General, "Allow auto-merge"                                                                                                                                                                                                                                                                              |
| The repository is public, and it could not add the policy                          | Let `.github/workflows/factory.yml` run on `pull_request_target`, in your repository's Settings, Actions, Policies. [By hand](by-hand.md#a-public-repository) has each field                                                                                                                                                                             |
| CI's own token can write, and the review is on                                     | Set it to read: Settings, Actions, General, Workflow permissions. Code in a pull request could pass "Review verdict" with it. A workflow of yours that writes then says so under its own `permissions`                                                                                                                                                   |
| GitHub refused the push or the pull request                                        | Push the branch `set-up-factory`, where init left its commit, if it is not pushed, and open the pull request yourself                                                                                                                                                                                                                                    |

## Optional: tune it

Each is a few lines in `.claude/factory.yaml`, merged like any change.

- **Let a session in the cloud reach your registry.** Its commands reach
  the npm registry and no other host. List any other that your tests or
  your gate download from under
  [`builds.hosts`](../configuration.md#builds)
  ([What a session can use](../builds.md#what-a-session-can-use)):

  ```yaml
  builds:
    hosts:
      - pypi.org
      - files.pythonhosted.org
  ```

- **Run a command before every commit a session on your machine makes,**
  such as your linter, under
  [`commands.before-commit`](../configuration.md#commandsbefore-commit):

  ```yaml
  commands:
    before-commit:
      - npm run lint
  ```

- **Tell the reviewer what your `CLAUDE.md` does not say** about your
  project, in a file you write, `.github/review-notes.md`. The reviewer
  reads it when it exists.

[Configuration](../configuration.md) has every setting.

## Changing it later

Run `factory init` again to turn a part on or off. It starts from what you
have, and does not ask again for a secret that is already set. When it
changes a file, it opens a pull request titled "Change the software
factory's settings", which you merge as you did the first. Under the
pull request's line it prints what to do then:

```text
After it merges, come back to main and bring it up to date: git switch main && git pull
```

```bash
factory doctor
```

runs the checks again at any time: the settings, the factory's files, the
version your repository names and whether a newer one is released, each
[preset](../presets.md)'s pin, who the GitHub CLI is signed in as, that
each secret your parts read is set, those for
[private npm packages](#private-npm-packages), the board's columns, and,
with the review on, that CI's own token can only read, and whether "Review
verdict" is required before a merge to your default branch, here `main`:

```text
✓ "Review verdict" is required before a merge to main
- "Review verdict" is not required yet: the rule is made once the setup's pull request merges
✗ "Review verdict" is not required before a merge to main. Run factory init
✗ "Review verdict" is not required before a merge to main. The next push to main sets it, or an owner of acme sets software-factory to "on" for this repository
```

The second is what you see before the setup's pull request has merged,
and is no fault. The last is an organization's repository whose
`software-factory` property is not "on" yet.

GitHub never lets a secret be read back, so a wrong one shows when the
first run that needs it fails, naming it.

## A public repository

For a repository anyone can read. A private repository needs nothing
here.

From December 2, 2026, GitHub blocks the `pull_request_target` event in
a public repository unless one of the repository's Actions policies
allows it. The factory's workflow file, `.github/workflows/factory.yml`,
starts on that event: it is how the review's verdict, who merges, and
the board sync run from your default branch's copy, where a pull request
cannot change them.

`factory init` adds the policy for you. Its plan has this row, and after
"Go ahead?" it prints the line under it:

```text
  policy        Let .github/workflows/factory.yml run on pull_request_target, as the policy "Software factory"
✓ Allowed pull_request_target for .github/workflows/factory.yml.
```

The policy covers that one file and lists every event the file starts
on, so your other workflows are not affected.

**It worked when** `factory doctor` shows:

```text
✓ pull_request_target is allowed for .github/workflows/factory.yml
```

Without the policy, it shows this, and running `factory init` again adds
it:

```text
✗ pull_request_target is not allowed for .github/workflows/factory.yml, so GitHub runs no verdict, merge policy, or board sync on a pull request. Run factory init
```

When `init` cannot add the policy, it says so and puts the step under
"Left to do". [Setting up on GitHub by hand](by-hand.md#a-public-repository)
has each field to fill in.

## Private npm packages

For a repository whose own dependencies include a package from a private
registry, such as your company's own packages. At the end, the factory's
jobs that install your dependencies install it as your machine does, and
Dependabot offers its new versions.

The factory itself needs none of this. It comes from the public npm
registry, onto each machine and each job, and a
[preset](../presets.md#who-can-read-a-preset) comes from a repository on
your code host, read with the access you already have. A repository with
no `package-lock.json` at its root needs none of it either, since no job
runs `npm ci` there.

### 1. Read the token from a variable in `.npmrc`

The workflows sign in to your registry the way npm does on your machine:
from the `.npmrc` at the root of your repository, which you commit. It
needs two lines, one that sends your packages' scope to the registry and
one that reads the token from an environment variable:

```ini
@acme:registry=https://acme.jfrog.io/artifactory/api/npm/npm/
//acme.jfrog.io/artifactory/api/npm/npm/:_authToken=${NPM_TOKEN}
```

Your registry's documentation gives both lines with its own address. The
variable can have any name; the factory stores the token as a secret of
the same name, so wherever this section says `NPM_TOKEN`, use yours. On
your machine, set the variable in your shell's profile, such as
`export NPM_TOKEN=...`. If the token line is only in your own
`~/.npmrc`, move it into this file with the variable in place of the
token: the workflows read only this one.

**It worked when** `npm ci` succeeds on your machine with the variable
set.

#### GitHub Packages

Read `${GITHUB_TOKEN}` in the token line. In the workflows' own steps it is
their own token, which can read the packages that give this repository
access, so there is no registry token to make or to store for Actions: skip
steps 2 and 3. On your machine, set `GITHUB_TOKEN` to a personal access
token with the `read:packages` scope. Dependabot has no token of its own for
it: where step 3 would have `init` store one, store that personal access
token yourself, with `gh secret set PACKAGES_TOKEN --app dependabot`, and in
step 4 name `PACKAGES_TOKEN` in place of `NPM_TOKEN`.

In the cloud, your default branch's packages are installed with that token
before the session starts. The session itself has no GitHub token, and its
commands can't reach GitHub, so it can't install the packages of the branch
it works on. When your gate needs them, build that repository's tickets on
your machine ([Limitations](../limitations.md#what-it-does-not-do)).

### 2. Make a read-only token

On your registry, make a token that can only read, and only the packages
this repository installs. Every session in the cloud can read it while it
works, and it reads tickets and pull requests that anyone with access to the
repository can write, so a read-only token is all that text could ever lead
one to give away.

### 3. Store it with `factory init`

```bash
factory init
```

Under "Found", `init` lists `.npmrc` and the variable it reads. Then it
asks you to paste the token, rewrites the factory's two workflow files
under `.github/workflows/` to pass the secret to the jobs that install,
and stores it twice: as an
Actions secret, and as a Dependabot secret, since a workflow that
Dependabot's pull request starts can read only Dependabot secrets. If
`.npmrc` isn't listed under "Found", the token line is missing from the
file at your repository's root.

If your organization already shares the secret with this repository,
`init` does not ask for the Actions copy. It still asks for the Dependabot
copy, since only an organization admin can see whether the organization
sets that one: leave it empty if yours does. To set both once for every
repository, an organization admin runs:

```bash
gh secret set NPM_TOKEN --org acme --visibility all
gh secret set NPM_TOKEN --org acme --visibility all --app dependabot
```

### 4. Tell Dependabot the registry

Skip this without a `.github/dependabot.yml`, or when your organization
sets the registry for Dependabot, which an organization admin can tell
you. Otherwise add the registry, and name it in your npm entry, or
Dependabot never sees a new version of a package from there:

```yaml
registries:
  acme: # any name; the npm entry uses it
    type: npm-registry
    url: https://acme.jfrog.io/artifactory/api/npm/npm/ # as in .npmrc
    token: ${{secrets.NPM_TOKEN}} # the Dependabot secret from step 3
updates:
  - package-ecosystem: npm
    directory: /
    registries: [acme]
    schedule:
      interval: weekly
```

### 5. Check it, and merge

Run `factory doctor`. **It worked when** it shows:

```text
✓ NPM_TOKEN is set, for installing what .npmrc names
✓ NPM_TOKEN is set for Dependabot, for installing on Dependabot's pull requests
✓ .github/dependabot.yml uses https://acme.jfrog.io/artifactory/api/npm/npm/ for its npm updates
```

Without a `.github/dependabot.yml` there is no third line. A line that
starts with `?` is one `doctor` cannot check from the repository, such as
a secret or a registry your organization may set, which only an
organization admin can see. It fails nothing.

`init` committed only the files it wrote, and left your checkout on the
branch of the pull request it opened. Commit `.npmrc` on that branch. A
session in the cloud installs the packages itself, so also list your
registry's host there, under [`builds.hosts`](../configuration.md#builds)
in `.claude/factory.yaml`, and run `factory sync`:

```yaml
builds:
  hosts:
    - acme.jfrog.io
```

Push the branch, and merge the pull request as any other change. If `init`
printed `Nothing to commit: the files already match.`, it opened none:
commit these on a branch and open the pull request yourself. The last
check is the first session in the cloud after the merge, such as the
review of your next pull request or your next build: its "Install the
repository's dependencies" step passes once the job can sign in.

### Replacing the token

When the token expires, the next job that installs your dependencies
fails at `npm ci` with a 401.
Store the new one in both places:

```bash
gh secret set NPM_TOKEN
gh secret set NPM_TOKEN --app dependabot
```

or run `factory init` and answer yes when it asks to replace the secrets
already set. An organization admin runs the two commands in step 3
again instead.

If you rename the variable in `.npmrc`, the factory's commands stop and
say to run `factory sync`, which rewrites the two workflow files for the
new name.

## Doing it by hand

[Setting up on GitHub by hand](by-hand.md) has every step `init` takes,
and every secret with the scopes it needs, for anyone who cannot run
`init` or wants to see what it does.
