# Where your tokens are kept

For anyone who sets the factory up, joins a repository that already uses
it, or works in a [session](glossary.md) on another machine. At the end,
every token the factory needs is where it reads it, and `factory doctor`
shows it works. On GitHub, the first section is all there is, with
[The file on your machine](#the-file-on-your-machine) for the GitHub
access token and the Claude token that `factory init` keeps there on
your own account. The rest of the page is for a ticket system with a
token of its own, such as Jira, which is
[planned](developing.md#what-is-built), not built yet.

## On GitHub

Your sessions use two logins you already have: the GitHub CLI's, from
`gh auth login`, and Claude Code's. The workflows, which run in GitHub
Actions, read tokens, and which ones depends on who owns the repository.

- **In an organization, the workflows make a token for each run** from
  the organization's GitHub App. An owner stored four things for the
  organization once, when they
  [set it up](github/setup.md#set-an-organization-up-once):
  - the App's key, as the secret `FACTORY_APP_PRIVATE_KEY`;
  - its client ID, as the variable `FACTORY_APP_CLIENT_ID`;
  - its name as GitHub writes it in an address, as the variable
    `FACTORY_APP_SLUG`, which lets the automated review read a pull
    request the App opened;
  - what pays for sessions, as the secret `CLAUDE_CODE_OAUTH_TOKEN`, or
    `ANTHROPIC_API_KEY` for an API key.

  A run's token lasts an hour, and reaches only the run's
  repository and the organization's [preset](presets.md) repositories it
  follows. A build can run for longer than an hour, so its job makes a
  new token every 45 minutes, and one process of that job holds the
  App's key for as long as the job runs. The one exception to a token's
  reach is the organization's poller, whose token reaches every
  repository the App is installed on, since it starts builds in each. A
  teammate joining a repository needs the two logins,
  and the `factory` command [installed](quick-start.md#1-install) once
  on their machine. Nobody hands them a token, and they keep none.

- **On your own account, the workflows read the repository's secrets.**
  GitHub requires one access token there, since a board a person owns
  refuses an App's token. `factory init` stores that GitHub access
  token, with your Claude token, in each repository's secrets, and also
  in `~/.config/software-factory/credentials.yaml` on your machine,
  which only you can read
  ([The file on your machine](#the-file-on-your-machine)). Only
  `factory init` reads them there, to store them in your next repository
  without asking, and no other command does. When GitHub refuses the GitHub
  access token on your machine, or it lacks a scope a part needs, init
  says so and asks for a new one. A second person joining your
  repository needs the two logins and the `factory` command, and no
  token, since the tokens are in the repository's secrets.
  [Secrets](github/by-hand.md#secrets) lists each secret, and which
  GitHub account it acts as.

**Who a run acts as, in an organization.** A build acts as the App: its
pull request and comments are from "Software Factory for acme", and its
commits name Claude as their author and the App's bot,
`software-factory-for-acme[bot]`, as their committer. They are not
signed, so GitHub shows no "Verified" on them. The automated review
posts as `github-actions`, a different account, so a build cannot pass
its own review.

**Who can use the App's key.** Two reaches decide it:

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
  secrets no longer reach, the review and builds in the cloud are off.
- **Replace the key,** as [Replacing the App's key](#replacing-the-apps-key)
  shows. A key does not expire by itself.

To check any of this, run `factory doctor`. **It worked when** it shows
✓ on every line, or - for a part you left off. It checks that you are
signed in, and that each secret your parts read is set. It does not
check the GitHub access token and the Claude token that `factory init`
keeps on your machine.

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
ticket that is ready, gets past its step "Sign in as the app". A wrong
key fails the run at that step.

## The file on your machine

`factory init` writes each token it keeps on your machine to
`~/.config/software-factory/credentials.yaml`, or under
`$XDG_CONFIG_HOME` when that is set. Only you can read it, and it is
outside every repository, so it is never committed. One file serves every
repository. It holds two kinds of token:

- **On your own GitHub account,** the GitHub access token and the Claude
  token that `factory init` stored in your repository's secrets, filed
  under your account, here `sam`:

  ```yaml
  github:
    github.com/sam:
      token: ghp_...
  claude-code:
    github.com/sam:
      CLAUDE_CODE_OAUTH_TOKEN: sk-ant-oat01-...
  ```

  Only `factory init` reads these two, and from the file alone: a
  variable of the same name in your environment does not stand in for
  either. A repository an organization owns keeps neither here.

- **For a ticket system with a token of its own**
  ([planned](developing.md#what-is-built)), your token for it,
  which every factory command reads from here, so a second repository
  on the same Jira site asks for nothing. `FACTORY_JIRA_EMAIL` and
  `FACTORY_JIRA_TOKEN`, set in the environment, take priority over the
  file. Set them only where a platform keeps them as secrets and passes
  them in, as [In a session on another machine](#in-a-session-on-another-machine)
  says. Set in your shell's profile, every program you start would
  inherit them.

Whichever it holds:

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
