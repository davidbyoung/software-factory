# GitHub Issues

The ticket system: where your tickets live, with their labels, their
comments, and which one waits on another.

## What Lunamill uses it for

A ticket is an issue. Refinement writes the spec into its body, a session
comments on it as it works, and the pull request that resolves it closes
it when it merges.

## You need

A GitHub repository with Issues turned on: on GitHub, Settings, General,
Features, check "Issues".

## Set it up

`lunamill init` needs nothing more for tickets. It reads issues through the
GitHub CLI you signed in with
([Set up a repository](../setup/repository.md#what-you-need)).

Optionally, a Lunamill field can live in a field of the ticket rather
than in its description. A Lunamill field is a section refinement writes,
such as the Spec or the Decisions, and
[`tickets.fields`](../reference/settings/tickets.md#ticketsfields) says
which ticket field holds each. Here a ticket field is an
[issue field](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/managing-issue-fields-in-your-organization),
shown beside the issue. You create it in your account's or your
organization's settings, under Issue fields. Create it before you run
`lunamill init`, which offers only the fields that exist
([Your tickets already have fields](../features/board.md#your-tickets-already-have-fields)).
Without one, each Lunamill field stays in the description.

## What setup adds

The labels Lunamill uses. Setup makes `policy-override` when you turn
on an approval policy, and Lunamill makes each of the others the first
time it needs it, such as `lunamill` on each ticket it works on and `spec`
on a change your users will see. [Labels, statuses, and checks](../reference/labels-and-statuses.md)
lists them, and [`tickets.labels`](../reference/settings/tickets.md#ticketslabels)
renames them.

## Tokens and secrets

None of its own: on your machine Lunamill reaches issues with the same
sign-in it uses for the repository, and in the cloud with the same token
or App as the rest of the run ([GitHub](github.md)).

## What Lunamill can and cannot do there

- **It records that one ticket waits on another** as a "blocked by"
  relationship, which shows in each issue's sidebar
  ([Write a ticket](../workflow/tickets.md#tickets-that-wait-on-another)).
- **It closes a ticket through its pull request,** whose body starts with
  the line `lunamill ticket link 12` prints, such as `Closes #12`.
- **It works only on issues with its label**
  ([Write a ticket](../workflow/tickets.md#which-tickets-are-lunamills)).
- **A ticket's key is its issue number,** such as `12`, which is what the
  `lunamill ticket` commands take as N.
- **What it records on a ticket is a comment on the issue:** the note
  the [poller](../features/builds-from-the-board.md#the-poller) leaves
  before it starts a build, saying a build is starting, and what a
  session records for the board sync, such as claiming the ticket or what
  it cost
  ([The fields the sync writes](../features/board.md#the-fields-the-sync-writes)).
- **Its labels are the repository's,** serving its issues and its pull
  requests alike, so a name under
  [`tickets.labels`](../reference/settings/tickets.md#ticketslabels) can't
  match one under
  [`code-host.labels`](../reference/settings/code-host.md#code-hostlabels).

## Limits that come from GitHub

A pull request closes an issue only in the repository it merges into, so a
ticket across repositories closes when the last of its pull requests
merges ([A ticket across repositories](../workflow/across-repositories.md)).

An issue field shows its text as typed, without Markdown formatting, so a
Lunamill field written into one, such as a Spec, reads as written: a list
keeps its numbers and dashes, and a table shows its `|` marks.

## When something goes wrong

A ticket that does not close when its pull request merges: check that
`lunamill pr closes 15` prints the ticket's number. If it prints nothing,
the pull request's first line does not link it.

## By hand

To rename a label that tickets already carry, open the repository's
Issues, then Labels, and choose Edit on the label. Give it the name you
wrote under [`tickets.labels`](../reference/settings/tickets.md#ticketslabels).
That moves every ticket that has it.
