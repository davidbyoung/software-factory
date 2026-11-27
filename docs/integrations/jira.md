# Jira

_[Planned](../developing.md#what-is-built)_: Jira as a ticket system.
What the docs say about a ticket system with a token of its own is kept
here until then.

## A ticket system with a token of its own

_[Planned](../developing.md#what-is-built)_: Jira. Until it is built, GitHub
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
[the file](../security/credentials.md#the-file-on-your-machine) that holds a GitHub account's
tokens, and every factory command reads it from there, so a second
repository on the same Jira site asks for nothing. `FACTORY_JIRA_EMAIL`
and `FACTORY_JIRA_TOKEN`, set in the environment, take priority over the
file. Set them only where a platform keeps them as secrets and passes
them in, as
[In a session on another machine](../setup/team.md#in-a-session-on-another-machine)
says. Set in your shell's profile, every program you start would inherit
them.

## When a token stops working

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
