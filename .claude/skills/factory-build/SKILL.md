---
name: factory-build
description: Build a ticket: take an approved GitHub issue to a reviewed pull request: claim it, branch, build it to its spec with the area's reviewers, run the gate, open a draft with Closes #N, and work the review. Use when asked to build, work, pick up, take, or fix a ticket by number, and as the run `factory build N` starts in GitHub Actions.
---

# Working an issue

The issue is the spec. Everything a conversation would have settled has to
be in it or in the repository's rules, so read it as one and stop when it
is not.

Every ticket is read and written through `npx --no-install factory ticket`,
and every pull request's conversation through `factory pr`, so the skill
works whatever the ticket system. A command that cannot read exits
nonzero with the error: that is a failed read, never an empty answer.

Every command a build runs is the settings' own: the gate, one test, an
end-to-end spec, and the spec check each have a `factory` command below
that runs what `.claude/factory.yaml` lists under `commands` and `specs`.
The default branch's name is what `npx --no-install factory default-branch`
prints, and the commands below write it as DEFAULT.

## How a build starts

- **Local:** the owner tells a session to work an issue by number. The
  card stays where it is until the claim moves it.

- **GitHub Actions:** the owner moves the issue's card to Ready on the
  board, and the poller posts a start comment and dispatches
  "Factory build" with the issue's number; or a person runs
  `npx --no-install factory build N`, or "Run workflow" on the Actions
  tab. The two are the same run. The run's prompt says so. There is no
  start check, since only someone with write access can dispatch a
  workflow: go straight to the claim, which names the run and who started
  it. The run cannot be woken later, and nobody can answer
  its questions: every stop ends it with a report. If it ends without a
  pull request, its last step, `factory ticket end`, releases the claim.

There is no queue: each build takes the one issue it was given.

## The claim

The claim comment is the lock. As soon as step 0 finds the issue
approved, and before setup, a branch, or any other work, including the
rest of step 0:

```bash
npx --no-install factory ticket claim N
```

It checks the issue's blockers, posts the claim, waits 5 seconds, reads
the comments back, and prints one line:

- **`claimed`:** go on.
- **`held by SESSION`:** another session holds the issue. Stop and post
  nothing; the script has already deleted this session's claim.
- **`blocked by: #M`:** stop. In a run in GitHub Actions the script has posted the
  stopped comment, which leaves the card In progress, waiting on you.
  The report is:

  > **Waiting on #M, so I did not start this.** #M is still open and has
  > to merge first. To build it anyway, remove the relationship from this
  > issue's sidebar, then move its card to Ready again or ask a session to
  > work it.

- **`could not read`** (exit 1, with the error): stop. In a run in GitHub Actions
  the script has tried to post the stopped comment; if that failed too,
  the nightly sync clears the start. Say so in the report, with the error.

**Every stop after `claimed` and before a pull request** releases the
issue, whatever the reason: a question only the owner can answer, a
missing owner step, "already done", or a gate that would not pass.

```bash
npx --no-install factory ticket stop N "one-line reason"
```

It posts the stopped comment only while this session's claim is still
live, and prints `not live; posted nothing` otherwise, so it never ends a
newer session's claim. A dirty tree in step 1 is a pause for a live user,
not a stop.

**Right after `claimed`, and before the branch,** check that the settings
name a gate:

```bash
npx --no-install factory config get commands.gate
```

When it prints nothing, stop as above, saying `commands.gate` is not set,
so the build would have no way to check its work.

**Before opening the pull request,** check the claim once more:

```bash
npx --no-install factory ticket still-live N
```

`not live` means something ended the claim, such as the nightly sync
clearing it. Push the branch, open no pull request, post no comment, and
say so in the report.

A build that opened its pull request leaves the claim in place through
the review and the merge: the pull request puts the card In review.

## Follow-ups

"Follow-ups" in `.claude/factory/rules.md` says what a follow-up is and what the
follow-ups issue holds. This skill does two things with them.

