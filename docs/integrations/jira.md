# Jira

_[Planned](../developing.md#what-is-built)_: Jira as a ticket system.
What the docs say about a ticket system with a token of its own is kept
here until then.

## A ticket system with a token of its own

_[Planned](../developing.md#what-is-built)_: Jira. Until it is built, GitHub
Issues is the only ticket system, and nothing in this section applies.

Your GitHub CLI login reaches GitHub and nothing else, so another ticket
system's token has to be kept by Lunamill, in two places:

| Where the token is kept  | What reads it                              | Who stores it there                                          |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------------ |
| The repository's secrets | The workflows                              | Whoever sets the repository up, by running `lunamill init`   |
| A file on your machine   | Your sessions, through Lunamill's commands | Each person, by running `lunamill init` on their own machine |

Whoever sets the repository up pastes the token once, and `lunamill init`
stores it in both. The workflows then act in the ticket system as that
person, the way they act on GitHub as the account that made the GitHub
token.

For Jira the token is two values, stored under two names:
`LUNAMILL_JIRA_EMAIL`, the email of your Atlassian account, and
`LUNAMILL_JIRA_TOKEN`, an API token. The site's address is in
`.claude/lunamill.yaml`, as
`tickets.site`, so it is not one of them.

On your machine, the token goes in
[the file](../security/credentials.md#the-file-on-your-machine) that holds a GitHub account's
tokens, and every Lunamill command reads it from there, so a second
repository on the same Jira site asks for nothing. `LUNAMILL_JIRA_EMAIL`
and `LUNAMILL_JIRA_TOKEN`, set in the environment, take priority over the
file. Set them only where a platform keeps them as secrets and passes
them in, as
[Jira in a session on another machine](#jira-in-a-session-on-another-machine)
says. Set in your shell's profile, every program you start would inherit
them.

## Joining a repository that uses Jira

Clone it, and with the `lunamill` command
[installed on your machine](../get-started/install.md), run:

```bash
lunamill init
```

Since `.claude/lunamill.yaml` is already there, it shows
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

**It worked when** `lunamill doctor` shows
`✓ The credential on this machine is accepted, for you@example.com` under
Jira.

## Jira in a session on another machine

Every such machine needs Lunamill installed first:

```bash
npm install -g @lunamill-ai/lunamill
```

| Where the session runs          | What you do                                                                                                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A server you reach over SSH     | Run `lunamill init` there. With no browser on the server, open the address it prints on your own machine, make the token, and paste it into the server's terminal                                                                                               |
| A Codespace                     | On GitHub, under your account's Settings, Codespaces, add `LUNAMILL_JIRA_EMAIL` and `LUNAMILL_JIRA_TOKEN` as secrets, with the repository selected. Make the token at [Atlassian's API token page](https://id.atlassian.com/manage-profile/security/api-tokens) |
| A dev container on your machine | Run `lunamill init` inside it, as on a server                                                                                                                                                                                                                   |
| Claude Code on the web          | In the environment's settings, where you choose it for a session, add `LUNAMILL_JIRA_EMAIL` and `LUNAMILL_JIRA_TOKEN` as environment variables. Make the token as in the Codespace row. Put the install line above in the environment's setup too               |

A session with neither the file nor the variables says so as it starts,
in the state of the tickets it shows you, and names
`LUNAMILL_JIRA_EMAIL`, `LUNAMILL_JIRA_TOKEN`, and `lunamill init`. **It worked when**
`lunamill doctor`, run in that session, shows ✓ under Jira.

## When a token stops working

Jira's tokens expire on the date you choose when you make one, at most a
year later. When Jira
refuses the one on your machine, a session says so as it starts, and
every Lunamill command that reads tickets fails with the same line. Run
`lunamill init`: it opens the page that makes a new token, and stores the
one you paste in place of the refused one.

When the workflows' token expires, each run that reads tickets fails, and
its log on the Actions tab names `LUNAMILL_JIRA_EMAIL` and
`LUNAMILL_JIRA_TOKEN`. Whoever can change the repository's secrets runs
`lunamill init`, and answers yes when it asks
`N secrets these parts read are already set. Replace them?`, a different
question from the one a teammate joining the repository answers no to
([Joining a repository that uses Jira](#joining-a-repository-that-uses-jira)).

**It worked when** `lunamill doctor` shows ✓ under Jira, and the failed
run passes when you re-run it.
