# Where your tokens are kept

For anyone who sets the factory up, joins a repository that already uses
it, or works in a [session](glossary.md) on another machine. At the end,
every token the factory needs is where it reads it, and `factory doctor`
shows it works. For whoever judges whether that is safe,
[What each job holds](#what-each-job-holds) and the two sections after it
say what a run could do with them. On GitHub, the first section is all there is, with
[The file on your machine](#the-file-on-your-machine) for the GitHub
access token and the Claude token that `factory init` keeps there on
your own account. The rest of the page is for a ticket system with a
token of its own, such as Jira, which is
[planned](developing.md#what-is-built), not built yet.

## On GitHub

Your sessions use two logins you already have: the GitHub CLI's, from
`gh auth login`, and Claude Code's. The workflows, which run in GitHub
Actions, read tokens, and which ones depends on who owns the repository.
A [session in the cloud](builds.md#what-a-cloud-run-is) is given none of
the GitHub ones.

- **In an organization, nobody on the team handles a token.** A teammate
  joining a repository needs the two logins, and the `factory` command
  [installed](quick-start.md#1-install) once on their machine. The workflows
  make a token for each job that needs one from the organization's GitHub
  App. An owner stored three things for the organization once, when they [set
  it up](github/setup.md#set-an-organization-up-once):
  - the App's key, as the secret `FACTORY_APP_PRIVATE_KEY`;
  - its client ID, as the variable `FACTORY_APP_CLIENT_ID`;
  - what pays for sessions, as the secret `CLAUDE_CODE_OAUTH_TOKEN`, or
    `ANTHROPIC_API_KEY` for an API key.

- **On your own account, you paste two tokens, and they are kept in
  two places.** One is a GitHub access token, which GitHub requires
  there, since a board a person owns refuses an App's token. It expires
  on the day you choose when you make it, and the factory warns you in
  its last month
  ([When the GitHub access token expires](#when-the-github-access-token-expires)).
  The other
  is your Claude token, which lasts a year, and the factory warns you
  in its last month
  ([When the Claude token's year is up](#when-the-claude-tokens-year-is-up)).
  `factory init` stores both in each repository's
  secrets, which is where the workflows read them. It also keeps both in
  a file on your machine, which only the `factory` command reads,
  to store them in your next repository without asking
  ([The file on your machine](#the-file-on-your-machine)). A second
  person joining your repository needs the two logins and the `factory`
  command, and no token, since the workflows read the repository's
  secrets. [Secrets](github/by-hand.md#secrets) lists each secret, and
  which GitHub account it acts as.

**Who a run acts as, in an organization.** A build acts as the App: its
pull request and comments are from "Software Factory for acme", and its
commits name Claude as their author and the App's bot,
`software-factory-for-acme[bot]`, as their committer. They are not
signed, so GitHub shows no "Verified" on them. The automated review
posts as `github-actions`, a different account, and its verdict comes
from the review's own run, so a build cannot pass its own review.

### What each job holds

Each run that uses your coding agent is
[three jobs](builds.md#what-a-cloud-run-is), each on a machine of its own,
in an organization and on your own account alike:

| Job     | Is there AI in it?                   | What it holds                                                                                                                                                           |
| ------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prepare | No                                   | The App's key, or your build token                                                                                                                                      |
| Session | Yes, confined to the agent's sandbox | What pays for the session, which is kept from every command it runs, and the repository's own secrets, such as the one your `.npmrc` reads, which its commands can read |
| Publish | No                                   | The App's key, or your build token. In a review's run it also has the workflow's own token, which posts the threads and the verdict                                     |

No key or token of yours for GitHub reaches the session's job. GitHub gives
every job a workflow token of its own: this job's can only read packages,
and reaches one step, which installs your default branch's dependencies
before the session starts. Prepare and
Publish run nothing from the branch the session works on.

The App's key also reaches the jobs that run no session: the verdict, for a
pull request that is part of a ticket, telling the other repositories, who
merges, the board sync, the poller, requiring the verdict, finding the conflicts and
Dependabot's pull requests, Dependabot's auto-merge, and the updates. Each
makes a token that lasts an hour, for the run's repository and the
organization's [preset](presets.md) repositories it follows. For a ticket
that names [other repositories](across-repositories.md), a job also makes one
for each of them alone, which can read its code and pull requests, write its
tickets, and start its runs, and can't push to it. The verdict's and the
board sync's can only read. The one
exception is the organization's poller, whose token reaches every
repository the App is installed on, since it starts builds in each.
`factory-review.yml`, the one workflow file that GitHub runs from a pull
request's own copy on every push, is given no secret.

Publish holds the key for as long as it runs, because waiting for CI can
outlast a token, and it then signs in again.

### What a hijacked session could still do

A session reads tickets, review comments, changelogs, and code, and any of
them could hold text meant to take it over. It has no sign-in to give
away, and it can't push, merge, approve, label, or start anything. A
hijacked session could still:

- **Write bad code,** on its own branch, in a draft pull request that
  closes its own ticket. Where the ticket names other repositories, a later
  one's session reads what an earlier one's wrote. Your CI then runs that code, with whatever
  secrets your own CI gives a branch, so give CI no secret you would not
  give a session.
- **Close another ticket when you merge its pull request,** if it hides the
  words well enough. The usual wordings are refused, and Publish asks GitHub
  what the pull request would close, but a merge's own message can hold text
  neither reads. You would reopen that ticket.
- **Pass its own review, where your CI's own token can write.** That token
  is the account the verdict is trusted from, and the code in a pull request
  runs beside it. GitHub's default is read for a new repository and can be
  write for an older one, so `factory doctor` checks it. A workflow of yours
  that runs a pull request's code should say no more than
  `permissions: contents: read`. A workflow the pull request adds is another
  matter ([Who can pass the review without it](#who-can-pass-the-review-without-it)).
- **Write text** as the account the run acts as: in the ticket's body, in
  comments on the ticket and the pull request, in replies, in a
  follow-up in the pull request's description, which becomes a ticket only
  when someone who can write to the repository ticks it, and, from a
  Conflict or a Dependency run, in a new ticket. It
  could resolve its own pull request's threads.
- **Pass a review it should not,** when the session is the review's. The
  text it reads is the pull request's, so a clever one could talk it into
  "ready". The verdict is then wrong, and a pull request that touches only
  files you allow to merge themselves would merge.
- **Give away what it was handed:** the code, the ticket, the code of the
  ticket's other repositories, the
  [presets](presets.md), and the repository's own secrets, such as your
  registry's read-only token. It could send them to the npm registry, to
  a host under [`builds.hosts`](configuration.md#builds), or put them in
  its commits and comments.
- **Use up what pays for sessions,** for as long as
  [`session-minutes`](configuration.md#session-minutes) allows.

It could not, short of getting out of the agent's sandbox, read the
credential that pays for it. The sandbox is "not a complete isolation
boundary", in
[its vendor's own words](https://code.claude.com/docs/en/sandboxing)
([What nobody has tested](limitations.md#what-nobody-has-tested)). A
session that got out of it would still find no GitHub key on its machine.

### Who can pass the review without it

Your branch rules require "Review verdict", and "Approval policies" where
you have [approval policies](approval-policies.md), from GitHub Actions,
not from the factory's own workflow. So a workflow that a pull request
adds can pass them:

- **From a branch of your repository,** a workflow that asks for
  `permissions: statuses: write` gets it, whatever your default
  ([GitHub's own words](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication#modifying-the-permissions-for-the-github_token)),
  and can mark them passed at any time. Anyone who can push a branch can
  do this: a person with write access, or a session on your own machine,
  which works with your sign-in. A session in the cloud can't add a
  workflow. Pushing such a branch already reaches your repository's
  secrets, without a pull request, so this lets someone merge without the
  review, not reach anything new.
- **From a fork,** a workflow can't post a status, since
  [its token is read-only](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#how-permissions-are-calculated-for-a-workflow-job).
  A job named `Review verdict` or `Approval policies` does pass them, but
  only for the few seconds after each push, before the factory marks them
  waiting. A fork's push
  [turns auto-merge off](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request),
  so only someone merging by hand in those seconds would let it through.
  In a public repository, a first-time contributor's workflows
  [wait for your approval](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#controlling-changes-from-forks-to-workflows-in-public-repositories)
  before they run at all, and in a private one a fork's run only as
  [its fork settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#enabling-workflows-for-forks-of-private-repositories)
  allow.

Where several people can write to your repository, have GitHub wait for
you on every change to a workflow: add a `CODEOWNERS` file with the line
`/.github/ @your-username`, and turn on "Require review from Code Owners" in your
branch rules.

### Who can use the App's key

Two reaches decide it:

- **The secrets reach every repository of the organization,** or only
  its public ones on GitHub's Free plan. A workflow on a branch in any
  repository they reach can read the key.
- **The key acts on the repositories the App is installed on.**

So anyone who can push a branch to a repository the secrets reach can
act as the App on every repository it is installed on. An owner has
three ways to limit that, each by hand:

- **Install the App only on repositories where that is acceptable,** in
  the organization's Settings, GitHub Apps, on the App's "Configure"
  page, under repository access.
- **Narrow each secret to chosen repositories,** in the organization's
  Settings, under Secrets and variables, Actions. In a repository the
  secrets no longer reach, the review and builds in the cloud do not work,
  and people still build on their own machines. `factory init` stops there
  if a [preset](presets.md) turns on a board, the review, or builds that
  start from the board. The preset `factory init --org` writes turns on
  all three. To give a repository access again, pick a choice that
  includes it under "Repository access".
- **Replace the key,** as [Replacing the App's key](#replacing-the-apps-key)
  shows. A key does not expire by itself.

On your own account there is no App. Anyone who can push a branch to the
repository can read its secrets the same way, the access token among
them.

### Checking the setup

Run `factory doctor`. **It worked when** it shows
✓ on every line, or - for a part you left off. It checks that you are
signed in, that each secret your parts read is set, and when the Claude
token and, on your own account, the GitHub access token expire
([When the Claude token's year is up](#when-the-claude-tokens-year-is-up),
[When the GitHub access token expires](#when-the-github-access-token-expires)).
It does not try the GitHub access token or the Claude token that
`factory init` keeps on your machine. When GitHub refuses that access
token, or it lacks a scope a part needs, `factory init` says so the next
time it would store it, and asks for a new one.

### When the Claude token's year is up

For whoever stored the Claude token: you on your own account, or an
owner of the organization. A token that `claude setup-token` makes lasts
a year. After that, the automated review, the approval policies' agents,
and builds in the cloud stop, and each of their runs fails with an error
that names `CLAUDE_CODE_OAUTH_TOKEN`. If what you stored was an API key
instead, the secret is named `ANTHROPIC_API_KEY`. A key has no fixed
life, and nothing here applies to it.

**To see when it ends,** run `factory doctor`. More than a month before
the day, it prints a line like this one, for a token stored on
2026-11-16, under `GitHub Actions`:

```text
✓ CLAUDE_CODE_OAUTH_TOKEN stops working by 2027-11-16, a year after it was stored
```

It counts from the day the token was stored in the repository, or, when
your machine holds the day you pasted it and that is earlier, from that
day. A teammate's line can then give a later day than yours.

In its last 30 days, `factory doctor` and `factory status` print it with
a `?` instead. It is a warning: nothing has stopped yet. A session shows
it to you when it starts. For a token stored on 2025-12-10:

```text
? CLAUDE_CODE_OAUTH_TOKEN stops working by 2026-12-10, in 13 days. Run factory init to replace it
```

In a repository an organization owns, it ends
`An owner of acme runs factory init --org to replace it` instead. Once
the day has passed, `factory doctor` marks the line ✗ and fails, so a
script that runs it stops.

**To replace it on your own account,** run `factory init` in the
repository that printed the line. It asks `Make a new one now?`. Press
Enter, and it runs `claude setup-token`, which may open your browser to
sign in to Claude. If the browser gives you a code, that code goes
to `claude setup-token`, not to `factory init`. Once
`claude setup-token` has finished, copy the token it printed, the line
that starts `sk-ant-oat01-`: that is the one `factory init` waits for.
**It worked when** it prints
`Stored for sam/notes, and on this machine for your next repository.`

Each of your other repositories still holds the old token, and its
review and builds stop on the old day. Run `factory init` in each. It
asks
`Store the one on this machine, pasted on 2026-11-27, in its place?`,
which is the token you just made: press Enter, and it stores it with
nothing to paste. **It worked when** it prints
`✓ Stored 1 secret for sam/blog from this machine.`

`factory init` never copies a token from your machine into a repository
once it stops working in 30 days or fewer. It asks you to make a new
one, as above.

**To replace it in an organization,** an owner of the organization runs
`factory init --org acme`, signed in to the GitHub CLI as themselves, as
when they [set it up](github/setup.md#set-an-organization-up-once). It
asks `Replace it now?`. Press Enter, and it runs `claude setup-token`;
paste the `sk-ant-oat01-` token it prints, as in the step above. Every
repository the organization shares the secret with reads the new one
from then on. **It worked when** `factory doctor`, in any of those
repositories, prints the ✓ line with a day a year from today.

A developer who is not an owner cannot replace it. The organization's
owners are listed on its People page on GitHub, under the Owner role.

**A run that failed** because of the old token passes once the new one
is stored: re-run it from its page on the Actions tab.

### When the GitHub access token expires

For you, on your own GitHub account. In an organization the App makes a
token for each run, and nothing here applies.

The GitHub access token is the one `factory init` asked you to make on
GitHub's page. It stores it as `FACTORY_BOARD_TOKEN`, or
`FACTORY_BUILD_TOKEN` without a board, and as `FACTORY_AUTOMERGE_TOKEN`
when pull requests merge themselves, so a repository has one or two of
these ([Secrets](github/by-hand.md#secrets)). It expires on the day you chose on
that page, where GitHub suggests 30 days; 90 days is a good balance. When
it expires, the board sync, builds in the cloud, and merges stop, and
their runs fail with GitHub's `Bad credentials`.

**To see when it expires,** run `factory doctor`. Under `GitHub Actions`
it prints a line about the token, after the lines for the secrets that
hold it:

```text
✓ The GitHub access token in FACTORY_BOARD_TOKEN and FACTORY_AUTOMERGE_TOKEN expires on 2027-01-01
```

It reads the day from your machine, where `factory init` writes it when
you paste the token ([The file on your machine](#the-file-on-your-machine)).
So a teammate, whose machine holds no token of yours, sees no such line.
A token you made with no expiry gets `has no expiry date` in its place,
and the file on your machine holds `expires: never` for it.

In its last 30 days, `factory doctor` and `factory status` print it with
a `?`, and a session shows it to you when it starts. For a token that
expires on 2026-12-10:

```text
? The GitHub access token expires on 2026-12-10, in 13 days. Run factory init to replace it
```

Once the day has passed, `factory doctor` marks the line ✗ and fails.

**To replace it,** run `factory init` in the repository that printed the
line. It asks its other questions as when you set the repository up,
each offering what the repository has now, so Enter keeps it. Before the
secrets, it asks
`Make a new one now?`. Press Enter, and it opens GitHub's page with the
scopes ticked, or prints its address for you to open on a machine with
no browser. Choose an expiry, generate the token, copy it, and paste it
at the prompt `factory init` is waiting on. **It worked when** it prints
`It belongs to sam. Stored for sam/api, and on this machine for your next repository.`,
where `sam` is the GitHub account the token acts as.

Each of your other repositories still holds the old token, and stops
when it expires. In each of them `factory doctor` and `factory status`
say so:

```text
? FACTORY_BOARD_TOKEN here is older than the GitHub access token on this machine. Run factory init to store that one in its place
```

Run `factory init` there. It asks
`Store the one on this machine in its place?`: press Enter, and it
stores the token you just made, with nothing to paste. **It worked
when** it prints `✓ Stored 2 secrets for sam/blog from this machine.`,
counting each name the token is stored under.

`factory init` never copies a token from your machine into a repository
once it expires in 30 days or fewer. It has you make a new one, with the
steps above.

**A run that failed** because the token expired passes once the new one
is stored: re-run it from its page on the Actions tab.

### Replacing the App's key

For an owner of the organization, when the key may have leaked. The
GitHub CLI needs the `admin:org` permission for step 2, which
`gh auth refresh -s admin:org` grants.

1. On GitHub, open the organization's Settings, Developer settings,
   GitHub Apps, then the App's own page, and press "Generate a private
   key". GitHub downloads the key as a `.pem` file.
2. Store it in place of the old one, with your organization's name and
   the file's:

   ```bash
   gh secret set FACTORY_APP_PRIVATE_KEY --org acme --visibility all < FILE.pem
   ```

   If you had narrowed the secret to chosen repositories, write
   `--repos NAME,NAME` in place of `--visibility all`, so it stays
   narrowed.

3. Delete the old key on the App's page, then delete the file.

**It worked when** a build you start with `factory build N`, for a
ticket that is ready, gets past the step "Sign in" of its Prepare job. A
wrong key fails the run at that step.

## The file on your machine

`factory init` writes each token it keeps on your machine to
`~/.config/software-factory/credentials.yaml`, or under
`$XDG_CONFIG_HOME` when that is set. Only you can read it, and it is
outside every repository, so it is never committed. One file serves every
repository.

On your own GitHub account, it holds the GitHub access token and the
Claude token that `factory init` stored in your repository's secrets,
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

`pasted` is the day you gave `factory init` each token, and `expires`
the day GitHub says the access token expires, or `never`.
`factory doctor` and `factory status` read these days, and never the
tokens
([When the Claude token's year is up](#when-the-claude-tokens-year-is-up),
[When the GitHub access token expires](#when-the-github-access-token-expires)).
A file written by an earlier release has no `pasted` line, and no
`expires` line for the access token. For the Claude token, the two
commands then count from the day it was stored in the
repository. For the
access token, they say nothing until `factory init` next stores it in a
repository, which reads its expiry from GitHub and adds both lines.

The two tokens are read from the file alone: a variable of the same name in your
environment does not stand in for either. A repository an organization
owns keeps neither here.

- **The factory refuses a file others can read,** as `ssh` refuses a
  private key, and prints the `chmod` that fixes it.
- **A session cannot read it.** The factory's commands read it
  themselves, and the factory stops a session that tries to open the
  file itself.

Beside it, `presets.yaml` records the [presets](presets.md) you last
followed for each account or organization, which `factory init` offers
in your next repository there. It holds no token.

## A ticket system with a token of its own

_[Planned](developing.md#what-is-built)_: Jira. Until it is built, GitHub
Issues is the only ticket system, and nothing in this section applies.

Your GitHub CLI login reaches GitHub and nothing else, so another ticket
system's token has to be kept by the factory, in two places:

| Where the token is kept  | What reads it                                 | Who stores it there                                         |
| ------------------------ | --------------------------------------------- | ----------------------------------------------------------- |
| The repository's secrets | The workflows                                 | Whoever sets the repository up, by running `factory init`   |
| A file on your machine   | Your sessions, through the factory's commands | Each person, by running `factory init` on their own machine |

Whoever sets the repository up pastes the token once, and `factory init`
stores it in both. The workflows then act in the ticket system as that
person, the way they act on GitHub as the account that made the GitHub
token.

For Jira the token is two values, stored under two names:
`FACTORY_JIRA_EMAIL`, the email of your Atlassian account, and
`FACTORY_JIRA_TOKEN`, an API token. The site's address is in
`.claude/factory.yaml`, as
`tickets.site`, so it is not one of them.

On your machine, the token goes in
[the file](#the-file-on-your-machine) that holds a GitHub account's
tokens, and every factory command reads it from there, so a second
repository on the same Jira site asks for nothing. `FACTORY_JIRA_EMAIL`
and `FACTORY_JIRA_TOKEN`, set in the environment, take priority over the
file. Set them only where a platform keeps them as secrets and passes
them in, as
[In a session on another machine](#in-a-session-on-another-machine)
says. Set in your shell's profile, every program you start would inherit
them.

### Joining a repository that is already set up

Clone it, and with the `factory` command
[installed on your machine](quick-start.md#1-install), run:

```bash
factory init
```

Since `.claude/factory.yaml` is already there, it shows
`This machine   no Jira credential` in the list it prints first, and asks only for
your own token. It opens the page that makes one, checks what you paste
against Jira, and stores it on this machine. Then it asks
`Change which parts are on?`, which would change the repository's
settings for everyone: answer no.

If you cannot see the repository's secrets, it stops before that
question, with your token stored:

```text
Could not list the repository's secrets, so the parts are left as they are: 403 Must have admin rights to Repository
```

That is expected: your machine is set up, and the repository's secrets
are someone else's to change.

**It worked when** `factory doctor` shows
`✓ The credential on this machine is accepted, for you@example.com` under
Jira.

### In a session on another machine

Every such machine needs the factory installed first:

```bash
npm install -g @davidbyoung/software-factory
```

| Where the session runs          | What you do                                                                                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A server you reach over SSH     | Run `factory init` there. With no browser on the server, open the address it prints on your own machine, make the token, and paste it into the server's terminal                                                                                              |
| A Codespace                     | On GitHub, under your account's Settings, Codespaces, add `FACTORY_JIRA_EMAIL` and `FACTORY_JIRA_TOKEN` as secrets, with the repository selected. Make the token at [Atlassian's API token page](https://id.atlassian.com/manage-profile/security/api-tokens) |
| A dev container on your machine | Run `factory init` inside it, as on a server                                                                                                                                                                                                                  |
| Claude Code on the web          | In the environment's settings, where you choose it for a session, add `FACTORY_JIRA_EMAIL` and `FACTORY_JIRA_TOKEN` as environment variables. Make the token as in the Codespace row. Put the install line above in the environment's setup too               |

A session with neither the file nor the variables says so as it starts,
in the state of the tickets it shows you, and names
`FACTORY_JIRA_EMAIL`, `FACTORY_JIRA_TOKEN`, and `factory init`. **It worked when**
`factory doctor`, run in that session, shows ✓ under Jira.

### When a token stops working

Jira's tokens expire on the date you choose when you make one, at most a
year later. When Jira
refuses the one on your machine, a session says so as it starts, and
every factory command that reads tickets fails with the same line. Run
`factory init`: it opens the page that makes a new token, and stores the
one you paste in place of the refused one.

When the workflows' token expires, each run that reads tickets fails, and
its log on the Actions tab names `FACTORY_JIRA_EMAIL` and
`FACTORY_JIRA_TOKEN`. Whoever can change the repository's secrets runs
`factory init`, and answers yes when it asks
`N secrets these parts read are already set. Replace them?`, a different
question from the one a teammate answers no to.

**It worked when** `factory doctor` shows ✓ under Jira, and the failed
run passes when you re-run it.

## Removing the factory

`factory remove` lists each token on your machine among what is left to
do by hand, since another repository may use it: a ticket system's own,
and, on your own GitHub account, the GitHub access token and the Claude
token.
[Removing it](removing.md#removing-it) has the rest.