**A follow-up noticed during a build** goes on the open follow-ups issue,
as one line in the format that section gives, before the report. A reviewer
finding left for the owner, a defect outside the issue's scope, and a
check deferred to later are each a line. A line that needs a decision
from the owner says "Needs a decision:" with the question and stays a
line. A follow-up gets its own issue only when it would need the `spec`
label or would make a line of `openspec/specs/` false, as that section
says.

```bash
npx --no-install factory follow-up FILE "What is wrong. Found by WHO while building #N. The rule it breaks."
```

FILE is the file or page the follow-up is about, and leads its line. The
script appends the line to the open follow-ups issue, or opens the issue
when none is open, and prints which.

**The follow-ups issue** is built here like any issue, with these
differences. Its unchecked lines are the criteria; there is no `spec`
label, so steps 2 and 4 are skipped. Every unchecked line is built on the
one branch, in order, one commit per line, and the line is checked off in
the body (`- [ ]` to `- [x]`) once its commit is in:

```bash
npx --no-install factory ticket view N --field body > body.md   # check the line, then
npx --no-install factory ticket edit N --body-file body.md
```

A line that says "Needs a decision" is built only when the issue's
Decisions answer it; otherwise it stays unchecked and the pull request
names it. A line the guides do not determine and that lacks the phrase
gets it added, and stays unchecked the same way. Step 3's reviewers run
once, on the whole branch, sized as "Small changes" in
`.claude/factory/rules.md` sizes
a follow-ups build. The pull request lists each line with its commit. It
starts with `Closes #N` only when every line is checked; otherwise it
starts with `Part of #N`, and the unchecked lines wait there for the next
build. The sync reads `Part of #N` as a partial build of the follow-ups,
so a pull request that only links a line it added there names the issue
any other way.

## 0. Read the issue

```bash
npx --no-install factory ticket view N
```

It prints the title, state, labels, body, and each comment with its ID
and author.

The owner's approval is moving the card to Ready, telling a local
session to build the issue, or starting a build of it in GitHub Actions,
which anyone with write access can do and whose claim names who did. Each
counts only for an issue that has:

- a "Spec" or "Acceptance criteria" section in its body; or
- the `follow-up` label, since the follow-ups issue's unchecked lines are
  its criteria.

Without either, run the refiner, the skill
`npx --no-install factory plugins refiner` prints, and stop: no claim, and
nothing to release. Do not guess at what content should say or how a page
should behave.

Otherwise, claim it now ("The claim"), then read on.

- **Approved:** its "Spec" (or "Acceptance criteria") section is what to
  build, and its "Decisions" are settled. On the `spec` track, "For the
  builder" is the plan. Without that label there is none: the plan is the
  criteria, the Decisions, and the area's `CLAUDE.md`, which already says
  where logic goes, how tests are written, and what a page must look like.
  Build to them without reopening them. If the code makes a design note
  wrong, depart from it and say so in the pull request, with the reason.
  If a step under "Dependencies", or under "Decisions" on an issue without
  `spec`, that only the owner can do has not happened, such as a form or
  key with no value given, release the claim and say so.
- **Approved while a comment round waits on the owner:** the newest
  refinement marker on the issue is `<!-- work-status: waiting -->`.
  Approval means the round's defaults stand, along with the owner's
  replies. After the claim, first invoke the refiner, the skill
  `npx --no-install factory plugins refiner` prints, with the Skill tool,
  giving it the issue's number and the words "approved while
  waiting: fold the owner's replies into the body, post no marker". For
  `factory-refine` that is its steps 4 and 5: it folds the replies in and
  reads the result for readiness. Then check that the body is one a build
  can read:

  ```bash
  npx --no-install factory ticket refined N --check
  ```

  It prints `sound` and posts nothing. When it prints what the body is
  missing instead, release the claim and stop, with its output in the
  report. If a reply raises a new decision, or the read finds a
  question only the owner can answer, comment it on the issue, release
  the claim, and stop.

- **Already done, or no longer true:** say so with the evidence, release
  the claim, and leave the issue open for the owner to close.

