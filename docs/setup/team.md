# Work as a team

For several people using the factory on one repository, and for anyone
joining a repository someone has set up already, or working from another
machine. At the end each person works as themselves, on the same
version.

## A team

- **Each person signs in as themselves.** A teammate who clones the
  repository needs their own logins, and, with a ticket system of its own
  ([planned](../developing.md#what-is-built), such as Jira), runs
  `factory init` once for their own token.
  [Tokens and secrets](../security/credentials.md) says what to do.
- **A person's own session acts as that person.** A commit made by a
  teammate's session goes out under that teammate's account. On your own
  account, a cloud build acts as the one account that owns its token:
  yours, or an account you create for the team's builds
  ([Secrets](../security/credentials.md#secrets)). In an organization whose
  owner has run `factory init --org`, a cloud build acts as the
  organization's own GitHub App
  ([Tokens and secrets](../security/credentials.md#on-github)).
- **Anyone who can write to the repository is obeyed.** A session takes
  instructions from a review or a comment by an account with write
  access, and from nobody else. There is nothing to list: give a
  teammate write access, and their reviews are answered.
- **Each person installs the factory once,** on their own machine, as
  [the quick start](../get-started/quick-start.md#1-install) shows. A machine without it
  is told so when a session starts.
- **One version for everyone.** The repository names the version, in
  `.claude/factory.lock`, and each person's `factory` command runs that
  one. After an update merges, each person pulls, and nobody installs
  the factory again: the command downloads the new version the first
  time it runs.
- **One session per ticket.** A session claims a ticket before it starts,
  and a second one is told who holds it.
- **Only labeled tickets are the factory's.** A teammate who works a
  ticket by hand removes the factory label first, and the factory leaves
  its card where they put it
  ([Which tickets are the factory's](../workflow/tickets.md#which-tickets-are-the-factorys)).
- **One person merges updates.** An update changes the instructions
  everyone's sessions follow, so it always waits for a person.
  [Updating](../maintain/updating.md) describes it.
- **Check your coding agent's plan.** Read its terms to see that it
  covers the way your team would use the factory, including builds that
  run without anyone watching: nobody has tested that it does
  ([What nobody has tested](../about/limitations.md#what-nobody-has-tested)).

## Joining a repository that is already set up

Clone it, and with the `factory` command
[installed on your machine](../get-started/quick-start.md#1-install), run:

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

## In a session on another machine

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
