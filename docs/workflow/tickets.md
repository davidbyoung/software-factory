# Write a ticket

For someone writing a ticket for the factory to build. At the end the
ticket says what you want and why, carries the factory's label, and
records which ticket it waits on, if any.

## Which tickets are the factory's

The factory works only on tickets that carry its label, a label named
`factory`, which the factory creates the first time it needs it.
Everything else is left alone: the factory doesn't add it to the board,
move its card, fill in its fields, comment on it, or build it, and
`factory status` doesn't list it. A ticket without the label that is
already on your board, because you or your board's own automation put
it there, stays where it is. That way a board you share with
people who work by hand stays theirs. You can give the label another
name under [`tickets.labels`](../reference/settings/tickets.md#ticketslabels).

A ticket gets the label in one of three ways:

- **The factory opens it.** Every ticket the factory opens carries the
  label, such as one opened from a [follow-up](follow-ups.md).
- **You add it,** in your ticket system as you would any label, or from
  a terminal with `factory ticket adopt 12`.
- **You name it in a session.** Running `/factory-refine 12` or
  `/factory-build 12` on a ticket without the label adds it, even one you
  took the label off, and the session says so:

  ```text
  #12 had no factory label: added it, so the factory now tracks #12
  ```

**Removing the label hands a ticket back.** The factory leaves its card
in the column it's in, with its fields as they were, and nothing builds
it. To work a ticket by hand, remove the label first. While a ticket has
the label, the factory keeps its card in the column the ticket's state
calls for, which it works out from what sessions record on the ticket,
each time the [board sync](../features/board.md) runs. It keeps two moves of yours: to Ready, which
approves a build, and back to Backlog. Drag a labeled card anywhere
else and the next sync moves it back.

If you set the factory up before the label existed, the update that
brings it has you label every open ticket once:
[Labeling your open tickets](../maintain/upgrade-notes.md#labeling-your-open-tickets).

## Tickets that wait on another

When building one ticket first would break another, or mean redoing work,
the second is recorded as blocked by the first, using the ticket system's
own relationship between tickets. A build never starts on a ticket with an open blocker, and
starts at the poller's first pass after the blocker closes if the ticket is in Ready.

A session that opens or refines a ticket records its blockers for you. To
record one yourself, say that ticket 13 waits on ticket 12:

```bash
factory ticket block 13 --by 12
```

**It worked when** `factory ticket blockers 13` lists ticket 12.
`factory ticket unblock 13 --by 12` takes it off
([Commands run for you](../reference/cli-internal.md#tickets)).

Two tickets touching the same file is not a blocker. That is a merge
conflict, and the session that owns the pull request resolves it, or a run
in the cloud.

## Tickets across repositories

A ticket can name several repositories. Each gets its own pull request, and
the ticket closes when the last one merges:
[A ticket across repositories](across-repositories.md).