The spec track applies only when `npx --no-install factory config get specs`
prints `openspec`; otherwise skip steps 2 and 4. When it does, the `spec`
label decides the track, per "Spec track" in `.claude/factory/rules.md`.
Never change it. Without it, skip steps 2 and 4, unless the issue has a
"Spec" section: a small change that makes a spec line false. That one runs
step 2 with the proposal and spec delta only, and step 4.

## 1. Branch

First, `git status --short`. If it shows anything, stop and ask the user
whether to commit it, on the current branch or on a new branch of its own if
the current one is the default branch, or to stash it with `git stash -u`. A plain
`git stash` leaves untracked files behind. A switch carries
uncommitted changes onto the new branch, where the issue's commit would sweep
them into its PR, and refuses outright when a changed file differs between
the branches.

Then name the branch, as `code-host.branch-name` in the settings says,
and look for it on `origin`:

```bash
git fetch origin
npx --no-install factory ticket branch N          # prints BRANCH
git ls-remote --exit-code origin refs/heads/BRANCH
```

Give `ls-remote` the full ref: `--heads origin 12` also matches
`feature/someone/12`. Exit 2 means `origin` has no such branch: go on.
Exit 0 means an earlier build's branch is there, and its newest pull
request decides, from `npx --no-install factory pr for-branch BRANCH`:

- **`#M merged`,** and the commit `ls-remote` printed is
  `npx --no-install factory pr view M --field head`: its work is on the
  default branch. Delete it with `git push origin --delete BRANCH`, say
  `Branch BRANCH's pull request #M merged; replacing it.`, and go on.
- **`#M open`:** stop ("The claim") with
  `Branch BRANCH is already on origin, with open pull request #M. Work it with /factory-address-review M`.
- **Anything else,** or commits pushed after the merge: stop with
  `Branch BRANCH is already on origin, with work no pull request merged. Open a pull request from it to keep that work, or delete it with: git push origin --delete BRANCH`.
  A build that lost its claim pushed its branch to keep its work, and
  this is how the owner keeps it.

No build carries on from an unmerged branch. A local branch of the same
name stops the build the same way, naming `git branch -D BRANCH` for the
owner to run once they have looked at its commits, unless its last
commit is the merged pull request's head: then switch away from it if
it is checked out, with `git switch --detach origin/DEFAULT`, and
delete it with the remote one. Then, from the latest default branch:

```bash
git switch -c BRANCH origin/DEFAULT
```

If the branch you left has commits not on `origin/DEFAULT`, name it in the
report, so that work is not lost.

## 2. Create the change from the issue (`spec`, or a Spec section)

The change is the issue's body in OpenSpec's shape, as the branch's first
commit. Nothing in it is new; the thinking was done at refinement.

```bash
export DO_NOT_TRACK=1
npx --no-install factory specs change-name N      # prints NAME
npx --no-install openspec new change NAME
npx --no-install openspec status --change NAME
```

Read NAME once, here, and use it through step 4's archive, whatever
the branch is called. For each artifact `status` lists, run
`npx --no-install openspec instructions <artifact> --change NAME` and
fill it from the issue. An issue without
the `spec` label fills `proposal.md` and the spec delta only; OpenSpec
validates and archives a change without `design.md` or `tasks.md`.

- `proposal.md` from §1, the owner's request, and "Decisions", linking the
  issue.
- `specs/<capability>/spec.md`, one per capability heading under "Spec":
  `## ADDED Requirements` for a new capability, `## MODIFIED Requirements`
  for a modified one, and `## REMOVED Requirements` for each "No longer"
  line. Each numbered Spec line becomes one requirement, named after it,
  whose SHALL sentence restates it, with one scenario in the line's own
  words: its "When" clause is the WHEN and the rest is the THEN. A
  MODIFIED requirement copies the current spec's requirement and changes
  only what the line changes.
- `design.md` from "Design".
- `tasks.md` from "Tasks".

