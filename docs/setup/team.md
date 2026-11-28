# Work as a team

For several people using kodor on one repository, and for anyone
joining a repository someone has set up already, or working from another
machine. At the end each person works as themselves, on the same
version.

## A team

- **Each person signs in as themselves.** A teammate who clones the
  repository needs their own sign-ins to the code host's command-line
  tool and to the coding agent
  ([What you need](repository.md#what-you-need) says how to check each).
  A ticket system with a token of its own for each person, such as
  [Jira](../integrations/jira.md), is _planned_.
  [Tokens and secrets](../security/credentials.md#who-handles-a-token)
  says who handles each token.
- **A person's own session acts as that person.** A commit made by a
  teammate's session goes out under that teammate's account. On your own
  account, a cloud build acts as the one account that owns its token:
  yours, or an account you create for the team's builds
  ([Secrets](../security/credentials.md#secrets)). In an organization whose
  owner has run `kodor init --org`, a cloud build acts as the
  organization's own App
  ([Tokens and secrets](../security/credentials.md#who-handles-a-token)).
- **Anyone who can write to the repository is obeyed.** A session takes
  instructions from a review or a comment by an account with write
  access, and from nobody else. There is nothing to list: give a
  teammate write access, and their reviews are answered.
- **Each person installs kodor once,** on their own machine, as
  [Install](../get-started/install.md) shows. A machine without it
  is told so when a session starts.
- **One version for everyone.** The repository names the version, in
  `.claude/kodor.lock`, and each person's `kodor` command runs that
  one. After an update merges, each person pulls, and nobody installs
  kodor again: the command downloads the new version the first
  time it runs.
- **One session per ticket.** A session claims a ticket before it starts,
  and a second one is told who holds it.
- **Only labeled tickets are kodor's.** A teammate who works a
  ticket by hand removes the kodor label first, and kodor leaves
  its card where they put it
  ([Which tickets are kodor's](../workflow/tickets.md#which-tickets-are-kodors)).
- **One person merges updates.** An update changes the instructions
  everyone's sessions follow, so it always waits for a person.
  [Updating](../maintain/updating.md) describes it.
- **Check your coding agent's plan.** Read its terms to see that it
  covers the way your team would use kodor, including builds that
  run without anyone watching: nobody has tested that it does
  ([What nobody has tested](../about/limitations.md#what-nobody-has-tested)).

## Joining a repository that is already set up

Clone it, and with the `kodor` command
[installed on your machine](../get-started/install.md), run in your
checkout:

```bash
kodor doctor
```

Your sessions use your own sign-ins to the code host and the coding
agent, and the repository's settings and secrets are already there, so
there is nothing to set up.

**It worked when** `kodor doctor` shows ✓ on every line, or `-` for a
part that is off.

## In a session on another machine

1. **Install kodor there,** as [Install](../get-started/install.md)
   shows:

   ```bash
   npm install -g @kodor-ai/kodor
   ```

   A session your coding agent's vendor hosts starts without kodor, and its hooks stop the session's commands until it is there.
   Put that command in the setup of the environment the session runs in
   ([Limitations](../about/limitations.md#what-it-does-not-do)).

2. **Sign in** to the code host's command-line tool and to the coding
   agent, as [What you need](repository.md#what-you-need) says.

**It worked when** `kodor`, run there, prints the list of its
commands, and each check in [What you need](repository.md#what-you-need)
passes.
