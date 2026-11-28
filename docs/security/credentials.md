# Tokens and secrets

For anyone who sets kodor up, joins a repository that already uses
it, or works in a [session](../reference/glossary.md) on another machine.
At the end you know who handles each token and where it is kept, and
`kodor doctor` shows each works. Each tool's page says how to make and
replace its own token; this page says who handles each one, and where it
is kept. For whoever judges whether that is safe,
[What each job holds](cloud-runs.md#what-each-job-holds) says what a run
could do with them.

## Who handles a token

Your sessions use two sign-ins you already have, one to the code host's
command-line tool and one to the coding agent
([GitHub](../integrations/github.md#you-need) and
[Claude Code](../integrations/claude-code.md#you-need) say how to sign in).
The workflows, which run on the cloud runner, read tokens, and which ones
depends on who owns the repository. A
[session in the cloud](cloud-runs.md#what-a-cloud-run-is) is given none of
the code host's.

- **In an organization, nobody on the team handles a token.** A teammate
  joining a repository needs the two sign-ins, and the `kodor` command
  [installed](../get-started/install.md) once on their machine. The workflows
  make a token for each job that needs one from the organization's app on
  the code host. An owner stored three things for the organization once, when they [set
  it up](../setup/organization.md#set-an-organization-up-once):
  - the App's key, as the secret `KODOR_APP_PRIVATE_KEY`;
  - its client ID, as the variable `KODOR_APP_CLIENT_ID`;
  - what pays for sessions, as the secret `CLAUDE_CODE_OAUTH_TOKEN`, or
    `ANTHROPIC_API_KEY` for an API key.

- **On your own account, you paste two tokens, and they are kept in
  two places.** One is the code host's access token, which your own
  account needs in place of an app
  ([GitHub](../integrations/github.md#tokens-and-secrets) says why). It
  expires on the day you choose when you make it, and kodor warns
  you in its last month
  ([When the GitHub access token expires](../integrations/github.md#when-the-github-access-token-expires)).
  The other is the coding agent's token, and kodor warns you in its
  last month too
  ([When the Claude token's year is up](../integrations/claude-code.md#when-the-claude-tokens-year-is-up)).
  `kodor init` stores both in each repository's
  secrets, which is where the workflows read them. It also keeps both in
  a file on your machine, which only the `kodor` command reads,
  to store them in your next repository without asking
  ([The file on your machine](#the-file-on-your-machine)). A second
  person joining your repository needs the two sign-ins and the `kodor`
  command, and no token, since the workflows read the repository's
  secrets. [Secrets](#secrets) lists each secret, and
  which account on the code host it acts as.

**Who a run acts as, in an organization.** A build acts as the App: its
pull request and comments are from "kodor for acme", and its
commits name the coding agent as their author and the app's bot,
`kodor-acme[bot]`, as their committer. They are not
signed
([GitHub organizations](../integrations/github-organizations.md#what-kodor-can-and-cannot-do-there)
says how that shows). The automated review
posts as `github-actions`, a different account, and its verdict comes
from the review's own run, so a build cannot pass its own review.

## Secrets

Everything here is stored on the repository with `gh secret set NAME`,
which asks for the value. Nothing kodor runs on your machine needs
one; each is for something that runs in GitHub Actions.

In an organization that is set up, nobody stores a secret on a
repository. `kodor init --org` stored these on the organization once,
for every repository:

| What the organization holds         | What it is for                                                                                                                                                                                                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `KODOR_APP_PRIVATE_KEY`, a secret   | The key of the organization's GitHub App, from which each job that needs a token makes one. [What each job holds](cloud-runs.md#what-each-job-holds) lists them, and [Replacing the App's key](../integrations/github-organizations.md#replacing-the-apps-key) has the steps |
| `KODOR_APP_CLIENT_ID`, a variable   | Which App the key belongs to                                                                                                                                                                                                                                                 |
| `CLAUDE_CODE_OAUTH_TOKEN`, a secret | What pays for sessions, or `ANTHROPIC_API_KEY` for an API key                                                                                                                                                                                                                |

On your own account, the workflows read the secrets below from each
repository. So does an organization's repository that the organization's
secrets do not reach
([When the organization's secrets do not reach you](../integrations/github-organizations.md#when-the-organizations-secrets-do-not-reach-you)),
since no App's key reaches its runs. What you store on a repository:

| Secret                    | Needed for                                                                             | Make it                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE_CODE_OAUTH_TOKEN` | The automated review, and builds in the cloud                                          | `claude setup-token`, on your machine. It bills your Claude subscription, and lasts a year                                                              |
| `KODOR_BOARD_TOKEN`       | A board. Also builds in the cloud, when `KODOR_BUILD_TOKEN` is not set                 | [A classic token](https://github.com/settings/tokens/new?scopes=repo,project,workflow&description=kodor%20board) with `repo`, `project`, and `workflow` |
| `KODOR_BUILD_TOKEN`       | Builds in the cloud. Optional with a board token; used instead of it when both are set | [A classic token](https://github.com/settings/tokens/new?scopes=repo,workflow&description=kodor%20builds) with `repo` and `workflow`                    |
| `KODOR_AUTOMERGE_TOKEN`   | Pull requests that merge themselves                                                    | [A classic token](https://github.com/settings/tokens/new?scopes=repo&description=kodor%20auto-merge) with `repo`                                        |
| `KODOR_SIGNING_KEY`       | Signed commits on kodor's updates. Read by the updates' job alone                      | [Signed commits on kodor's updates](../integrations/github.md#signed-commits-on-kodors-updates)                                                         |

Each token link opens GitHub's page with the scopes checked; choose an
expiry date and generate it. The account that makes a token is the one
its work is done as, and must be able to write the repository, and the
Project for the board token.

**One GitHub token is enough for everything.** Make one classic token with
`repo` and `workflow`, and `project` when you have a board, and store it
under each name your parts read; `init` does the same. Any workflow a pull
request from the repository adds can read every secret, so separate tokens
protect little.

Builds and auto-merge also take a fine-grained token instead: read and
write access to Contents, Pull requests, Issues, Workflows, and Actions for builds,
and to Contents and Pull requests for auto-merge. The board token must be
classic.

To set them in one go, run the lines for your parts and paste each value
when asked. `claude setup-token` prints the first value; the terminal may wrap it
across lines, so join it into one line before you paste it, since a
line break left in it fails every run that uses it. The other
three lines can all take the same GitHub token:

```bash
claude setup-token
gh secret set CLAUDE_CODE_OAUTH_TOKEN   # the review, or builds in the cloud
gh secret set KODOR_BOARD_TOKEN       # a board
gh secret set KODOR_BUILD_TOKEN       # builds in the cloud, with no board
gh secret set KODOR_AUTOMERGE_TOKEN   # pull requests that merge themselves
```

For a private npm registry, each variable your `.npmrc` reads is stored
twice, with `gh secret set NAME` and `gh secret set NAME --app dependabot`:
[Private npm packages](../integrations/private-npm.md#private-npm-packages).

Two optional settings:

- **Paying by the token instead of a subscription:** store an API key from
  the [Claude Console](https://platform.claude.com) as `ANTHROPIC_API_KEY`.
  A workflow uses it when `CLAUDE_CODE_OAUTH_TOKEN` is not set.
- **The model a cloud session uses:** `gh variable set KODOR_BUILD_MODEL`.
  This is a variable, not a secret.

Everything kodor owns starts with `KODOR_`. The other two keep the
names Claude Code gives them, since your other workflows may use them too.

**Which secrets reach which job.** The job of each run that runs Claude
Code gets `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`, and your own
secrets, such as the one your `.npmrc` reads. It gets none of the GitHub
tokens ([What each job holds](cloud-runs.md#what-each-job-holds)).
`kodor-review.yml` gets no secret at all.

## Who can use the App's key

Two reaches decide it:

- **The secrets reach every repository of the organization,** or only
  its public ones on some plans
  ([GitHub's Free plan](../integrations/github-organizations.md#on-githubs-free-plan)).
  A workflow on a branch in any
  repository they reach can read the key.
- **The key acts on the repositories the App is installed on.**

So anyone who can push a branch to a repository the secrets reach can
act as the App on every repository it is installed on. An owner has
three ways to limit that, each by hand:

- **Install the App only on repositories where that is acceptable.**
- **Narrow each secret to chosen repositories.** In a repository the
  secrets no longer reach, the review and builds in the cloud do not work,
  and people still build on their own machines. `kodor init` stops there
  if a [preset](../customize/presets.md) turns on a board, the review, or builds that
  start from the board. The preset `kodor init --org` writes turns on
  all three.
- **Replace the key,** as [Replacing the App's key](../integrations/github-organizations.md#replacing-the-apps-key)
  shows. A key does not expire by itself.

[Limiting who can use the App's key](../integrations/github-organizations.md#limiting-who-can-use-the-apps-key)
says where on the code host's site each of the first two is set, and how
to give a repository access again.

On your own account there is no App. Anyone who can push a branch to the
repository can read its secrets the same way, the access token among
them.

## Checking the setup

Run `kodor doctor`. **It worked when** it shows
✓ on every line, or - for a part you left off. It checks that you are
signed in, that each secret your parts read is set, and when the coding
agent's token and, on your own account, the code host's access token
expire
([When the Claude token's year is up](../integrations/claude-code.md#when-the-claude-tokens-year-is-up),
[When the GitHub access token expires](../integrations/github.md#when-the-github-access-token-expires)).
It does not try the code host's access token or the coding agent's token
that `kodor init` keeps on your machine. When the code host refuses that
access
token, or it lacks a scope a part needs, `kodor init` says so the next
time it would store it, and asks for a new one.

## The file on your machine

`kodor init` writes each token it keeps on your machine to
`~/.config/kodor/credentials.yaml`, or under
`$XDG_CONFIG_HOME` when that is set. Only you can read it, and it is
outside every repository, so it is never committed. One file serves every
repository.

On your own account, it holds the code host's access token and the coding
agent's token that `kodor init` stored in your repository's secrets,
filed under your account, here `sam`:

```yaml
github:
  github.com/sam:
    token: ghp_...
    pasted: 2026-11-27
    expires: 2027-02-25
claude-code:
  github.com/sam:
    CLAUDE_CODE_OAUTH_TOKEN: sk-ant-oat01-...
    pasted: 2026-11-27
```

`pasted` is the day you gave `kodor init` each token, and `expires`
the day the code host says the access token expires, or `never`.
`kodor doctor` and `kodor status` read these days, and never the
tokens
([When the Claude token's year is up](../integrations/claude-code.md#when-the-claude-tokens-year-is-up),
[When the GitHub access token expires](../integrations/github.md#when-the-github-access-token-expires)).
A file written by an earlier release has no `pasted` line, and no
`expires` line for the access token. For the coding agent's token, the two
commands then count from the day it was stored in the
repository. For the
access token, they say nothing until `kodor init` next stores it in a
repository, which reads its expiry from the code host and adds both lines.

The two tokens are read from the file alone: a variable of the same name in your
environment does not stand in for either. A repository an organization
owns keeps neither here.

- **kodor refuses a file others can read,** as `ssh` refuses a
  private key, and prints the `chmod` that fixes it.
- **A session cannot read it.** kodor's commands read it
  themselves, and kodor stops a session that tries to open the
  file itself.

Beside it, `presets.yaml` records the [presets](../customize/presets.md) you last
followed for each account or organization, which `kodor init` offers
in your next repository there. It holds no token.

## Removing kodor

`kodor remove` lists each token on your machine among what is left to
do by hand, since another repository may use it: a ticket system's own,
and, on your own account, the code host's access token and the coding
agent's token.
[Removing it](../maintain/removing.md#removing-it) has the rest.