Then check that every Spec line is exactly one scenario and every
scenario is a Spec line. If one does not map, stop and comment on the
issue with the line and why, rather than rewording it to fit. Run the
spec check, `npx --no-install factory specs check`, and commit the
change on its own.

## 3. Build it

Read the `CLAUDE.md` for the area first ("Rules by area" in `CLAUDE.md`).

**A builder plugin:** list them with
`npx --no-install factory plugins builder`, which prints each one's
labels. When the issue carries one of a builder's labels, invoke that skill
with the Skill tool to build it, in place of the steps below up to the
reviewers. The reviewers still run on what it built, the test reviewers
and the repository's own, and so does everything after them. Which
reviewers those are is decided by the change's own path: a small change's
by "Small changes" in `.claude/factory/rules.md`, content the repository
reviews by what changed by that path in `CLAUDE.md`, and anything else by
the items below. A reviewer
the builder's report shows it already ran is not run again: its line in
the pull request is the skip line "already run by the builder". What the
builder's report says goes in the pull request body at step 6, where the
owner reads it before merging.

**Content the repository reviews by what changed:** when `CLAUDE.md` gives
a kind of content its own path by what changed in it, an edit to that
content follows that path.

**Code:**

- On the `spec` track, work through the change's `tasks.md` and tick each
  task as it lands. If the code makes the design wrong, update `design.md`
  and say why in the pull request.
- Write the test first, where there is a defect to reproduce or a behavior
  to add, and watch it fail before making the change, as the area's rules
  for tests say ("Rules by area" in `CLAUDE.md`). One test runs alone with
  `npx --no-install factory test-one FILE NAME`.
- A small change takes the path in "Small changes" in
  `.claude/factory/rules.md` instead of the next two items.
- Prove each new test can fail, by its red run or the prover, the skill
  `npx --no-install factory plugins prover` prints, and have each test
  reviewer, the agents `npx --no-install factory plugins test-reviewer`
  prints, read them: one listed with `files` only when the change touches
  a file that matches them.
- **The repository's own reviewers** are listed by
  `npx --no-install factory plugins reviewer`, each with its
  `files`. A reviewer is considered when a file the branch changed matches
  one of its `files`. Whether it applies is decided from the agent's own
  description. Each considered reviewer ends with either a run, its
  findings fixed before going on, or one line in the pull request saying
  why it was skipped.
- **When the issue's body has a mockup,** render the result in each of
  the mockup's states, from the mockup's data where the code can take it,
  at its widths and color schemes, before opening the pull request. On a
  site page, the UI reviewer's screenshots are the result. Anything else,
  such as terminal output, an email, or a comment, is rendered however
  fits the surface, such as running the formatter on the mockup's rows. The
  acceptance criteria may not name every style the mockup shows, so the
  comparison is the check, and step 6 puts it in the pull request.

## 4. Verify and archive the change (`spec`, or a Spec section)

Verify before archiving: for every scenario in the change's specs, name
the test that exercises it, in which file, and run it. A scenario with no
test gets one now; a scenario whose test cannot fail (its red run before
the change shows, or the prover) is not verified. Record the mapping in the pull request.

Then fold the change into the specs, as the last commit before the pull
request:

```bash
DO_NOT_TRACK=1 npx --no-install openspec archive NAME --yes
```

Then run the spec check, `npx --no-install factory specs check`.

## 5. Gate, commit, push

Run the gate:

```bash
npx --no-install factory gate
```

It runs each command under `commands.gate` in the settings, in order, and
stops at the first that fails. When it says `commands.gate is not set`,
stop: a build cannot finish until the settings name a gate.

Run the end-to-end specs the change added or changed. Where
`npx --no-install factory config get commands.end-to-end` prints a
command, run each with `npx --no-install factory end-to-end FILE`, and a
new one ten times, with `--times 10` after FILE. Where it prints `none`,
run them the way the repository's `CLAUDE.md` says, or say there is no
end-to-end suite. CI runs the full suite on the draft (step 6).
Commit and push as "Branching, pushing, and review" in
`.claude/factory/rules.md` describes: one commit per coherent change,
describing the defect or the feature, not the issue number alone.

