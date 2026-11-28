# GitHub Projects

The board: a GitHub Project with a column for each of a ticket's states.

## What the factory uses it for

### The board

A GitHub Project, owned by the account or the organization that owns the
repository. The sync sets its Status field to the ticket's column and
writes three fields of its own, which `init` adds when the board lacks
them:

| Field   | Shows                                                                    |
| ------- | ------------------------------------------------------------------------ |
| Status  | The column                                                               |
| Session | Which session is on the ticket, "actions, starting", or "Waiting on you" |
| Runs in | "local" or "Actions"                                                     |
| Cost    | An estimate of what refining and building the ticket used                |

Anything typed into the last three is overwritten on the next sync. Its
number, the last part of its address, is [`tickets.board`](../reference/settings/tickets.md#tickets) in your settings.

## You need

A repository on GitHub. `factory init` makes the Project, or uses one
you already have.

## Set it up

Run `factory init` and check "A board", as
[Turn it on](../features/board.md#turn-it-on) says. It asks for a GitHub
access token on your own account
([Tokens and secrets](#tokens-and-secrets)).

## What setup adds

| What                                                                                                                                  | To undo                                      |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Up to six columns, if yours lacked them and `factory init` added them                                                                 | Delete the ones you do not want              |
| Three fields, Session, Runs in, and Cost, if yours lacked them and `init` added them. The sync also sets the board's own Status field | Delete the three                             |
| A Project `init` created, linked to the repository                                                                                    | Delete it, or keep it as an ordinary Project |

A board the factory created for you is an ordinary GitHub Project. Keep
it or delete it.

## Tokens and secrets

The board sync writes with a GitHub access token stored as
`FACTORY_BOARD_TOKEN`. [Secrets](../security/credentials.md#secrets) has
the one to make, and [GitHub](github.md#when-the-github-access-token-expires)
says what to do when it expires.

## What the factory can and cannot do there

The sync sets each ticket's column and writes its three fields. It never
creates, renames, or removes a column or field: `factory init` adds the
ones a board lacks.

## Limits that come from GitHub

None the factory adds to.

## When something goes wrong

A board that does not show a ticket where you expect: run
`factory board check`, which lists the column it reads for each state.

## By hand

The steps `factory init` takes for a board, done without it.

### A board

A GitHub Project that shows each ticket's state as a column, which session
has it, and what it has cost. [The board](../features/board.md) says
what each column means.

1. **Create a Project** under the account or the organization that owns the
   repository: its Projects tab, "New project", Board layout. Link it to
   the repository from the Project's menu, so it shows on the repository's
   Projects tab. Its number is the last part of its address.
2. **Give it the factory's columns:** Backlog, In refinement, Ready, In
   progress, In review, and Done, in its Status field. A new Project starts
   with Todo, In Progress, and Done. To keep columns of your own, map them
   under [`tickets.columns`](../reference/settings/tickets.md#ticketscolumns) instead.
3. **Give it the three fields the sync writes:** Session, a Text field;
   Runs in, a single select with the options Local and Actions; and Cost, a
   Number. A field the sync does not find, it skips.
4. **Point the settings at it,** with the Project's number under
   [`tickets`](../reference/settings/tickets.md#tickets), and which column shows each
   state under [`tickets.columns`](../reference/settings/tickets.md#ticketscolumns),
   here the columns step 2 added:

   ```yaml
   tickets:
     board: 7
     columns:
       backlog: Backlog
       refining: In refinement
       ready: Ready
       building: In progress
       review: In review
       done: Done
   ```

   Then `factory board check` shows how it reads your
   columns.

5. **Store a GitHub token** as `FACTORY_BOARD_TOKEN` ([Secrets](../security/credentials.md#secrets)).
6. **Run `factory sync`.** It turns on the board sync's job, the only
   thing that writes to the board. It never creates, renames, or removes
   a column or field.
