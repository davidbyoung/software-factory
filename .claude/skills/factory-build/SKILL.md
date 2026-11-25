---
name: factory-build
description: Build a ticket: take an approved ticket to a reviewed pull request: claim it, branch, build it to its spec with the area's reviewers, run the gate, open a draft that links the ticket, and work the review. Use when asked to build, work, pick up, take, or fix a ticket by its number or key, and as the run `factory build N` starts in GitHub Actions.
---

# Working an issue

The issue is the spec. Everything a conversation would have settled has to
be in it or in the repository's rules, so read it as one and stop when it
is not.

Every ticket is read and written through `factory ticket`,
and every pull request's conversation through `factory pr`, so the skill
works whatever the ticket system. A command that cannot read exits
nonzero with the error: that is a failed read, never an empty answer.

Every command a build runs is the settings' own: the gate, one test, an
end-to-end spec, and the spec check each have a `factory` command below
that runs what `.claude/factory.yaml` lists under `commands` and `specs`.
The default branch's name is what `factory default-branch`
prints, and the commands below write it as DEFAULT. N is the ticket's key,
as the ticket system gives it, such as `12` or `PROJ-12`, and TICKET is how
the ticket system writes it in prose, such as `#12`, which
`factory ticket view N --field ref` prints.

## How a build starts

- **Local:** the owner tells a session to work an issue by its key. The
  card stays where it is until the claim moves it.

- **GitHub Actions:** where a poller runs (`builds.trigger` is not
  `manual`), the owner moves the issue's card to Ready on the
  board, and the poller posts a start comment and starts a build, a run
  of the "Factory" workflow, with the issue's key; or a person runs
  `factory build N`, or "Run workflow" on the Actions
  tab. The two are the same run. The run's prompt says so. There is no
  start check, since only someone with write access can dispatch a
  workflow: go straight to the claim, which names the run and who started
  it. Nobody can answer its questions: every stop ends it with a report,
  and a run that ends without a pull request releases the claim. How its
  session differs is "A session in the cloud" in
  `.claude/factory/rules.md`.

There is no queue: each build takes the one issue it was given.

## The claim

The claim comment is the lock. As soon as step 0 finds the issue
approved, and before setup, a branch, or any other work, including the
rest of step 0:

```bash
factory ticket claim N
```

It checks the issue's blockers, posts the claim, waits 5 seconds, reads
the comments back, and prints one line of outcome. A ticket without the
factory label gets it on a claim, and a line saying so comes first; a
`?` line after the outcome says the board sync did not start, which
changes nothing here. The outcome is one of:

- **`claimed`:** go on.
- **`held by SESSION`:** another session holds the issue. Stop and post
  nothing; the script has already deleted this session's claim.
- **`blocked by: M`,** each blocker M as the ticket system writes it: stop.
  In a run in GitHub Actions the script has posted the
  stopped comment, which leaves the card In progress, waiting on you.
  The report is:

  > **Waiting on M, so I did not start this.** M is still open and has
  > to merge first. To build it anyway, remove the relationship from this
  > issue's sidebar, then move its card to Ready again or ask a session to
  > work it.

- **`✗` and a reason** (exit 1): the ticket's repositories keep a build from
  starting here, such as one that is not set up, a list nobody who may
  confirmed, or a checkout the ticket does not name. Nothing was claimed:
  stop, with the line in the report, which says what to run.

- **`could not read`** (exit 1, with the error): stop. In a run in GitHub Actions
  the script has tried to post the stopped comment; if that failed too,
  the nightly sync clears the start. Say so in the report, with the error.

**Every stop after `claimed` and before a pull request** releases the
issue, whatever the reason: a question only the owner can answer, a
missing owner step, "already done", or a gate that would not pass.

```bash
factory ticket stop N "one-line reason"
```

It posts the stopped comment only while this session's claim is still
live, and prints `not live; posted nothing` otherwise, so it never ends a
newer session's claim. A dirty tree in step 1 is a pause for a live user,
not a stop.

