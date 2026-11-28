# GitHub Projects

The board: a GitHub Project with a column for each of a ticket's states.

## What kodor uses it for

The board is a GitHub Project, owned by the account or the organization
that owns the repository. The board sync sets the Project's own Status
field to the ticket's column, and writes three fields of kodor's
own, which `init` adds when the board lacks them:

| Field   | Shows                                                                    |
| ------- | ------------------------------------------------------------------------ |
| Status  | The column                                                               |
| Session | Which session is on the ticket, "actions, starting", or "Waiting on you" |
| Runs in | "local" or "Actions"                                                     |
| Cost    | An estimate of what refining and building the ticket used                |

Anything typed into the last three is overwritten on the next sync. The
Project's number, the last part of its address, is what
[`tickets.board`](../reference/settings/tickets.md#tickets) holds in your
settings.

## You need

A repository on GitHub. `kodor init` makes the Project, or uses one
you already have.

## Set it up

Run `kodor init` and check "A board", as
[Turn it on](../features/board.md#turn-it-on) says. It asks for a GitHub
access token on your own account
([Tokens and secrets](#tokens-and-secrets)).

## What setup adds

| What                                                                                                                                  | To undo                                      |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Up to six columns, if yours lacked them and `kodor init` added them                                                                   | Delete the ones you do not want              |
| Three fields, Session, Runs in, and Cost, if yours lacked them and `init` added them. The sync also sets the board's own Status field | Delete the three                             |
| A Project `init` created, linked to the repository                                                                                    | Delete it, or keep it as an ordinary Project |

A board kodor created for you is an ordinary GitHub Project. Keep
it or delete it.

## Tokens and secrets

The board sync writes with a GitHub access token stored as
`KODOR_BOARD_TOKEN`. [Secrets](../security/credentials.md#secrets) has
the one to make, and [GitHub](github.md#when-the-github-access-token-expires)
says what to do when it expires.

## What kodor can and cannot do there

The sync sets each ticket's column and writes its three fields. It never
creates, renames, or removes a column or field: `kodor init` adds the
ones a board lacks.

## Limits that come from GitHub

**A field holds at most 1,024 characters.** A field you add to a Project, which shows as a column of its table, holds
at most 1,024 characters, so it can't hold a kodor field such as a Spec,
which is often several thousand. Use an
[issue field](github-issues.md#set-it-up) instead
([Your tickets already have fields](../features/board.md#your-tickets-already-have-fields)).

Two more are untested:

- **The board sync on a board an organization owns,** against a real
  organization. It is read the same way as a person's, with the token
  made from the organization's App, whose permissions include the
  organization's Projects. A classic token stored by hand needs access to
  the organization's projects, which an organization's settings can
  refuse.
- **GitHub's built-in board automations,** such as moving a closed issue
  to Done. They may fight the board sync.

## When something goes wrong

A board that does not show a ticket where you expect: run
`kodor board check`, which lists the column it reads for each state.

## By hand

The steps `kodor init` takes for a board, done without it.

### A board

A GitHub Project that shows each ticket's state as a column, which session
has it, and what it has cost. [The board](../features/board.md) says
what each column means.

1. **Create a Project** under the account or the organization that owns the
   repository: its Projects tab, "New project", Board layout. Link it to
   the repository from the Project's menu, so it shows on the repository's
   Projects tab. Its number is the last part of its address.
2. **Give it kodor's columns:** Backlog, In refinement, Ready, In
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

   Then `kodor board check` shows how it reads your
   columns.

5. **Store a GitHub token** as `KODOR_BOARD_TOKEN` ([Secrets](../security/credentials.md#secrets)).
6. **Run `kodor sync`.** It turns on the board sync's job, the only
   thing that writes to the board. It never creates, renames, or removes
   a column or field.
