# Risks that remain

For whoever judges what is left once Lunamill's limits hold. Each
risk has a heading of its own, and says what limits it.

## What a hijacked session could still do

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
  words well enough. The usual wordings are refused, and Publish asks the
  code host what the pull request would close, but a merge's own message can hold text
  neither reads. You would reopen that ticket.
- **Pass its own review, where your CI's own token can write.** That token
  is the account the verdict is trusted from, and the code in a pull request
  runs beside it. A new repository's token can only read by default, but
  an older repository's may still write
  ([GitHub Actions](../integrations/github-actions.md#limits-that-come-from-github)),
  so `lunamill doctor` checks it. A workflow of yours
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
  [presets](../customize/presets.md), and the repository's own secrets, such as your
  registry's read-only token. It could send them to the npm registry, to
  a host under [`builds.hosts`](../reference/settings/builds.md#builds), or put them in
  its commits and comments.
- **Use up what pays for sessions,** for as long as
  [`session-minutes`](../reference/settings/session-minutes.md#session-minutes) allows.

It could not, short of getting out of the agent's sandbox, read the
credential that pays for it. The sandbox is "not a complete isolation
boundary", in
[its vendor's own words](https://code.claude.com/docs/en/sandboxing)
([What nobody has tested](../about/limitations.md#what-nobody-has-tested)). A
session that got out of it would still find no key to your code host on its machine.

## Who can pass the review without it

Your branch rules require "Review verdict", and "Approval policies" where
you have [approval policies](../features/approval-policies.md), from the cloud
runner, not from Lunamill's own workflow. So a workflow that a pull request
adds can pass them:

- **From a branch of your repository,** a workflow that asks for
  `permissions: statuses: write` gets it, whatever your default
  ([the cloud runner's own words](https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication#modifying-the-permissions-for-the-github_token)),
  and can mark them passed at any time. Anyone who can push a branch can
  do this: a person with write access, or a session on your own machine,
  which works with your sign-in. A session in the cloud can't add a
  workflow. Pushing such a branch already reaches your repository's
  secrets, without a pull request, so this lets someone merge without the
  review, not reach anything new.
- **From a fork,** a workflow can't post a status, since
  [its token is read-only](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions#how-permissions-are-calculated-for-a-workflow-job).
  A job named `Review verdict` or `Approval policies` does pass them, but
  only for the few seconds after each push, before Lunamill marks them
  waiting. A fork's push
  [turns auto-merge off](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/automatically-merging-a-pull-request),
  so only someone merging by hand in those seconds would let it through.
  In a public repository, a first-time contributor's workflows
  [wait for your approval](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#controlling-changes-from-forks-to-workflows-in-public-repositories)
  before they run at all, and in a private one a fork's run only as
  [its fork settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository#enabling-workflows-for-forks-of-private-repositories)
  allow.

Where several people can write to your repository, have the code host
wait for you on every change to a workflow, with a `CODEOWNERS` rule that
requires your review
([GitHub](../integrations/github.md#waiting-for-you-on-every-change-to-a-workflow) has the steps).

## Risks that do not go away

- **"Universal" is a guess until a second repository uses it.** Everything
  here was drawn out of one repository.
- **A session acts as you.** That is the design: your agent writes the
  commits, and they go out under your account. It also means the guard
  against a session approving its own work, with `verdict-override` or
  `policy-override`, is a tripwire, not a lock. Your read of the pull
  request is the control.
- **The skills are prose, and prose is hard to test.** A change of wording
  changes behavior in every repository that updates. The checks are a traced
  read by a fresh agent, one real ticket, and your read of the update.
- **Rules that need judgment cannot be enforced.** CI can require that a
  reviewer ran or was skipped with a reason. It cannot check the reason was
  a good one.
- **It amplifies the checks it is given.** A repository with weak tests gets
  confident, wrong pull requests faster.
- **Ticket text, review comments, and changelogs are read by sessions.**
  Only an approver's words are treated as instructions, and that rests on
  who your code host says can write to the repository. Give write access
  as carefully as you would give a session its orders.
- **An update delivers instructions that run with your tokens.** Read update
  pull requests as carefully as code.
- **It sits on tools that change.** Several parts work around how today's
  coding agent and code host behave.
- **Publishing cannot be undone.** A public release needs a history and
  examples free of the host repository's private tickets first.