**Right after `claimed`, and before the branch,** check that the settings
name a gate:

```bash
factory config get commands.gate
```

When it prints nothing, stop as above, saying `commands.gate` is not set,
so the build would have no way to check its work.

**Before opening the pull request,** check the claim once more:

```bash
factory ticket still-live N
```

`not live` means something ended the claim, such as the nightly sync
clearing it. Push the branch, open no pull request, post no comment, and
say so in the report.

A build that opened its pull request leaves the claim in place through
the review and the merge: the pull request puts the card In review.

## A ticket across repositories

A ticket can name several repositories, in its Repositories section. On a
person's machine one session builds them all. Right after the claim:

```bash
factory workspace N
```

It prints where each repository is, in the order they merge, or that there
is nothing to clone, and then everything below is as for any ticket. With
several, take them in that order, and do steps 1 to 6 whole in each before
the next, after `cd` to the folder it printed. Before the first, check that
the settings name a gate in each, as "Right after `claimed`" above says.

- **A line that ends `built in` and a pull request is done:** skip that
  repository.
- **A clone is on its branch already,** so step 1's `git switch -c` is done
  there. When the branch was on `origin` before, which step 1's `ls-remote`
  shows, step 1's rules for it decide as they stand, and a branch they
  replace is started again with `git switch -C BRANCH origin/DEFAULT`.
- **Read its `CLAUDE.md` and what that imports first,** and follow them
  there. This folder's own rules are for this repository alone.
- **Every `factory` command runs there,** so the settings, the gate, the
  reviewers, the branch, and the pull requests are that repository's. In a
  clone the ticket is written in full, such as `acme/api#12`, and a pull
  request is still its number. Only the Spec lines and the tasks of that
  repository's capabilities are built there, and they alone are the ones
  steps 2 and 4 map and verify there.
- **A reviewer or a skill that repository has and this one lacks** is not
  found by its name here. Hand a reviewer's file, from its `.claude/agents/`,
  to a general-purpose agent as its instructions, and read a skill's
  `SKILL.md` and follow it.
- **A pull request starts with what `factory ticket link N` prints there,**
  which says `Part of`, and what it merges after. It closes nothing, so
  `factory pr closes` prints nothing for it. The ticket closes when the
  last one merges.
- **Watch each one** with `factory pr watch` in its own folder, and work
  each review there. One that waits for another repository's pull request
  to merge is not waited for: it waits for a person.

When every pull request has merged or closed, run
`factory workspace N --remove`. It keeps a clone with work to lose, and the
report names it.

In the cloud a run builds one repository, and the next one's starts by
itself. `factory workspace N` prints what else the session may read, and
it can change only its own. When an earlier pull request has to change for
this one to work, ask for a comment on the ticket that says what, and open
this pull request with `factory pr open --draft`.

## Follow-ups

"Follow-ups" in `.claude/factory/rules.md` says what a follow-up is and what the
follow-ups issue holds. This skill does two things with them.

**A follow-up noticed during a build** goes on the open follow-ups issue,
as one line in the format that section gives, before the report. A reviewer
finding left for the owner, a defect outside the issue's scope, and a
check deferred to later are each a line. A line that needs a decision
from the owner says "Needs a decision:" with the question and stays a
line. A follow-up gets its own issue only when it would need the `spec`
label or would make a line of a spec `factory specs list` prints false,
as that section
says.

```bash
factory follow-up FILE "What is wrong. Found by WHO while building TICKET. The rule it breaks."
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
factory ticket view N --field body > body.md   # check the line, then
factory ticket edit N --body-file body.md
```

A line that says "Needs a decision" is built only when the issue's
Decisions answer it; otherwise it stays unchecked and the pull request
names it. A line the guides do not determine and that lacks the phrase
gets it added, and stays unchecked the same way. Step 3's reviewers run
once, on the whole branch, sized as "Small changes" in
`.claude/factory/rules.md` sizes
a follow-ups build. The pull request lists each line with its commit. It
starts with the line `factory ticket link N` prints only
when every line is checked; otherwise it starts with the line
`factory ticket link N --part` prints, and the unchecked
lines wait there for the next build. The sync reads that line as a
partial build of the follow-ups, so a pull request that only links a line
it added there names the issue any other way.

