# Workflow

How a ticket moves from an idea to a merged pull request, who moves it at
each step, and what the factory will not do on its own.

## From a ticket to a merge

| Step              | Who                                                | Where it runs                                      | What comes out                                                                |
| ----------------- | -------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- |
| Write a ticket    | You                                                | Your ticket system                                 | A ticket saying what, why, and when it is done                                |
| Refine it         | A session you start                                | Your machine, in your coding agent                 | The ticket rewritten into acceptance criteria, after you answer its decisions |
| Approve it        | **You**                                            | A session, or your board                           | Run `/factory-build N` in a session, or move its card to Ready                |
| Build it          | A session                                          | Your machine, or the cloud when started from Ready | A tested change in a pull request that closes the ticket                      |
| Review it         | The automated review, if you set it up             | Your CI                                            | Comments and a verdict on the pull request                                    |
| Answer the review | The session that built it                          | Where it was built                                 | Each comment fixed, or rejected with evidence                                 |
| Merge it          | **You**, or the merge policy for files you allowed | Your code host                                     | The change on your default branch, and the ticket closed                      |

Everything a session does, it does as you: through your account on the
code host and your coding agent's subscription, on your machine or in the
cloud. No step needs a service of the factory's own.

## The six states

A ticket is always in one of six states. They are fixed: you cannot add one
or reorder them. Your board shows them as columns, and which column shows
which state is your repository's choice
([`tickets.columns`](configuration.md#ticketscolumns)). The table gives the
names `factory init` gives the columns it adds.

A state with no column of its own shows in the column of the nearest earlier
state that has one, and a ticket is shown in the `ready` column only when it
is approved. A board without a `ready` column approves a build by running
`/factory-build N` in a session, or by running `factory build N`.

| State    | Board column  | What it means                                                                 |
| -------- | ------------- | ----------------------------------------------------------------------------- |
| backlog  | Backlog       | Nothing is happening                                                          |
| refining | In refinement | A session is turning it into a spec, or the spec is written and waits for you |
| ready    | Ready         | You approved it for a build from the board                                    |
| building | In progress   | A session has claimed it, or a build ended without a pull request merging     |
| review   | In review     | A pull request that closes it is open                                         |
| done     | Done          | The ticket is closed                                                          |

```text
backlog → refining → ready → building → review → done
                       ↑
              the one move that is yours
```

## Who moves a ticket

| Move               | Who                                                                        |
| ------------------ | -------------------------------------------------------------------------- |
| backlog → refining | The session you run `/factory-refine N` in                                 |
| refining → ready   | **You**, by moving the card, or by running `/factory-build N` in a session |
| ready → building   | The session that claims it                                                 |
| building → review  | Opening the pull request                                                   |
| review → done      | The merge, which closes the ticket                                         |

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
  a [reviewer](plugins.md#reviewer), not a column. A
  [plugin](plugins.md#the-roles) can take over a step, such as refining a
  ticket or proving a test, where the step stands.
- **One session holds a ticket at a time.** The claim is a comment on the
  ticket. A second session that tries is told who holds it and stops.

## The board

The factory writes four fields of the board: its Status, and three of its
own. Anything you type into the
last three is overwritten on the next sync.

| Field   | Shows                                                                                 |
| ------- | ------------------------------------------------------------------------------------- |
| Status  | The column                                                                            |
| Session | Which session is on the ticket, "actions, starting", or "Waiting on you"              |
| Runs in | Whether that session is on a machine or in the cloud                                  |
| Cost    | An estimate of what refining and building the ticket used, summed across its sessions |

Sessions never write the board directly. They post marker comments on the
ticket, and one job in the cloud, the board sync, reads those and sets the
fields.
That is why a ticket's history survives even if the board is rebuilt.

`factory status` prints the same picture in a terminal.

## Tickets that wait on another

When building one ticket first would break another, or mean redoing work,
the second is recorded as blocked by the first, using the ticket system's
own relationship between tickets. A build never starts on a ticket with an open blocker, and
starts at the poller's first pass after the blocker closes if the ticket is in Ready.

Two tickets touching the same file is not a blocker. That is a merge
conflict, and the session that owns the pull request resolves it.

## Sizing the work to the change

A change under about 30 lines outside tests (30 by default,
[`rules.small-change-lines`](configuration.md#rules)), adding no new
component and no new state, is **small**. It skips the heavier steps: no
separate spec, no readiness read, no read by the test reviewers, and one
test that reproduces the defect or checks the change. The first message of
the work says which path it is taking, so you can overrule it before it
starts.

Two kinds of small change keep the test reviewers: a change to tests
alone, and code that builds what is sent to an outside service.

## Follow-ups

A session building one ticket often notices something else: a test that
cannot fail, a stale sentence, a button under its size floor. It does not
stop to fix it, and it does not open a ticket for it. It adds a line to the
repository's **follow-ups ticket**, which is an ordinary ticket whose body
is a checklist:

```text
Follow-ups

- [ ] src/pages/about.tsx: The heading skips from level 1 to level 3.
- [ ] scripts/release.sh: The usage text still names a flag that was removed.
- [ ] tests/search.spec.ts: This test passes even when search returns nothing.
```

There is one per repository, it carries the `follow-up` label, or the
name you give it under [`tickets.labels`](configuration.md#ticketslabels), and there is
nothing to configure. When you approve it, a session fixes every unchecked
line on one branch, one commit per line, in one pull request.

**Why a checklist and not a ticket each.** Every ticket costs the same
steps whatever its size: refining, your approval, a branch, a pull request,
a review, and a merge. For a one-line fix that is all overhead. Twenty
small fixes on one checklist cost you one approval and one pull request.

**What becomes a line, and what gets its own ticket.**

| What the session noticed                                 | What it becomes                                       |
| -------------------------------------------------------- | ----------------------------------------------------- |
| Something small that breaks a rule your guides state     | A line                                                |
| Something that needs your call before it can be fixed    | A line that says "Needs a decision:" and the question |
| Something that would change what your users see          | Its own ticket                                        |
| Something you asked for                                  | Its own ticket                                        |
| Something that breaks no rule, or needs measuring to see | Nothing                                               |

Every line names the file it is about, says what is wrong, and says which
rule it breaks, so it can be fixed as written.

## Who merges

Every pull request gets one of two labels, which you can rename under
[`code-host.labels`](configuration.md#code-hostlabels):

- **`merge-automatic`**: every file is allowed by your
  [`auto-merge`](configuration.md#auto-merge) settings, and none of the
  commands you listed there held it. It merges itself once every check
  passes.
- **`merge-manual`**: anything else. It waits for a person to merge it,
  and a "Who merges" status on the pull request says what held it and
  why.

Two more things guard a merge:

- **"Review verdict"** is a status, which you can make required on your
  default branch, that passes only when the automated
  review of the newest commit said it is ready, or an approver overrode it
  with the `verdict-override` label. Sessions never add that label.
- **Every review thread must be resolved.** A session answers each one,
  fixed or rejected with evidence, before resolving it.

Both the labeling and the verdict run from your default branch's copy of
the rules, so a pull request cannot change how it is judged.

A session never merges, never turns auto-merge on, and never overrides a
verdict.

## A change your users will see

A change that adds or alters behavior someone can see, and is not
[small](#sizing-the-work-to-the-change), gets the `spec` label, which
refinement adds and the build reads. Refinement writes three things into
its ticket, after your own text:

- **Spec:** what the change must do, as numbered "When this, then that"
  lines, such as "3. When a visitor sends the form with no email, the
  form still sends." To change one, name it by its number where
  refinement asks you, in the session or in a comment on the ticket,
  such as "3: and when the email is not valid, it says so."
- **Design:** where the change goes and the cases it must handle.
- **Tasks:** the steps to build it, each naming the test that checks it.

The design and tasks sit in a collapsed "For the builder" section, so
you can read the Spec and approve the ticket as you approve any other
([From a ticket to a merge](#from-a-ticket-to-a-merge)). The build works
from the ticket alone, and its pull request's description lists the
test that checks each Spec line.

A [spec tool](configuration.md#specs), such as OpenSpec, also keeps the
Spec in your repository.

Every other ticket, such as a bug fix, a copy change, or a small change,
has a list of acceptance criteria instead: what must be true for it to
be done.
