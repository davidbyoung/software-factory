# See where things stand

For anyone with tickets in flight. At the end you know each ticket's state,
which session has it, what it cost, and which ones wait on you.

```bash
lunamill status
```

It lists lunamill's open tickets, those with its
[label](tickets.md#which-tickets-are-lunamills), under their
[six states](README.md#the-six-states), each with how long it has been in
its state, what it has cost, and the session that has it:

```text
  #     Title                                                Time in status  Cost   Session

Backlog  1
  #77   Show a cloud build's commits as verified             3d

In refinement  1
  #63   Support Jira as a ticket system                      4d                     local 502d66cf
        ⚠ stale

In progress  1
  #127  Turn the pull request review on with true            4m              $1.20  local 749cadda
```

**It worked when** it lists your open tickets, or prints each state with
nothing under it. `lunamill status --watch` reads it again every 15 seconds.

**Waiting on you** in the Session column means nothing moves until you
act: a refinement waits for your answers or your approval, or a build ended
without a merge and needs you to say what next. The ticket's last comment
says which.

When the coding agent's token, or on your own account the code host's
access token, stops working within 30 days, `status` ends with a line that
says when, and [Troubleshooting](../maintain/troubleshooting.md#lunamill-status-says-a-token-stops-working-soon)
says what to do.

Where you have a [board](../features/board.md), it shows the same, kept up
to date by the board sync. Every other everyday command is in
[Commands](../reference/cli.md#every-day).