## 6. Open the pull request

The issue is the request for this PR, so open it without asking, as a
draft: a draft gets no automated review, so the pushes that follow cost
nothing until it is ready. Run `still-live` first ("The claim").

```bash
npx --no-install factory pr open --title "..." --body-file pr-N.md
```

It opens a draft from the current branch into the default branch and
prints the pull request's number.

Start the body with the link text
`npx --no-install factory ticket link N` prints (`Closes #N` on GitHub),
then what changed and how it was
verified, including each new test's red run or mutation check, and what
each reviewer found and what was done about it.
On the `spec` track, or with a Spec section, name the spec it changed under `openspec/specs/` and
include the scenario-to-test mapping from step 4.

When the issue has a mockup, the body has a "Mockup and result" section:
a table with the mockup beside the result for each state, then each
difference on its own line, ending "fixed" or the reason it stands, or
"No differences." when there are none. Check it by reading the two
images side by side, element by element, not the criteria. The failure it
prevents is a build that met its ticket's criteria and dropped the
mockup's colors, dimming, count format, and underline until the owner ran
it. When the images cannot be attached,
still list every difference, and say in the
section that the images are missing; the build does not stop for them.

```bash
npx --no-install factory pr closes PR
```

That has to print N. If it does not, GitHub did not register the link; fix
the body.

Then note what the build cost, on the pull request:

```bash
npx --no-install factory ticket cost PR
```

The claim started the session's cost clock; this posts what the session
and its reviewers spent at API list prices since then, and restarts it.
The board sync adds it to the issue's Cost. `factory-address-review` notes each later
round the same way. It exits 0 even when the cost cannot be measured.

Two cases change the body. When the build made a layout or style choice
in a small change, the UI reviewer's screenshots go in the body and the
pull request stays a draft: the owner marks it ready once they have seen
it ("Small changes" in `.claude/factory/rules.md`), so skip the ready step below. The
same holds when the owner has said they want to see the pull request
before it is marked ready. Someone
still works the review that click starts. A local session starts the
watcher now, as the paragraph after the ready step says, and works the
review when it lands. A run in GitHub Actions
cannot wait that long, so its step 7
report tells the owner the review is theirs to start and work, with
`factory-address-review` in a session they open, as a skill that runs as parallel
slices does. When it changes a line the repository's rules leave for the
owner to write, say the owner wrote it and link where they did, or the
review holds it as High.

When the gate passes and everything is pushed, mark it ready for review,
once GitHub shows the pushed commit as its head and every CI run on it has
passed or been skipped. A "ready" sent sooner can carry the
previous commit, or a suite that is about to fail. A failure is fixed on
the draft first, where a push costs no review.

```bash
npx --no-install factory pr wait-checks PR   # prints the conclusion
npx --no-install factory pr ready PR         # only after success or no checks
```

`factory pr ready` enforces commit signatures: when git is set to sign, it
refuses while GitHub shows a commit on the pull request as not verified.

That triggers the review. In a local session, start the watcher "Branching,
pushing, and review" in `.claude/factory/rules.md` describes. A run in GitHub Actions, which nothing
can wake later, waits for the review with
`npx --no-install factory pr state PR --wait` instead, and does not start
`factory pr watch`. Work the review with the `factory-address-review` skill.

The merge-policy workflow labels the pull request `merge: automatic` or `merge: manual` from
the files it changes, and turns auto-merge on for `merge: automatic` ones, which
then merge themselves once every gate passes. Never enable auto-merge,
merge, or add the `verdict: override` label yourself. In the report, say which
label the pull request got, so the owner knows whether it waits for them.

## 7. Report

The issue, the PR, what each reviewer found, the review rounds and their
outcome, any claim or release that failed, and anything left for the
user: a question, a deferred follow-up, or
a decision. Anything agreed but not done is recorded as "Follow-ups"
above says: a line on the follow-ups issue, or its own issue only when it
would need the `spec` label, either way linked from the PR.
