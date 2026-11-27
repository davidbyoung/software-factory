# GitHub Issues

The ticket system: where your tickets live, with their labels, their
comments, and which one waits on another.

## What the factory uses it for

A ticket is an issue. Refinement writes the spec into its body, a session
comments on it as it works, and the pull request that resolves it closes
it when it merges.

## You need

A GitHub repository with Issues turned on: on GitHub, Settings, General,
Features, check "Issues".

## Set it up

`factory init` needs nothing more for tickets. It reads issues through the
GitHub CLI you signed in with
([Set up a repository](../setup/repository.md#what-you-need)).

## What setup adds

The labels the factory uses, each made the first time it needs it, such
as `factory` on each ticket it works on and `spec` on a change your users
will see. [Labels, statuses, and checks](../reference/labels-and-statuses.md)
lists them, and [`tickets.labels`](../reference/settings/tickets.md#ticketslabels)
renames them.

## Tokens and secrets

None of its own: the factory reaches issues with the same sign-in it uses
for the repository ([GitHub](github.md)).

## What the factory can and cannot do there

- **It records that one ticket waits on another** as a "blocked by"
  relationship, which shows in each issue's sidebar
  ([Write a ticket](../workflow/tickets.md#tickets-that-wait-on-another)).
- **It closes a ticket through its pull request,** whose body starts with
  the line `factory ticket link 12` prints, such as `Closes #12`.
- **It works only on issues with its label**
  ([Write a ticket](../workflow/tickets.md#which-tickets-are-the-factorys)).

## Limits that come from GitHub

A pull request closes an issue only in the repository it merges into, so a
ticket across repositories closes when the last of its pull requests
merges ([A ticket across repositories](../workflow/across-repositories.md)).

## When something goes wrong

A ticket that does not close when its pull request merges: check that
`factory pr closes 15` prints the ticket's number. If it prints nothing,
the pull request's first line does not link it.

## By hand

Nothing to do: turning Issues on is the one step.
