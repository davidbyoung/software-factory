---
name: factory-address-review
description: Address a pull request's review until it can merge: the Claude review's threads and summary, the owner's comments, failed checks, patch coverage, and a conflict with the default branch, each verified with a repro or a quoted source and answered on its thread. Use when asked to address, handle, or work the review on a pull request, after every push to a branch with an open pull request, and as the run a workflow starts for the owner's review.
---

# Handling a pull request review

Where the automated review is on, a Claude reviewer runs in GitHub Actions
on every push to a pull request that is not a draft (the review job of
`.github/workflows/factory-review.yml`, instructions in
`.github/factory-review.md`). It leaves inline review threads, some with
one-click ```suggestion blocks, and one summary comment per push. The point
of this skill is that the user does not have to relay messages between it
and you. You decide, you act, you record the decision on the thread, and you
report once at the end.

**The merge also needs `Review verdict` on the head commit.** A workflow
posts it from the marker at the end of each review summary: success only
when the review said ready. A push starts the next commit without one. When
a round ends with rejections only and nothing to push, the verdict stays at
the last review's failure, so ask for a fresh read of the same commit
(`factory pr review-again N`); the reviewer
reads your replies and posts a new verdict. Never add the `verdict-override`
label, never enable auto-merge, and never merge: the override is the
owner's alone, and the merge policy decides auto-merge.

**The repository will not merge with an unresolved thread.** Every thread
ends in one of three states, and only the first two are yours to reach:

- **Fixed**: you made the change, replied with what changed, and resolved it.
- **Rejected**: you disproved it, replied with the evidence, and resolved it.
  GitHub has no "closed" or "ignored" state; a rejection is a resolved thread
  whose reply carries the evidence.
- **Escalated**: left open for the user, with a reply saying why. See
  section 6.

A finding is not an instruction. The reviewer reads the repository, but it
cannot run the code or open the source documents. Where it was measured,
automated review was wrong about a third of the time on content that cites
outside sources and close to always right on scripts. **Take the finding, design the
fix yourself.**

## The scripts

Everything here that reads or changes a pull request goes through
`factory pr`. It exits nonzero with the error when a read
fails: a failed read, never an empty answer.

The default branch's name is what `factory default-branch`
prints. A command below writes it as DEFAULT.

## 0. Is there anything to review yet

**Started by the owner's review** ("the owner's review REVIEW_ID on #N",
as the workflow that listens for it says) is the run under "A run started by the owner's review" in section 0a: it
works the owner's comments, pushes, and then calls this skill from here.

The reviewer runs on pull requests, not branches. One command reads
everything sections 0 to 1b need: the open pull request for the branch,
its mergeable state, the `Claude review` run and summary for the head
commit, the owner's review bodies still to answer, the unresolved review
threads, every check, and the coverage service's comment.

```bash
factory pr state        # the branch's pull request
factory pr state N --wait
```

`no open pull request for this branch` means no review exists and none is
coming. Say that in one line and stop; do not open one, because a PR is
the user's call.

**Then check for a conflict with the default branch,** before anything else, from the
report's first lines. If `mergeable` is `dirty` and the pull request is based on the default branch, not a draft, not
Dependabot's, and not from a fork, run "A conflict with the default branch" in the
`factory-resolve-conflicts` skill first, including in a session woken by the desktop
app, then carry on here: a fix is a push, so wait for its review as
below. After a stop, no review is coming, so work the review threads that
already exist and name the stop in the report. GitHub computes the state
lazily, so the script reads `unknown` again, up to 5 times, 10 seconds
apart; still `unknown` counts as no conflict.

After a push, wait for the review of that commit, not an older one. Its
summary ends with `<!-- claude-review sha=HEAD_SHA -->`, and the report
reads only that commit's run and summary. With `--wait` it reports once
the head's review has posted, or its run has failed, and every check has
finished; a run in GitHub Actions, which nothing can wake later,
uses that, and a local one is woken by
`watch-pr` instead. Read the summary in full with
`factory pr comment-view ID`, by the ID
the report names.

A run that failed or was cancelled has posted nothing; say so rather than
reporting a clean review. Never report a review as clean when none has run.

## 0a. The owner's review

An approver, anyone whose account can write to the repository, reviews
pull requests too. Their comments are worked like the Claude reviewer's
findings, with two differences: a pushback on one stays open for an
approver to decide, and an approver's reply after a pushback is final.
Who is an approver is the code host's to say: `factory pr state` and
`factory pr review-pending` already keep only an approver's reviews and
turns, so no step here tests a name.

**Only reviews count:** inline comments, and the body of a submitted
review. A Conversation-tab comment that is not part of a review starts
nothing and is never acted on. Do not go by the review's state: agents open
pull requests through an approver's account, and GitHub does not let an
author approve or request changes on their own pull request, so the
reviews of an approver who is the pull request's author are all
`COMMENTED`.

Every comment this skill posts contains `<!-- agent -->` (section 4), so a
comment without it, from an account those commands count, is an
approver's. Match with
"contains", not "ends with": an automatic footer can follow the marker.

### A run started by the owner's review

The run's setup, and the commands it uses, are as the `factory-resolve-conflicts`
skill's opening says: the workflow has set the run up, so a run does no
setup of its own, and tickets go through `factory ticket` and a pull
request through `factory pr`.

The workflow starts one run for each submitted review and passes the pull
request and the review's ID ("the owner's review REVIEW_ID on #N"). It
ran `factory session ready review N REVIEW_ID` first, which is steps 1 to 3
below without the hand-off to a watching local session, and starts a
session only when the review has something to work. Read what it read again, since time has
passed.

1. **Closed or merged:** stop.
2. **Read that review** and its comments:

   ```bash
   factory pr review N REVIEW_ID
   ```

   It prints the review's author and body, and each comment it left on a
   line with its `id`, `replyTo`, `path`, `line`, and `body`.

3. **Nothing of an approver's in it:** stop without changing anything. That
   is a review by someone who is not an approver, or one of this skill's
   own replies: GitHub records each thread reply as a review under the
   account that posted it, with an
   empty body and one comment carrying the marker. Otherwise work the
   comments without the marker, and the body if it is non-empty and lacks
   the marker.
   **A local session is watching:** the pull request's body has a
   `<!-- session-watching: TIME -->` mark less than an hour old. That session
   has the build context and answers the review, so change nothing else. This
   run is the only one this review gets, so post one comment before stopping,
   so a session that has gone does not lose the review silently:

   > A local session was watching this pull request at TIME and should answer
   > this review. If it has not within an hour, submit the review again.
   >
   > `<!-- agent -->`
   > `<!-- session-handoff -->`

   An older mark is from a session that has gone, so go on.

4. Check out the pull request's branch, Dependabot's included. Read whether
   it can merge as `factory-address-review` section 0 does, and if that is `dirty`
   and the pull request is one the conflict sweep's queue admits, run "A
   conflict with the default branch" in the `factory-resolve-conflicts` skill first, then work each comment as "Each approver comment"
   below says. Run the gate ("Gate" under "A
   conflict with the default branch" in that skill), commit, and push to that branch
   only, never with force. **A push refused because the branch moved**
   means another run, working another review, pushed first: pull with
   `git pull --no-rebase`, run the gate again, and push. Then reply and
   resolve.
5. **When the Claude review runs on the push,** that is, the review is on
   (`factory config get pr-review` prints `on`), and the
   pull request is not a draft, not Dependabot's, not from a fork, and not
   `dirty`, run this skill from section 0, past its note on a run started by the owner's review: wait for the review of the
   push, and work it as a whole, its preamble through
   section 8, reporting as section 8 lays out. Otherwise no review is
   coming: work the review threads that already exist, and end with the
   same report. In this loop, section 1 works only the threads
   `github-actions[bot]` opened; approver threads belong to the runs their
   reviews started.
6. **Only the latest push's run goes on.** In step 5's loop only, before
   working a Claude review and again before each push it makes, compare the pull request's head with your
   last commit (`factory pr view N --field head`). If
   another run has pushed since, stop: its push starts the next Claude
   review, and that run works it, open threads included. A push of approver
   fixes in step 4 that is refused is still pulled and pushed again.

Each run works only its own review, and only the run that pushed last
works the Claude review, so two runs never take the same thread, and no
lock is needed.

If the gate or the push fails, reply on the affected threads with the
error and leave them open.

This run never merges, enables auto-merge, marks a draft ready, or adds the
`verdict-override` label, and it pushes only to the pull request's
branch.

**Outside a run started by a review,** as in a local session working the
pull request, the approver comments to work are the unresolved threads
whose last comment is an approver's and lacks the marker, and the non-empty
approver review bodies submitted after the last Conversation comment carrying the
marker. A comment that also carries `<!-- conflict-fix -->`,
`conflict-stop`, or `<!-- session-handoff -->`, the `factory-resolve-conflicts` skill's
comment markers, does not count as that last comment, so a sweep's comment
does not hide an approver's unanswered review body. Thread replies do not count there, since a reply on one thread does
not answer a review body. The report lists these as "approver review bodies
to answer", and marks an unresolved thread "approver's turn" when its last
comment is an approver's without the marker. Read a review body in full
with `factory pr review N ID`.

### Each approver comment

A comment with a `replyTo` is a reply in an existing thread: read
the whole thread first (`factory pr threads N --all`
lists every thread with its comments, resolved or not),
to see whether it follows a pushback of yours.

- **No pushback yet.** Verify it as section 2 verifies a finding. Comments
  on outdated lines and suggestion blocks get the same treatment; say in
  the reply if the code has moved, and apply a suggestion through the gate
  as section 1 says.
  - **Agreed:** fix it (section 3), push, reply with what changed and the
    commit, and resolve the thread.
  - **Disagreed:** reply once with the evidence, a quoted source, a failing
    test, or the code, and leave the thread open. Never resolve an approver
    thread you did not fix, except as the next bullet says.
- **An approver replied after your pushback.** That reply is final; do not
  push back again.
  - **It asks for the change:** make it, reply that you are following the
    approver's call, with the commit, and resolve the thread.
  - **It accepts the pushback:** reply that you are leaving the code as it
    is, per that reply, and resolve the thread.
  - **You cannot tell which:** ask in one line and leave it open.
- **A review body.** Handle each point in it the same way, and answer it in
  the end comment (section 4); there is no thread to resolve.

Approver threads are outside section 6's round count and its escalation.

## 1. Collect

The reviewer posts as `github-actions[bot]`: its threads are the review
threads that account opened, and its summaries are the issue comments ending
in `<!-- claude-review sha=… -->`. The inline comment tool strips HTML
comments, so the threads carry no marker of their own.

The unresolved threads, each with its comments in full:

```bash
factory pr threads N
```

Work every thread it lists, whoever opened it. Keep each thread's
`commentId`, its first comment: you need it to reply and resolve.

**The summary is part of the review.** Read the latest one in full. It holds
findings that are not about specific lines, the reviewer's verdict, and any
earlier rejection it still disagrees with. Those have no thread, so handle
them exactly as you would a thread and record the verdict in your end
comment. A Low is the exception: take it when it is quick and right, leave
it otherwise, and say which in one line of the end comment. A Low never
causes a push on its own, and one left undone is not a finding.

**A suggestion block is a proposal, not a patch to apply blind.** Verify it
like any finding. If it is right as written, apply the same change locally,
run the gate, and commit it yourself rather than pressing "Commit
suggestion", so the change passes the gate before it lands.

## 1a. CI checks

A review that says ready is not a ready pull request. Wait until **every**
check on the head commit has finished, not only the review:

```bash
factory pr state N --wait
```

In a local session, `factory pr watch N` (see `.claude/factory/rules.md`) already
wakes the session on a failure and when every check has finished, so this
wait is not needed.

Never report a pull request ready while a check is pending or failing, and
never report a check you have not seen finish.

For each failed check, read the failing job's log and find the failure:

```bash
factory pr failed N
```

It prints each failed job's name and the end of its log, and what a failed
check wrote about itself.

Then reproduce it locally before deciding anything, with the `factory-diagnose`
skill when the cause is not plain from the log. A failure gets the same
treatment as a review finding, with evidence:

- **Caused by this pull request**: fix it on this branch, as part of the
  round.
- **Already on the base branch**, a flaky test or a break that landed
  earlier: it is still a bug, and it still blocks the merge. Reproduce it,
  for a flake with a repeated run, find the race and fix it on its own
  branch, so the fix lands on the base branch and not only here. Say so in
  the report.
- **Not reproducible and not understood**: escalate. Do not guess.

**Never re-run a failed check to get it green** without a diagnosed cause,
and never make a check optional to get past it. A check that passes on the
second try is a flake that will fail someone else.

## 1b. Coverage report

Coverage is read from the settings, under `commands.coverage`: the command
that measures it, and where its lcov report lands.

```bash
factory config get commands.coverage.run
factory config get commands.coverage.report
```

**Skip this whole section when they print `none`,** a coverage service's
checks included: the settings name no coverage command, so there are no
lines to judge. A repository that reports to a coverage service sets
`commands.coverage` to get its verdicts.

If the repository reports to Codecov, read its checks in the same pass,
including when the review did not run: a failed review still leaves
coverage to judge. Its bot comments on the PR only when coverage moved,
so a missing comment is normal, not a failed upload.

The report names the bot's comment's ID, if there is one, and lists the
service's patch and project checks among the checks. Read the comment
with `factory pr comment-view ID`.

The comment's red cross on patch coverage is not the status check. Say which
one failed, if either did. Unless the default branch's ruleset requires
them, a red one blocks nothing on its own; project coverage is gated by
whatever floors the coverage command enforces inside the CI check, and
patch coverage by the verdicts below.

Neither the checks nor the comment name lines. Get them from the same lcov
report CI uploads: run the coverage command, the first of the two above,
then

```bash
factory pr uncovered origin/DEFAULT REPORT
```

which prints each uncovered (`MISS`) or partly covered (`PART`) line in the
branch's diff. REPORT is the report's path, the second of the two above.
Its total should roughly match the coverage service's, where there is one;
if it does not, the local run differs from CI, and that has to be settled
before any verdict.

Each line gets a verdict, as a review finding does:

- **Worth a test**: behavior someone could break without any test noticing.
  A handler no unit or end-to-end test drives, a branch with a user-visible
  outcome.
- **Fine as-is**, with the reason, which must be one of these:
  - Covered by an end-to-end test, which unit coverage does not count. Name
    the test.
  - Only runs at build time or on the server, such as a static route
    handler, and the build exercises it.
  - Declarative, like a setting a route exports, where the build fails
    without it.
  - Defensive and unreachable by construction. Say what guarantees it.

"It's only a few lines" is not a reason. Neither is the percentage: the bar
is whether a regression would go unnoticed, not the number.

**On a small change** ("Small changes" in `.claude/factory/rules.md`),
list the uncovered lines with one verdict for them all, **fine as-is: a
small change**, and ask for no test: the tests the small path gives the
change, such as the one that reproduces a bug's defect, stand. This is
the one reason the list above does not hold.

A test written for a coverage line follows the same rules as any other. It
asserts behavior, not that the line ran, and it fails when the code it covers
is broken, which the prover, the skill
`factory plugins prover` prints, proves for a test written
after the code. A test that only executes a line pads the number and locks nothing
in.

There are no threads to resolve. Put the verdicts in the end-of-review PR
comment beside any summary-only findings, grouped as fixed and fine as-is.

## 2. Verify before acting

Never accept or reject from reading alone. Each finding gets evidence:

- **A claim about behavior** gets a repro. Build the smallest input that
  should trigger it and run the real code. Nearly every true finding on this
  repo was confirmed in under ten lines, and more than one _looked_ obviously
  right and was wrong.
- **A claim about a document** gets the passage quoted from the document.
  If the project keeps extracted sources locally, read them; if they are not
  there, say so rather than reasoning from memory.
- **A claim about the codebase** gets a grep or a file read at the cited line.
- **A finding that would reverse a choice** also gets the recorded reason:
  read the commit message, the pull request's body, and the Decisions of
  each ticket `factory pr closes PR` prints, with
  `factory ticket view N`, before accepting it. A session without the build context has only these. If
  the finding conflicts with a recorded decision and the evidence does not
  settle it, reply with both and leave the thread open for the owner.

Watch your own search as hard as the claim. A finding was once "confirmed" by
a grep whose window was too small, and a regulation was declared truncated
when the search string was wrong. If evidence contradicts the finding, that is
a rejection, not a puzzle to work around.

## 3. Fix, and prove the fix

- Write the smallest change that resolves the underlying defect, not the one
  the reviewer described.
- Add a regression test and **prove it can fail**, as the area's rules for
  tests say ("Rules by area" in `CLAUDE.md`): red before the fix and green after, or the fix mutated back. A test
  that cannot fail has not locked anything in. This has caught two tests on
  this repo that passed either way.
- Re-run the real workload, not just the fixture: for the extractor that means
  the real corpus, and the output should be unchanged unless the fix was
  meant to change it.
- Then run the gate, `factory gate`: the commands the
  settings list under `commands.gate`, such as a formatter, a type or
  static check, a linter, and the tests. Do not invent a gate, and do not
  skip one.

## 4. Record the decision on the thread

Every thread gets a reply before it is resolved. The reply is the only place
the reasoning survives, and the user reads these instead of the transcript.

**Every comment this skill posts, a thread reply or a conversation comment,
contains `<!-- agent -->` on its own line.** That marker is how the next
run tells its own words from an approver's (section 0a). Put it at the end of
the body; an automatic footer may follow it.

```bash
factory pr reply N COMMENT_ID --body-file reply.md
```

The script adds the marker when the body lacks it.

- **Accepted**: what changed, in one or two sentences, plus the test that now
  covers it. Say so when the fix differs from what was suggested, and why.
- **Rejected**: the evidence that disproves it, quoted. A rejection with no
  citation is not a rejection, it is a disagreement.

Then resolve it:

```bash
factory pr resolve N COMMENT_ID
```

Resolve accepted and rejected threads alike, with one exception: **an
approver thread is resolved only when you fixed it, or an approver
overruled or accepted your pushback** (section 0a). A pushback on an
approver thread stays open for an approver. GitHub has no "ignored" state:
a rejection is a reply carrying the evidence, followed by the same resolve.
Resolving without replying destroys the reasoning, which is the only reason
the user can audit the decision later.

**Never resolve a thread you neither fixed nor disproved.** If a finding is
real but out of scope, or you cannot settle it either way, say so in the reply
and leave it open: that is an escalation (section 6), and the pull request
cannot merge until the user decides it.

For summary-only findings there is no thread, so collect their verdicts and
post one PR comment at the end:

```bash
factory pr comment N --body-file comment.md
```

## 5. Commit and push

Signing is whatever git config says; do not name a key here, and do not
change the signing setup to get a commit through. If signing blocks, that is
the thing to report, not to work around. A GPG key whose pinentry opens a
dialog will hang an unattended commit forever rather than failing, which is
why this machine signs with SSH.

Confirm the signature landed rather than assuming:

```bash
git log --format='%G? %h %s' -1   # G or U, never N or E
```

`N` means nothing was signed. `E` usually means the verifying side cannot
check it, most often an allowed-signers file that does not list the key this
machine signs with, which is a local verification gap rather than a bad
commit. After pushing, confirm the host agrees:

```bash
factory pr unverified N
```

It prints each commit the code host does not show as signed, with the
reason, and nothing when it shows them all.

`factory pr ready` enforces the same check: when git is set to sign, it
refuses to mark a pull request ready while GitHub shows one of its commits
as not verified.

One commit per coherent change, message describing the defect rather than the
reviewer. Push to the PR branch.

A sweep and a live session can push to the same branch, so a push can be
refused because the branch moved. A conflict fix follows "Commit and
push" under "A conflict with the default branch" in the `factory-resolve-conflicts` skill. Every
other push: pull with
`git pull --no-rebase`, run the gate again, and push.

## 6. Two rounds, then escalate

Approver threads (section 0a) are outside this count, and this section's
escalation does not apply to them: an open approver thread is already an
approver's to decide. A run started by the owner's review has no memory of
earlier sessions, so it counts rounds from the `claude-review sha=`
summaries of the commits it pushed itself.

A round is one review you work: you reply to and resolve its threads, push
your fixes, and the push triggers the next review. Handle **at most two
rounds**. When the third review arrives:

- **Agreement**: its summary says ready to merge, it opened no new threads,
  nothing is open, and every CI check on the head commit has passed. You and
  the reviewer agree; report that the pull request is ready.
- **Anything else**: new threads, a finding repeated after your fix, or a
  rejection the reviewer still disputes. Stop. Do not reply, fix or resolve.
  Escalate.

Escalate sooner, at any round, when:

- the same finding returns after a fix, which means the fix was wrong
- a finding is real but you cannot settle it either way with evidence
- a fix needs a new dependency
- the three-strikes rule below fires
- a finding would change behavior the user chose deliberately

To escalate, leave the threads open and give the user, for each one, the
reviewer's position, yours, and the evidence on both sides. The pull request
cannot merge until they decide, which is the point. If they side with you,
the `verdict-override` label is how they pass the verdict for this commit, and
resolving the escalated threads is theirs too.

## 7. Three strikes on one unit

The three-strikes rule, "Stepping back from a rabbit hole" in
`.claude/factory/rules.md`, applies here too: when one
function or file has taken three or more rounds of corrective work for the
same class of defect, stop and write the comparison it asks for before fixing
again. Add whether the tests are good enough to make a swap verifiable.

## 8. Report once

First, note what this round of work cost, on the pull request:

```bash
factory pr cost PR
```

It posts what the session spent at API list prices since its last note, or
since it started, and the board sync adds it to the issue's Cost. It
exits 0 even when the cost cannot be measured, so it never holds up the
report.

A table of thread, verdict and evidence: fixed, rejected or escalated. Then
the summary-only findings, and the coverage lines, in the same form. Then
any conflict with the default branch: which pull request it was with, which files, and
whether it was fixed (with the merge commit) or stopped (with why, and the
issue opened). A sweep lists every pull request it read as `skip`, with
why, `fixed`, or `stopped`. Then what was committed and pushed, which round this was, and what is still open
and why. Name everything you resolved as rejected, so the user can reopen it.
