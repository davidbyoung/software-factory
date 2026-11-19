# Skills

A skill is a set of instructions an agent session follows when you ask for
it. An agent, in this page's sense, is a separate reviewer a session
launches, which reads and reports and changes nothing. This page covers
every skill and agent the factory brings.

You call a skill by typing its name as a slash command in a session, with
the ticket or pull request number after it: `/factory-refine 12`. Slash
commands are how Claude Code, the one coding agent the factory supports
today, calls a skill. Asking in
plain words, such as "refine ticket 12", usually calls the same skill, but
the session decides which one fits, so the command is the sure way.

## Which ones a repository gets

The factory's core is what its own steps call, and every repository gets
it. Everything else is written only when a setting or a file turns it on,
and `factory sync` removes it again when that is undone.

| Skill or agent              | Written                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `factory-refine`            | Always                                                                             |
| `factory-build`             | Always                                                                             |
| `factory-address-review`    | Always                                                                             |
| `factory-resolve-conflicts` | Always                                                                             |
| `factory-diagnose`          | Always                                                                             |
| `factory-mutate`            | Always                                                                             |
| `factory-trace`             | Always                                                                             |
| `factory-ticket-readiness`  | Always                                                                             |
| `factory-test-reviewer`     | Always                                                                             |
| `factory-design`            | With [`site`](configuration.md#site) in your settings                              |
| `factory-ui-reviewer`       | With `site` in your settings                                                       |
| `factory-e2e-reviewer`      | With [`commands.end-to-end`](configuration.md#commandsend-to-end) in your settings |
| `factory-deps`              | With a `.github/dependabot.yml` file                                               |

No skill names a test runner, a linter, or a branch. Each runs what your
settings list under [`commands`](configuration.md#commands), through
commands such as `factory gate` and `factory test-one`
([The CLI](cli.md#your-repositorys-commands)), and asks
`factory default-branch` for your default branch's name.

Where a step below names a built-in skill or agent, a
[plugin](plugins.md#the-roles) of yours can stand in for it: your own
refiner, builder, prover, test reviewers, and conflict resolvers.

## At a glance

| Slash command                    | Plain words that also work         | What it does                                                             |
| -------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| `/factory-refine 12`             | "refine ticket 12"                 | Turns a ticket into a spec a builder can start from                      |
| `/factory-build 12`              | "build ticket 12"                  | Builds a ticket to a reviewed pull request                               |
| `/factory-address-review 280`    | "address the review on 280"        | Works a pull request's review until it can merge                         |
| `/factory-resolve-conflicts 280` | "resolve the conflicts on 280"     | Merges your default branch into a pull request and settles the conflicts |
| `/factory-diagnose`              | "diagnose this failing test"       | Finds a bug's cause before any code changes                              |
| `/factory-mutate`                | "mutate this test"                 | Proves a test can fail                                                   |
| `/factory-deps`                  | "fix the dependency pull requests" | Moves dependency pull requests toward merged                             |
| `/factory-design`                | "mock up a new about page"         | Designs a visible change to a website, with mockups                      |
| `/factory-trace`                 | "trace this rule change"           | Traces a change to the rules through every kind of change                |

Typing `/factory` in a session lists them, which is also how to check that
a session picked the factory up.

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
spec when [`specs`](configuration.md#specs) is on.

**What it writes.**

- The ticket's body: your text first, untouched, then Decisions and
  Acceptance criteria, or a Spec when the change is visible and not small.
- Marker comments that move the ticket to "refining" and show it waiting on
  you.
- A blocked-by relationship for each ticket that must be built first.
- For a decision about the look, mockups from your
  [`mockups` plugin](plugins.md), if you have one.

**How it asks.** In the session if you are there: each decision as a
choice, the recommended answer first. Otherwise as one comment on the
ticket, where anything you leave alone goes ahead as written.

**What it never does.** Move the ticket to Ready unasked. Edit a round of
questions once posted. Ask you something the code or the rules already
answer. Ask more than five questions: more than that means the ticket is
several tickets, and it proposes the split.

**Its check.** The built-in `factory-ticket-readiness` agent reads the
result cold, at most twice, and lists what a builder would still have to
ask. Then `factory ticket refined` refuses to mark the ticket refined
while its body lacks a section a build reads.

**Your own in its place.** A skill of yours can refine tickets instead, as
the [`refiner` plugin](plugins.md#refiner), which lists what it has to
leave for the build. To add questions to this one, write them under
"Refining: this repository" in your `CLAUDE.md`.

## `factory-build`

**What it does.** Takes an approved ticket to a reviewed pull request.

1. Claims the ticket, so no other session builds it.
2. Makes a branch from your default branch, named for the ticket.
3. Builds to the acceptance criteria: the test first where there is a
   defect to reproduce or a behavior to add, then the change. A ticket
   carrying a label of one of your
   [`builder` plugins](plugins.md#builder) is built by that skill
   instead.
4. Proves each new test can fail, by its failing run before the change or
   with the [prover](plugins.md#prover), which is `factory-mutate` unless
   you name your own, and has the
   [test reviewers](plugins.md#test-reviewer) read the tests:
   `factory-test-reviewer`, unless your settings list others.
5. Has each [`reviewer` plugin](plugins.md#reviewer) that applies read the
   change, and fixes what they find.
6. Runs the gate with `factory gate`: the commands under
   [`commands.gate`](configuration.md#commandsgate) in your settings.
7. Opens a draft pull request that closes the ticket, saying what changed,
   how it was checked, and what each reviewer found.
8. Marks it ready once CI passes on the pushed commit, then works the
   review with `factory-address-review`.

**When to use it.** On a ticket that has acceptance criteria and your
approval. Running `/factory-build 12` in a session is approval. So is moving the ticket
to Ready.

**What it reads.** The ticket, its Decisions, and your project's
instructions beside the code it changes.

**What it writes.** A branch, commits, a draft pull request, a claim
comment on the ticket, a note of what the build cost, and a line on the
[follow-ups ticket](workflow.md#follow-ups) for anything small it noticed
and did not fix.

**When it stops.** On a question only you can answer, a step only you can
do, an open blocker, or a gate that will not pass or is not set. It
releases the ticket and says why. The ticket stays in "building", waiting
on you.

**What it never does.** Commit on your default branch. Merge. Turn auto-merge
on. Add the label that overrides a review's verdict. Guess at a decision
the ticket left open. Reopen a decision the ticket settled.

**Defaults you can change.**
[`rules.small-change-lines`](configuration.md#rules), default 30: a change
under it takes the lighter path [Workflow](workflow.md) describes.

## `factory-address-review`

**What it does.** Works everything standing between a pull request and its
merge: the threads from the automated review, your own comments, failed
checks, a conflict with your default branch, and, when
[`commands.coverage`](configuration.md#commandscoverage) is set, the
changed lines no test covers.

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
tests them one change at a time. It runs one test or one end-to-end spec
alone with `factory test-one` and `factory end-to-end`.

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

It is the [prover](plugins.md#prover) a build calls, unless your settings
name one of your own.

## `factory-deps`

**What it does.** Moves every open dependency pull request one step closer
to merged: resolves a conflict with your default branch, fixes failing checks,
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
[`mockups` plugin](plugins.md) without listing it; one without `site`
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

**What it does.** Merges your default branch into a pull request that
conflicts with it, runs the gate, and pushes the merge. It never rebases or
forces a push. A conflict in the lock file is settled by rebuilding it with
[`commands.relock`](configuration.md#commandsrelock), and one in a file
that a [`resolver` plugin](plugins.md#resolver) of yours rebuilds, by
that skill. When the two sides of a conflict contradict each other, it
pushes nothing, comments why, and opens a ticket, because which side wins
is your decision.

**When to use it.** Ask it for one pull request ("resolve the conflicts on
280"). `factory-address-review` calls it when the pull request it is
working conflicts. A job in the cloud also runs it as the conflict sweep, after each
push to your default branch and nightly, over every pull request that
conflicts. The sweep checks first that there is something to do, and starts
no session when there is not.

## The built-in agents

### `factory-ticket-readiness`

Reads a refined ticket cold, as the session that will build it, and lists
every question it would still have to ask. `factory-refine` runs it, and
a refiner of your own can: it reads any refiner's ticket against the same
list. Read-only.

### `factory-ui-reviewer`

Reads a change to how a website looks or responds. It runs
`factory site compare`, reads the before and after pictures of the pages
that changed, drives the states the change is about, and judges them
against built-in rules, your `design-guide` when you wrote one, and what
your `checks` printed. It is listed under
[`plugins.build.reviewers`](configuration.md#pluginsbuild) like a reviewer
of your own, with the `files` that should trigger it, and is written only
to a repository with `site` in its settings. Read-only, and slow.

### `factory-test-reviewer`

Reads new or changed tests, whatever their kind, the way a test engineer
reviews a pull request: one behavior per test, each able to fail and
earning its place, with no waits on a timer. `factory-build` runs it,
unless your settings list other
[test reviewers](plugins.md#test-reviewer). Read-only, and it does not run
the suite.

It takes its specifics from your project's instructions beside your tests. Without one,
it applies only those general rules.

### `factory-e2e-reviewer`

Reads new or changed browser end-to-end and smoke tests for what only such
a test can get wrong: specs that go around their page objects, elements
not found the way a user finds them, waits on a timer, and a check that
needs no real browser. It is written only to a repository with
`commands.end-to-end` in its settings, and runs where it is listed under
[`plugins.test.reviewers`](configuration.md#pluginstest), beside
`factory-test-reviewer`, since that list, once written, is the whole list.
Read-only, and it does not run the suite.