## 0. Read the issue

```bash
factory ticket view N
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
`factory plugins refiner` prints, and stop: no claim, and
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
  Approval means the round's defaults stand, along with the replies
  `factory ticket answers N` prints: any approver's, as
  refinement reads them. After the claim, first invoke the refiner, the skill
  `factory plugins refiner` prints, with the Skill tool,
  giving it the issue's key and the words "approved while
  waiting: fold the approvers' replies into the body, post no marker". For
  `factory-refine` that is its steps 4 and 5: it folds the replies in and
  reads the result for readiness. Then check that the body is one a build
  can read:

  ```bash
  factory ticket refined N --check
  ```

  It prints `sound` and posts nothing. When it prints what the body is
  missing instead, release the claim and stop, with its output in the
  report. If a reply raises a new decision, or the read finds a
  question only the owner can answer, comment it on the issue, release
  the claim, and stop.

- **Already done, or no longer true:** say so with the evidence, release
  the claim, and leave the issue open for the owner to close.

The `spec` label decides the track, whatever the spec tool, per "Spec
track" in `.claude/factory/rules.md`. Never change it. Without it, skip
steps 2 and 4, unless the issue has a "Spec" section: a small change that
makes a spec line false. That one runs steps 2 and 4 too, and step 2's
command lists fewer files for it.

## 1. Branch

A session in the cloud is on its branch, so it skips to step 2.

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
factory ticket branch N          # prints BRANCH
git ls-remote --exit-code origin refs/heads/BRANCH
```

Give `ls-remote` the full ref: `--heads origin 12` also matches
`feature/someone/12`. Exit 2 means `origin` has no such branch: go on.
Exit 0 means an earlier build's branch is there, and its newest pull
request decides, from `factory pr for-branch BRANCH`:

- **`#M merged`,** and the commit `ls-remote` printed is
  `factory pr view M --field head`: its work is on the
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

## 2. Start the spec from the issue (`spec`, or a Spec section)

The spec tool's copy of the issue, as the branch's first commit. Nothing
in it is new; the thinking was done at refinement.

```bash
factory specs new N
```

With no spec tool it prints `- No spec tool (specs: none): each ticket
holds its own spec.`: the issue is the only copy, so this step ends there.
Otherwise it starts the issue's spec, in the folder it names, and lists
each file to write (`new`) or update (`update`) from the issue, with what
part of the issue goes in it, then a "Then:" line. Write each file as it
says, in the spec tool's own words for a requirement; the Spec lines,
Decisions, Design, and Tasks are the issue's, unchanged in substance. Run
the "Then:" line, and fix what it reports.

Then check that every Spec line is exactly one scenario, or requirement
where the tool has no scenarios, and every one is a Spec line. If one does
not map, stop and comment on the issue with the line and why, rather than
rewording it to fit. Commit the files on their own.

`factory specs new N` exits 1 when the spec tool is not installed, and
says to run `factory init`, which installs it; stop and say so in the
report.

## 3. Build it

Read the `CLAUDE.md` for the area first ("Rules by area" in `CLAUDE.md`).

**A builder plugin:** list them with
`factory plugins builder`, which prints each one's
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

- On the `spec` track, work through the issue's Tasks, and with a spec
  tool tick each in its tasks file as it lands. If the code makes the
  design wrong, update the design (the spec tool's design file, when it has
  one) and say why in the pull request.
- Write the test first, where there is a defect to reproduce or a behavior
  to add, and watch it fail before making the change, as the area's rules
  for tests say ("Rules by area" in `CLAUDE.md`). One test runs alone with
  `factory test-one FILE NAME`.
- A small change takes the path in "Small changes" in
  `.claude/factory/rules.md` instead of the next two items.
