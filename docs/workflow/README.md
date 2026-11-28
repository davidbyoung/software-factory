# The workflow

For anyone working tickets with Lunamill. At the end you know how a
ticket moves from an idea to a merged pull request, who moves it at each
step, and what Lunamill will not do on its own. Each step has a page
of its own: [Write a ticket](tickets.md), [Refine](refine.md),
[Build](build.md), [Review and answer](review.md), [Merge](merge.md), and
[Follow-ups](follow-ups.md). [See where things stand](status.md) shows
every ticket's state, and a [session](../reference/glossary.md#the-words)
is one conversation with your coding agent.

## From a ticket to a merge

| Step              | Who                                                    | Where it runs                                      | What comes out                                                                                                         |
| ----------------- | ------------------------------------------------------ | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Write a ticket    | You                                                    | Your ticket system                                 | A ticket saying what, why, and when it is done                                                                         |
| Refine it         | A session you start                                    | Your machine, in your coding agent                 | The ticket rewritten into acceptance criteria, after you answer its decisions                                          |
| Approve it        | **You**                                                | A session, or your board                           | Run `/lunamill-build N` in a session, or move its card to Ready                                                        |
| Build it          | A session                                              | Your machine, or the cloud when started from Ready | A tested change in a pull request that closes the ticket, or one in [each repository it names](across-repositories.md) |
| Review it         | The automated review, if you set it up                 | The cloud                                          | Comments and a verdict on the pull request                                                                             |
| Answer the review | The session that built it, or, in the cloud, a new one | Where it was built                                 | Each comment fixed, or rejected with evidence                                                                          |
| Merge it          | **You**, or the merge policy for files you allowed     | Your code host                                     | The change on your default branch, and the ticket closed                                                               |

Everything a session on your machine does, it does as you: through your
account on the code host and your coding agent's subscription. A session
in the cloud has no account: a job with no AI checks what it left, and does
it as [the account builds act as](../features/cloud-builds.md#what-a-build-in-the-cloud-does).
No step needs a service of Lunamill's own.

## The six states

A ticket is always in one of six states. They are fixed: you cannot add one
or reorder them. Your board shows them as columns, and which column shows
which state is your repository's choice
([`tickets.columns`](../reference/settings/tickets.md#ticketscolumns)). The table gives the
names `lunamill init` gives the columns it adds.

A state with no column of its own shows in the column of the nearest earlier
state that has one, and a ticket is shown in the `ready` column only when it
is approved. A board without a `ready` column approves a build by running
`/lunamill-build N` in a session, or by running `lunamill build N`.

| State    | Board column  | What it means                                                                                           |
| -------- | ------------- | ------------------------------------------------------------------------------------------------------- |
| backlog  | Backlog       | Nothing is happening                                                                                    |
| refining | In refinement | A session is turning it into a spec, or the spec is written and waits for you                           |
| ready    | Ready         | You approved it for a build from the board                                                              |
| building | In progress   | A session has claimed it, or a build ended without a pull request merging                               |
| review   | In review     | A pull request that closes it is open, or every repository it names has one                             |
| done     | Done          | Its pull request merged, in every repository it names, you closed it, or it is in a column `done` lists |

```text
backlog → refining → ready → building → review → done
                       ↑
              the one move that is yours
```

## Who moves a ticket

| Move               | Who                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------ |
| backlog → refining | The session you run `/lunamill-refine N` in                                                      |
| refining → ready   | **You**, by moving the card, or by running `/lunamill-build N` in a session                      |
| ready → building   | The session that claims it                                                                       |
| building → review  | Opening the pull request                                                                         |
| review → done      | The merge: Lunamill moves the ticket to the first done column, and closes it if it is still open |

Approving a ticket is the only move a person has to make. A session moves
the card to Ready only when you ask it to, as your own move.

## What is fixed

These hold in every repository. They are not settings.

- **A ticket only moves forward on its own.** When the next step is yours,
  it stays where it is and the board says "Waiting on you". Only you move a
  ticket back.
- **Nothing retries by itself.** A build that stopped, failed to start, or
  whose pull request you closed stays in "building", waiting on you. Moving
  it to Ready again retries it.
- **The order does not change.** A repository cannot add a state or reorder
  them. A team that wants a security review between building and review adds
  a [reviewer](../customize/plugins.md#reviewer), not a column. A
  [plugin](../customize/plugins.md#the-roles) can take over a step, such as refining a
  ticket or proving a test, where the step stands.
- **Lunamill's work ends at the merge.** A ticket in any column
  [`tickets.columns.done`](../reference/settings/tickets.md#ticketscolumns) lists is done,
  and Lunamill never moves it out of them. A team with columns after
  Done lists them all, and moves tickets through them itself:

  ```yaml
  tickets:
    columns:
      done: [Done, UAT, Released]
  ```

- **One session holds a ticket at a time.** The claim is recorded on the
  ticket. A second session that tries is told who holds it and stops.
