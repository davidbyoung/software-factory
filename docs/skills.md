# Skills

A skill is a set of instructions an agent session follows when you ask for
it. An agent, in this page's sense, is a separate reviewer a session
launches, which reads and reports and changes nothing. This page covers
every skill and agent the factory brings.

You call a skill by asking a session in plain words, such as "refine ticket
12". Your coding agent may also have a shorter way to call one by name; on
Claude Code it is a slash command, as
[the reference](github/reference.md#skills-in-claude-code) shows.

## Which ones a repository gets

The factory's core is what its own steps call, and every repository gets
it. Everything else is written only when a setting or a file turns it on,
and `factory sync` removes it again when that is undone.

| Skill or agent              | Written                              |
| --------------------------- | ------------------------------------ |
| `factory-refine`            | Always                               |
| `factory-build`             | Always                               |
| `factory-address-review`    | Always                               |
| `factory-resolve-conflicts` | Always                               |
| `factory-diagnose`          | Always                               |
| `factory-mutate`            | Always                               |
| `factory-ticket-readiness`  | Always                               |
| `factory-test-reviewer`     | Always                               |
| `factory-design`            | With `site` in your settings         |
| `factory-ui-reviewer`       | With `site` in your settings         |
| `factory-deps`              | With a `.github/dependabot.yml` file |

## At a glance

| Ask a session                      | Skill                       | It does                                                               |
| ---------------------------------- | --------------------------- | --------------------------------------------------------------------- |
| "refine ticket 12"                 | `factory-refine`            | Turns a ticket into a spec a builder can start from                   |
| "build ticket 12"                  | `factory-build`             | Builds a ticket to a reviewed pull request                            |
| "address the review on 280"        | `factory-address-review`    | Works a pull request's review until it can merge                      |
| "resolve the conflicts on 280"     | `factory-resolve-conflicts` | Merges your main branch into a pull request and settles the conflicts |
| "diagnose this failing test"       | `factory-diagnose`          | Finds a bug's cause before any code changes                           |
| "mutate this test"                 | `factory-mutate`            | Proves a test can fail                                                |
| "fix the dependency pull requests" | `factory-deps`              | Moves dependency pull requests toward merged                          |
| "mock up a new about page"         | `factory-design`            | Designs a visible change to a website, with mockups                   |
| "trace this rule change"           | `factory-trace`             | Traces a change to the rules through every kind of change             |

## `factory-refine`

**What it does.** Turns a ticket into something a session can build without
asking anything. It works in two roles: a product manager, who challenges
the ask and brings you only the decisions that are yours, and a tech lead,
who settles everything the code and the rules can answer.

**When to use it.** On any ticket before it is built. A ticket with no
acceptance criteria cannot be built; `factory-build` sends it here.

**What it reads.** The ticket and its comments, the open tickets that touch
the same code, the code itself, your project's instructions for the agent
(`CLAUDE.md` files, on Claude Code), and the existing
spec when `specs` is on.

**What it writes.**

- The ticket's body: your text first, untouched, then Decisions and
  Acceptance criteria, or a Spec when the change is visible and not small.
- Marker comments that move the ticket to "refining" and show it waiting on
  you.
- A blocked-by relationship for each ticket that must be built first.
- For a decision about the look, mockups from your
  [`mockups` plug-in](plugins.md), if you have one.

**How it asks.** In the session if you are there: each decision as a
choice, the recommended answer first. Otherwise as one comment on the
ticket, where anything you leave alone goes ahead as written.

**What it never does.** Move the ticket to Ready unasked. Edit a round of
questions once posted. Ask you something the code or the rules already
answer. Ask more than five questions: more than that means the ticket is
several tickets, and it proposes the split.

**Its check.** The built-in `factory-ticket-readiness` agent reads the
result cold, at most twice, and lists what a builder would still have to
ask.

## `factory-build`

**What it does.** Takes an approved ticket to a reviewed pull request.

1. Claims the ticket, so no other session builds it.
2. Makes a branch from your main branch, named for the ticket.
3. Builds to the acceptance criteria: the test first where there is a
   defect to reproduce or a behavior to add, then the change.
4. Proves each new test can fail, and has `factory-test-reviewer` read the
   tests.
5. Has each [`reviewer` plug-in](plugins.md) that applies read the change,
   and fixes what they find.
6. Runs the checks your project's instructions name.
7. Opens a draft pull request that closes the ticket, saying what changed,
   how it was checked, and what each reviewer found.
8. Marks it ready once CI passes on the pushed commit, then works the
   review with `factory-address-review`.

**When to use it.** On a ticket that has acceptance criteria and your
approval. Telling a session "build ticket 12" is approval. So is moving the ticket
to Ready.

**What it reads.** The ticket, its Decisions, and your project's
instructions beside the code it changes.

**What it writes.** A branch, commits, a draft pull request, a claim
comment on the ticket, a note of what the build cost, and a line on the
[follow-ups ticket](workflow.md#follow-ups) for anything small it noticed
and did not fix.

**When it stops.** On a question only you can answer, a step only you can
do, an open blocker, or a gate that will not pass. It releases the ticket
and says why. The ticket stays in "building", waiting on you.

**What it never does.** Commit on your main branch. Merge. Turn auto-merge
on. Add the label that overrides a review's verdict. Guess at a decision
the ticket left open. Reopen a decision the ticket settled.

**Defaults you can change.** `rules.small-change-lines`, default 30: a
change under it takes the lighter path [Workflow](workflow.md) describes.

## `factory-address-review`

**What it does.** Works everything standing between a pull request and its
merge: the threads from the automated review, your own comments, failed
checks, patch coverage, and a conflict with your main branch.

**When to use it.** After every push to a branch with an open pull request.
The session that built the pull request runs it without being asked.

**How it treats a finding.**

- A finding is confirmed by a repro, not by reading. It builds the smallest
  input that should trigger it and runs the real code.
- It takes the finding and designs its own fix, and says in the reply when
  that differs from what was suggested.
- Every thread gets a reply before it is resolved, accepted or rejected.
- A rejection cites evidence: a quoted source or a failing repro.

**Also a job in the cloud.** The job that starts when you review a pull
request runs it too, answering your review: it checks first that there is
something to do, and starts no session when there is not.

**What it writes.** Commits on the branch, a reply on each thread, and one
report.

**When it stops.** After two rounds (`rules.review-rounds`), whatever
is still in dispute goes to you instead of through another round.

**What it never does.** Resolve a thread it neither fixed nor disproved.
Dismiss a failing test as flaky without reproducing it. Merge.

## `factory-diagnose`

**What it does.** Finds the cause of a bug, a failing or flaky test, or a
slowdown, before changing any code. It starts by building one command that
fails on the exact symptom, shrinks it, ranks the possible causes, and
tests them one change at a time.

**When to use it.** When something is broken, failing, flaky, or slow, and
the cause is not already known.

**What it never does.** Change code before it can make the failure happen
on demand. Fix two things at once.

## `factory-mutate`

**What it does.** Proves a test can fail. It breaks the code under test one
way at a time and watches the test go red, then puts the code back and
confirms the working tree is clean.

**When to use it.** For a test written after the code it tests, or one
never seen failing for the right reason. A test that passes either way
locks nothing in.

**What it never does.** Leave a mutation in place.

## `factory-deps`

**What it does.** Moves every open dependency pull request one step closer
to merged: resolves a conflict with your main branch, fixes failing checks,
does the migration a major version asks for, and opens a ticket for
anything it cannot fix.

**When to use it.** When dependency pull requests are stuck, or from the
job in the cloud that runs it for you. It is written, with its two
workflows, only to a repository that has a `.github/dependabot.yml`. A
security update GitHub opens in a repository without that file waits for
you: nothing moves it along or lets it merge itself.

**What it never does.** Merge. Make only the changes CI caught when a
migration guide calls for more.

## `factory-design`

**What it does.** Designs a visible change to a website as a designer
would: one recommended design in real content, built from your site and
pictured by `factory site compare` at your widths in light and dark,
reviewed by `factory-ui-reviewer` before you see it, and shown beside the
page as it is. It reads your `design-guide` when you wrote one, and who
your visitors are from your project's own instructions.

**When to use it.** When asked to redesign or restyle a page, and from
`factory-refine` when a decision changes how something looks. A
repository with `site` in its settings gets it as its
[`mockups` plug-in](plugins.md) without listing it; one without `site`
does not get it at all.

**What it never does.** Make a mockup of a change with no look to choose,
or one made by editing a running page instead of building it. Leave a
scratch worktree behind.

## `factory-trace`

**What it does.** A rule written for one kind of change can be wrong for
every other kind. Before a change to the rules, a skill, an agent, or a
workflow that alters what triggers a step, who runs, or when is marked
ready, this has a fresh agent trace each kind of change your
repository gets through the rules as they would stand, and report any kind
that got heavier, lighter, or ambiguous, and any two rules that now
disagree.

**What it reads.** `.claude/change-types.md`, your list of the kinds of
change your repository gets, each with a real example.

**What it writes.** The fresh agent's report: on the pull request when the
branch has one, and otherwise in the session.

**When it stops.** Before starting an agent, when `.claude/change-types.md`
is missing. The pull request stays a draft, and a comment on it shows the
file's shape for you to write.

## `factory-resolve-conflicts`

**What it does.** Merges your main branch into a pull request that conflicts
with it, runs the gate, and pushes the merge. It never rebases or forces a
push. When the two sides of a conflict contradict each other, it pushes
nothing, comments why, and opens a ticket, because which side wins is your
decision.

**When to use it.** Ask it for one pull request ("resolve the conflicts on
280"). `factory-address-review` calls it when the pull request it is
working conflicts. A job in the cloud also runs it as the conflict sweep, after each
push to your default branch and nightly, over every pull request that
conflicts. The sweep checks first that there is something to do, and starts
no session when there is not.

## The built-in agents

### `factory-ticket-readiness`

Reads a refined ticket cold, as the session that will build it, and lists
every question it would still have to ask. `factory-refine` runs it.
Read-only.

### `factory-ui-reviewer`

Reads a change to how a website looks or responds. It runs
`factory site compare`, reads the before and after pictures of the pages that
changed, drives the states the change is about, and judges them against built-in
rules, your `design-guide` when you wrote one, and what your `checks` printed.
It is listed under `plugins` like a reviewer of your own, with the `files` that
should trigger it, and is written only to a repository with `site` in its
settings. Read-only, and slow.

### `factory-test-reviewer`

Reads new or changed tests the way a test engineer reviews a pull request:
one behavior per test, each able to fail, found the way a user would find
it, with no waits on a timer. `factory-build` runs it. Read-only, and it
does not run the suite.

It takes its specifics from your project's instructions beside your tests. Without one,
it applies only those general rules.
