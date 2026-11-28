# Work as a team

For several people using the factory on one repository, and for anyone
joining a repository someone has set up already, or working from another
machine. At the end each person works as themselves, on the same
version.

## A team

- **Each person signs in as themselves.** A teammate who clones the
  repository needs their own logins, and, with a ticket system of its own
  ([planned](../developing.md#what-is-built), such as
  [Jira](../integrations/jira.md)), runs
  `factory init` once for their own token.
  [Tokens and secrets](../security/credentials.md) says what to do.
- **A person's own session acts as that person.** A commit made by a
  teammate's session goes out under that teammate's account. On your own
  account, a cloud build acts as the one account that owns its token:
  yours, or an account you create for the team's builds
  ([Secrets](../security/credentials.md#secrets)). In an organization whose
  owner has run `factory init --org`, a cloud build acts as the
  organization's own App
  ([Tokens and secrets](../security/credentials.md#who-handles-a-token)).
- **Anyone who can write to the repository is obeyed.** A session takes
  instructions from a review or a comment by an account with write
  access, and from nobody else. There is nothing to list: give a
  teammate write access, and their reviews are answered.
- **Each person installs the factory once,** on their own machine, as
  [Install](../get-started/install.md) shows. A machine without it
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
[installed on your machine](../get-started/install.md), run in your
checkout:

```bash
factory doctor
```

Your sessions use your own sign-ins to the code host and the coding
agent, and the repository's settings and secrets are already there, so
there is nothing to set up.

**It worked when** `factory doctor` shows ✓ on every line, or `-` for a
part that is off. A ticket system with a token of its own, such as
[Jira](../integrations/jira.md), asks each person for theirs, and its
page says how.

## In a session on another machine

Install the factory there, as above, and sign in to the code host and the
coding agent as you would on your own machine. A session that cannot run
the install command, such as a hosted one, gets the factory from the same
line ([Install](../get-started/install.md)).