- Prove each new test can fail, by its red run or the prover, the skill
  `factory plugins prover` prints, and have each test
  reviewer, the agents `factory plugins test-reviewer`
  prints, read them: one listed with `files` only when the change touches
  a file that matches them.
- **The repository's own reviewers** are listed by
  `factory plugins reviewer`, each with its
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

## 4. Verify and finish the spec (`spec`, or a Spec section)

Verify first: for every Spec line, name the test that exercises it, in
which file, and run it. A line with no test gets one now; a line whose
test cannot fail (its red run before the change shows, or the prover) is
not verified. Record the mapping in the pull request, with or without a
spec tool.

Then fold the spec in, as the last commit before the pull request:

```bash
factory specs finish N
factory specs check
```

With no spec tool, both print the `- No spec tool` line, and there is
nothing to commit.

## 5. Gate, commit, push

Run the gate:

```bash
factory gate
```

It runs each command under `commands.gate` in the settings, in order, and
stops at the first that fails. When it says `commands.gate is not set`,
stop: a build cannot finish until the settings name a gate.

Run the end-to-end specs the change added or changed. Where
`factory config get commands.end-to-end` prints a
command, run each with `factory end-to-end FILE`, and a
new one ten times, with `--times 10` after FILE. Where it prints `none`,
run them the way the repository's `CLAUDE.md` says, or say there is no
end-to-end suite. CI runs the full suite on the draft (step 6).
Commit, and push with `factory pr push`, as "Branching, pushing, and
review" in `.claude/factory/rules.md` describes: one commit per coherent change,
describing the defect or the feature, not the ticket's key alone.

## 6. Open the pull request

The issue is the request for this PR, so open it without asking, as a
draft: a draft gets no automated review, so the pushes that follow cost
nothing until it is ready. Run `still-live` first ("The claim").

```bash
factory pr open --title "..." --body-file pr-N.md
```

It opens a draft from the current branch into the default branch and
prints the pull request's number.

Start the body with the link text
`factory ticket link N` prints, which closes the ticket
when the pull request merges, then what changed and how it was
verified, including each new test's red run or mutation check, and what
each reviewer found and what was done about it.
On the `spec` track, or with a Spec section, include the Spec-line-to-test
mapping from step 4, and, when `factory specs finish N` folded a spec in,
name each spec it changed, as `factory specs list` prints them.

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
factory pr closes PR
```

That has to print N, unless the pull request builds only part of the
follow-ups ticket, or of a ticket across repositories, which it does not
close. If it does not, the link did
not register; fix the body.

Then note what the build cost, on the pull request:

```bash
factory pr cost PR
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
review when it lands. A session in the cloud
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
factory pr wait-checks PR   # prints the conclusion
factory pr ready PR         # only after success or no checks
```

`factory pr ready` enforces commit signatures: when git is set to sign, it
refuses while GitHub shows a commit on the pull request as not verified.

That triggers the review. In a local session, start the watcher "Branching,
pushing, and review" in `.claude/factory/rules.md` describes, and work the
review with the `factory-address-review` skill. A session in the cloud ends
before this step: its run waits for CI, and then marks the pull request
ready.

Where the settings list a file under `auto-merge.allow`, the merge policy labels the pull request `merge-automatic` or `merge-manual` from
the files it changes, and turns auto-merge on for `merge-automatic` ones, which
then merge themselves once every gate passes. Never enable auto-merge,
merge, or add the `verdict-override` label yourself. In the report, say which
label the pull request got, so the owner knows whether it waits for them;
with none listed, no label comes, and say it waits for the owner.

## 7. Report

The issue, the PR, what each reviewer found, the review rounds and their
outcome, any claim or release that failed, and anything left for the
user: a question, a deferred follow-up, or
a decision. Anything agreed but not done is recorded as "Follow-ups"
above says: a line on the follow-ups issue, or its own issue only when it
would need the `spec` label, either way linked from the PR.
