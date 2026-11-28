# Set up a repository

For someone setting a repository up with `lunamill init`, on their own
account or in an organization an owner has set up. At the end you have a
pull request that sets the repository up, with the parts you chose.
[Which setup is yours](README.md) says whether to start here.

## What you need

Today the code host is [GitHub](../integrations/github.md) and the
coding agent is [Claude Code](../integrations/claude-code.md).
[The glossary](../reference/glossary.md#the-tools) says what each kind of
tool does.

| You need                                               | How to check it                                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| A repository on a supported code host, with tickets on | [GitHub's You need](../integrations/github.md#you-need)                                                                  |
| The code host's command-line tool, signed in           | [The GitHub CLI's check](../integrations/github.md#you-need), in the same section                                        |
| A supported coding agent, signed in                    | [Claude Code's You need](../integrations/claude-code.md#you-need)                                                        |
| Node 22.18 or later                                    | `node --version`. If it is older, install it from [nodejs.org](https://nodejs.org)                                       |
| The `lunamill` command                                 | `lunamill`, which prints its commands. If it is not there, [install it](../get-started/install.md), once on your machine |

Nothing of lunamill's is installed in a repository. Without a coding
agent, `lunamill init` stops and changes nothing. An owner setting an
organization up needs every row but the first, and goes straight to
[Set an organization up, once](organization.md#set-an-organization-up-once).

## Run `lunamill init`

In the repository you are setting up:

```bash
lunamill init
```

It names the repository on its first line, which it works out from your
checkout's remotes. When they hold a fork, or more than one repository,
it asks which one you are setting up. It stops when your checkout has
commits the default branch lacks, so run it from the default branch. In
a repository with no commits yet, it first offers to make an empty
first commit and push it, or to push the commits your checkout has,
since a pull request needs a branch to merge into.

Before it asks anything else, it reads [presets](../customize/presets.md), the
settings several repositories share, and it asks only what they leave
open. It looks for a repository named `lunamill-config` in your account
or your organization, and asks which of its presets this repository
follows. When there is none, it offers the presets your machine last
followed there. To name the presets yourself, give each one with
`--preset`, as in `lunamill init --preset acme/platform-settings`. For
each preset you follow, it prints what that preset changes here, as
[`lunamill preset add`](../customize/presets.md#adding-a-preset) does.

It asks which parts you want, less any that a preset or a stored secret
decides. Each is optional. With none, you refine and build tickets in a
[session](../reference/glossary.md) on your machine, as the
[quick start](../get-started/quick-start.md) does:

| Part                                            | What you get                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An automated review of every pull request       | The coding agent reads each pull request once it is ready, comments, and gives a verdict, the "Review verdict" status. From the first workflow run after the setup's pull request merges, that status is required, so a pull request cannot merge until the review passes it. It posts as the [cloud runner's](../reference/glossary.md#the-tools) own account, `github-actions`, so there is no app of the coding agent's to install |
| A board                                         | A board that shows each ticket's state, its session, and its cost                                                                                                                                                                                                                                                                                                                                                                     |
| Builds in the cloud                             | A ticket builds on the cloud runner, with no session open on your machine                                                                                                                                                                                                                                                                                                                                                             |
| Builds that start when you move a card to Ready | Moving a ticket to Ready on the board builds it                                                                                                                                                                                                                                                                                                                                                                                       |
| Pull requests that merge themselves             | A pull request that touches only files you listed merges once its checks pass                                                                                                                                                                                                                                                                                                                                                         |
| Signed commits on lunamill's updates            | The pull requests that update lunamill show as "Verified". A session's own commits in the cloud are never signed. Not offered in an organization's repository, where an update acts as the organization's App ([Tokens and secrets](../security/credentials.md#who-handles-a-token))                                                                                                                                                  |

On a first run, the first three start checked, where they are offered.

It asks these, and skips any that a preset or your settings already
answer:

| Question                                                                 | When it is asked                                                                                      | What you do                                                                                                                                                                                                            |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What to name the branch a build pushes                                   | Always                                                                                                | Press Enter for `{ticket}`, so ticket 12 is built on a branch named `12`, or type your team's pattern, such as `feature/{user}/{ticket}` ([`code-host`](../reference/settings/code-host.md#code-host))                 |
| Which spec tool you use                                                  | Always                                                                                                | Choose None, unless you want the spec tool, today [OpenSpec](../integrations/openspec.md), to keep a folder in your repository that describes what your project does ([`specs`](../reference/settings/specs.md#specs)) |
| Which board                                                              | With "A board"                                                                                        | Choose a new one, made with lunamill's columns, or a Project you already have                                                                                                                                          |
| Which files may merge without you                                        | With "Pull requests that merge themselves"                                                            | Type their patterns, such as `docs/**`. Start with a short list                                                                                                                                                        |
| Where [the poller](../features/builds-from-the-board.md#the-poller) runs | With "Builds that start when you move a card to Ready"                                                | Choose a schedule on the cloud runner or a server you host. [Builds in the cloud](../features/cloud-builds.md) compares them                                                                                           |
| Which command checks a change                                            | Always                                                                                                | Type it, such as `npm test`. A build cannot finish without one ([`commands.gate`](../reference/settings/commands.md#commandsgate))                                                                                     |
| The token your `.npmrc` reads                                            | When `.npmrc` reads one ([Private npm packages](../integrations/private-npm.md#private-npm-packages)) | Paste a token that can only read from your registry                                                                                                                                                                    |

Before it changes anything, it lists what it will do and asks "Go
ahead?". Type `y`: Enter alone answers no, and nothing changes. Then it
writes the settings and lunamill's files
([What it changes](../maintain/removing.md) lists them), runs the command you
gave to check a change, and opens a pull request from a new branch,
`set-up-lunamill`. When that command fails, it commits nothing.

```text
✓ npm run check passes here.
✓ Opened acme/web#41, "Set up lunamill".
Merge it to finish. Nothing else is left to do.

After it merges:
  1. Come back to main and bring it up to date:
       git switch main && git pull
  2. Start a new session of your coding agent here. It loads lunamill from the files now in your repository.
  3. Refine a ticket with /lunamill-refine N, then build it with /lunamill-build N.
The steps in full:
     https://github.com/lunamill-ai/lunamill/blob/v0.4.0/docs/get-started/quick-start.md#4-open-a-ticket
```

Merge the pull request, then do what those lines say: your checkout is
left on `set-up-lunamill`, and the first step names your own default
branch.

**It worked when** init printed `✓ Opened` with the pull request's
number, and, after the merge, `lunamill doctor` shows ✓ on every line, or
`-` for a part you left off.

### On your own account

After "Go ahead?", the [steps above](#run-lunamill-init) also ask you
for up to two tokens, each when a part you chose reads it, plus the
token your `.npmrc` reads when it reads one:

| Token                                 | Asked for when you chose                                                   | What you do                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The token `claude setup-token` prints | "An automated review of every pull request" or "Builds in the cloud"       | Init runs the command for you. If it gives you a code in the browser, paste that back to it. Then copy the token it prints, the line that starts `sk-ant-oat01-`, and paste it to init, over two lines if that is how it was printed. Init tries the token before it stores it, and asks again if the coding agent refuses it                                                    |
| The code host's access token          | "A board", "Builds in the cloud", or "Pull requests that merge themselves" | Init opens the code host's page for a new access token, with its scopes checked, and prints the page's address: if your browser does not open, open that address yourself ([GitHub's Tokens and secrets](../integrations/github.md#tokens-and-secrets)). Choose an expiry: 90 days is a good balance, and lunamill warns you 30 days before it. Generate the token, and paste it |

Each of the two is typed into a masked prompt, stored in the
repository's secrets, and kept on your machine, so your next repository
asks for neither
([Tokens and secrets](../security/credentials.md#who-handles-a-token)). Leave a
prompt empty to skip it, and run `lunamill init` again when you have the
token. To share settings between your repositories, put a preset in a
repository named `lunamill-config`
([Write a preset](../customize/writing-a-preset.md)).

**It worked when** init prints the first line here, and in your next
repository the second:

```text
It belongs to sam. Stored for sam/api, and on this machine for your next repository.
✓ Stored 2 secrets for sam/web from this machine.
```

### In an organization

The [steps above](#run-lunamill-init) ask you for no token. In the list
init prints first, headed `Found`, the `Organization` row reads one of
five ways:

```text
  Organization     acme, set up: its app's key and its Claude token are stored
  Organization     acme, not set up: an owner runs lunamill init --org https://github.com/acme
  Organization     acme, set up, but its secrets do not reach this repository: GitHub Free shares them only with public repositories
  Organization     acme, set up, but its secrets do not reach this repository: GitHub Free shares them only with public repositories, or an owner narrowed them
  Organization     acme: its secrets could not be listed (gh api repos/acme/web/actions/organization-secrets?per_page=100&page=1: gh: You must have repository read permissions or have the repository secrets fine-grained permission. (HTTP 403))
```

- **With the first,** init lists the presets in the organization's
  `lunamill-config`, and you check the ones this repository follows. It
  offers "Pull requests that merge themselves", and any other part the
  presets leave open.
- **With the second,** ask an owner to
  [set the organization up](organization.md#set-an-organization-up-once). If they say it
  is set up already, its secrets are not shared with your repository:
  [When the organization's secrets do not reach you](../integrations/github-organizations.md#when-the-organizations-secrets-do-not-reach-you).
- **With the third,** which ends at "public repositories", yours is a
  private repository, and the organization's plan shares its secrets only
  with public ones.
  [On GitHub's Free plan](../integrations/github-organizations.md#on-githubs-free-plan) says what to do.
- **With the fourth,** which ends "or an owner narrowed them", init could
  not tell which of the two it is.
  [When the organization's secrets do not reach you](../integrations/github-organizations.md#when-the-organizations-secrets-do-not-reach-you)
  says what to ask an owner for. If yours is a private repository, ask them
  first whether the organization is on the plan
  [On GitHub's Free plan](../integrations/github-organizations.md#on-githubs-free-plan)
  describes: if it is, sharing the secrets does not help, and that section
  says what does.
- **With the fifth,** init could not look, and the parentheses hold
  the code host's reason. If it is that you lack access, ask an admin of the
  repository for write access, which setting it up needs anyway, and run
  `lunamill init` again. For any other reason, run it again later.

With the second, the third, or the fourth, init stops and changes nothing
if one of the repository's [presets](../customize/presets.md) turns on a board, the
review, or builds that start from the board, as the one
`lunamill init --org` writes does. Its line that starts ✗ names which.
Otherwise it goes on, the review and builds in the cloud stay off, and
builds on your machine work. Once the owner has made the change, run
`lunamill init` again.

**It worked when** the row is the first, and, once the setup's pull
request has merged, `lunamill doctor` shows ✓ on every line, or `-` for a
part that is off. Your first build in the cloud then opens its pull
request. If that build fails with the line below, the organization's App
is not installed on your repository, and the page it names is where an
owner of the organization adds it:

```text
lunamill's app for acme is not installed on acme/web. An owner of acme adds it: https://github.com/organizations/acme/settings/installations
```

## What is left for you

When nothing is left, `init` prints
`Merge it to finish. Nothing else is left to do.` after the pull
request's line. Otherwise it says what is left:

| What happened during setup                                                         | What you do                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| You left the gate question empty                                                   | Add the commands that check a change, such as your tests and linter, under `commands.gate`. A build cannot finish without them                                                                                                                                                                                                                                                                                      |
| "Left to do" says an admin runs `lunamill init` once the pull request merges       | Merge it, then run `lunamill init` again, as an admin of the repository, to require "Review verdict". No workflow run could: the organization has no organization-wide rule ([On GitHub's Free plan](../integrations/github-organizations.md#on-githubs-free-plan)), or your own repository has no access token of the code host's stored, or one that belongs to another account than the one you are signed in as |
| You chose "Builds that start when you move a card to Ready", on a server you host  | Run the poller's image with the values `init` prints. [Hosting the poller](../features/hosting-the-poller.md#hosting-the-poller-own-server) has the steps                                                                                                                                                                                                                                                           |
| You chose "Signed commits on lunamill's updates", and it could not add the key     | Add the public key it prints to the code host account that made the access token you pasted, as step 2 of [Signed commits on lunamill's updates](../integrations/github.md#signed-commits-on-lunamills-updates) shows                                                                                                                                                                                               |
| You chose "Pull requests that merge themselves", and it could not allow auto-merge | An admin of the repository allows it: Settings, General, "Allow auto-merge"                                                                                                                                                                                                                                                                                                                                         |
| The repository is public, and it could not add the policy                          | Let `.github/workflows/lunamill.yml` run on `pull_request_target`, in your repository's Settings, Actions, Policies. [By hand](../integrations/github.md#a-public-repository-1) has each field                                                                                                                                                                                                                      |
| CI's own token can write, and the review is on                                     | Set it to read: Settings, Actions, General, Workflow permissions. Code in a pull request could pass "Review verdict" with it. A workflow of yours that writes then says so under its own `permissions`                                                                                                                                                                                                              |
| The code host refused the push or the pull request                                 | Push the branch `set-up-lunamill`, where init left its commit, if it is not pushed, and open the pull request yourself                                                                                                                                                                                                                                                                                              |

## Changing it later

Run `lunamill init` again to turn a part on or off. It starts from what you
have, and does not ask again for a secret that is already set. When it
changes a file, it opens a pull request titled "Change lunamill's settings", which you merge as you did the first. Under the
pull request's line it prints what to do then:

```text
After it merges, come back to main and bring it up to date: git switch main && git pull
```

```bash
lunamill doctor
```

runs the checks again at any time: the settings, lunamill's files, the
version your repository names and whether a newer one is released, each
[preset](../customize/presets.md)'s pin, who the code host's command-line tool is signed in as, that
each secret your parts read is set, those for
[private npm packages](../integrations/private-npm.md#private-npm-packages), the board's columns, that
`lunamill.yml` is enabled, and,
with the review on, that CI's own token can only read, and whether "Review
verdict" is required before a merge to your default branch, here `main`:

```text
✓ "Review verdict" is required before a merge to main
- "Review verdict" is not required yet: the rule is made once the setup's pull request merges
✗ "Review verdict" is not required before a merge to main. Run lunamill init
✗ "Review verdict" is not required before a merge to main. The next push to main sets it, or an owner of acme sets lunamill to "on" for this repository
```

The second is what you see before the setup's pull request has merged,
and is no fault. The last is an organization's repository whose
`lunamill` property is not "on" yet.

`lunamill doctor` checks that each secret is set, not that it is right:
the code host does not let a secret be read back
([GitHub](../integrations/github.md#limits-that-come-from-github)), so a
wrong one shows when the first run that needs it fails, naming it.
