# Build a ticket

For someone building an approved ticket with `/factory-build 12`, on
their machine. At the end a draft pull request holds the change, its
tests, and what each reviewer found. [Builds in the cloud](../features/cloud-builds.md)
does the same with nobody at the keyboard.

## Sizing the work to the change

A change under about 30 lines outside tests (30 by default,
[`rules.small-change-lines`](../reference/settings/rules.md#rules)), adding no new
component and no new state, is **small**. It skips the heavier steps: no
separate spec, no readiness read, no read by the test reviewers, and one
test that reproduces the defect or checks the change. The first message of
the work says which path it is taking, so you can overrule it before it
starts.

Two kinds of small change keep the test reviewers: a change to tests
alone, and code that builds what is sent to an outside service.

## `factory-build`

**What it does.** Takes an approved ticket to a reviewed pull request.

1. Claims the ticket, so no other session builds it.
2. Makes a branch from your default branch, named for the ticket.
3. Builds to the acceptance criteria: the test first where there is a
   defect to reproduce or a behavior to add, then the change. A ticket
   carrying a label of one of your
   [`builder` plugins](../customize/plugins.md#builder) is built by that skill
   instead.
4. Proves each new test can fail, by its failing run before the change or
   with the [prover](../customize/plugins.md#prover), which is `factory-mutate` unless
   you name your own, and has the
   [test reviewers](../customize/plugins.md#test-reviewer) read the tests:
   `factory-test-reviewer`, unless your settings list others.
5. Has each [`reviewer` plugin](../customize/plugins.md#reviewer) that applies read the
   change, and fixes what they find.
6. Runs the gate with `factory gate`: the commands under
   [`commands.gate`](../reference/settings/commands.md#commandsgate) in your settings.
7. Opens a draft pull request that closes the ticket, saying what changed,
   how it was checked, and what each reviewer found.
8. Marks it ready once CI passes on the pushed commit, then works the
   review with `factory-address-review`. A build in the cloud ends at step
   7: its run waits for CI and marks it ready, and the review's answers are
   runs of their own ([What a cloud run is](../security/cloud-runs.md#what-a-cloud-run-is)).

**When to use it.** On a ticket that has acceptance criteria and your
approval. Running `/factory-build 12` in a session is approval. So is moving the ticket
to Ready.

**What it reads.** The ticket, its Decisions, and your project's
instructions beside the code it changes.

**What it writes.** A branch, commits, a draft pull request, a claim comment
on the ticket, a note of what the build cost, and, in the pull request, each
[follow-up](follow-ups.md): something it noticed and did not fix.

**When it stops.** On a question only you can answer, a step only you can
do, an open blocker, or a gate that will not pass or is not set. It
releases the ticket and says why. The ticket stays in "building", waiting
on you.

**What it never does.** Commit on your default branch. Merge. Turn auto-merge
on. Add the label that overrides a review's verdict. Guess at a decision
the ticket left open. Reopen a decision the ticket settled.

**Defaults you can change.**
[`rules.small-change-lines`](../reference/settings/rules.md#rules), default 30: a change
under it takes the lighter path
[Sizing the work to the change](#sizing-the-work-to-the-change) describes.
