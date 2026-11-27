# See where things stand

For anyone with tickets in flight. At the end you know each ticket's state,
which session has it, what it cost, and which ones wait on you.

```bash
factory status
```

It lists the factory's open tickets under their
[six states](README.md#the-six-states), each with how long it has been
there, what it has cost, and the session that has it. `factory status --watch`
reads it again every 15 seconds.

**Waiting on you** beside a ticket means nothing moves until you act:
a refinement waits for your answers or your approval, or a build ended
without a merge and needs you to say what next. The ticket's last comment
says which.

In the last 30 days before a token the factory stores stops working,
`status` ends with a line that says when, and
[Troubleshooting](../maintain/troubleshooting.md) says what to do.

Where you have a board, it shows the same, kept up to date by the sync
([The board](../features/board.md)). Every other everyday command is in
[Commands](../reference/cli.md#every-day).
