# Where your tokens are kept

For anyone who sets the factory up, joins a repository that already uses
it, or works in a [session](glossary.md) on another machine. At the end,
every token the factory needs is where it reads it, and `factory doctor`
shows it works. On GitHub, the first section is all there is. The rest of
the page is for a ticket system with a token of its own, such as Jira,
which is [planned](developing.md#what-is-built), not built yet.

## On GitHub

Two kinds of thing read a token: the workflows, which run in GitHub
Actions, and the sessions on your machine.

- **The workflows** read the repository's secrets. `factory init` stores
  each one the [parts you chose](github/setup.md#run-factory-init) need.
  [Secrets](github/by-hand.md#secrets) lists them, and which GitHub
  account each one acts as.
- **Your sessions** use the logins you already have: the GitHub CLI's,
  from `gh auth login`, and your coding agent's. The factory keeps no
  token of its own on your machine.

So a teammate joining the repository needs those two logins, `npm ci`,
and the `factory` command [installed](quick-start.md#1-install).

**It worked when** `factory doctor` shows ✓ on every line, or - for a
part you left off. It checks that you are signed in, and that each secret
your parts read is set.

## A ticket system with a token of its own

_[Planned](developing.md#what-is-built)_: Jira. Until it is built, GitHub
Issues is the only ticket system, and nothing below applies.

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

Clone it, install, and run `factory init`:

```bash
npm ci
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

### The file on your machine

`factory init` writes the token to
`~/.config/software-factory/credentials.yaml`, or under
`$XDG_CONFIG_HOME` when that is set. Only you can read it, and it is
outside every repository, so it is never committed. One file serves every
repository: a second repository on the same Jira site asks for nothing.

- **The factory refuses a file others can read,** as `ssh` refuses a
  private key, and prints the `chmod` that fixes it.
- **A session cannot read it.** The factory's commands read it
  themselves, and the factory stops a session that tries to open the
  file itself.
- **`FACTORY_JIRA_EMAIL` and `FACTORY_JIRA_TOKEN`, set in the
  environment, take priority** over the file. Set them only where a
  platform keeps them as secrets and passes them in, as the table below
  says. Set in your shell's profile, every program you start would
  inherit them.

### In a session on another machine

| Where the session runs          | What you do                                                                                                                                                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A server you reach over SSH     | Run `factory init` there. With no browser on the server, open the address it prints on your own machine, make the token, and paste it into the server's terminal                                                                                              |
| A Codespace                     | On GitHub, under your account's Settings, Codespaces, add `FACTORY_JIRA_EMAIL` and `FACTORY_JIRA_TOKEN` as secrets, with the repository selected. Make the token at [Atlassian's API token page](https://id.atlassian.com/manage-profile/security/api-tokens) |
| A dev container on your machine | Run `factory init` inside it, as on a server                                                                                                                                                                                                                  |
| Claude Code on the web          | In the environment's settings, where you choose it for a session, add `FACTORY_JIRA_EMAIL` and `FACTORY_JIRA_TOKEN` as environment variables. Make the token as in the Codespace row                                                                          |

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

`factory remove` lists the token on your machine among what is left to do
by hand, since another repository may use it.
[Removing it](removing.md#removing-it) has the rest.
