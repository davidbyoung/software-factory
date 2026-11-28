# Review and answer

For someone reading the pull request a build opened, and answering its
review with `/lunamill-address-review 15`, where 15 is the pull request's
number. The comments come from you, your team, and, where it is on,
[the automated review](../features/automated-review.md). At the end each
comment is fixed, or rejected with evidence, and each thread resolved. A
conflict with your default branch is settled the same way
([`lunamill-resolve-conflicts`](#lunamill-resolve-conflicts)).

## `lunamill-address-review`

**What it does.** Works everything standing between a pull request and its
merge: the threads from the automated review, your own comments, failed
checks, a conflict with your default branch, and, when
[`commands.coverage`](../reference/settings/commands.md#commandscoverage) is set, the
changed lines no test covers.

**When to use it.** After every push to a branch with an open pull request.
The session that built the pull request, on your machine, runs it without
being asked.

**How it treats a finding.**

- A finding is confirmed by a repro, not by reading. It builds the smallest
  input that should trigger it and runs the real code.
- It takes the finding and designs its own fix, and says in the reply when
  that differs from what was suggested.
- Every thread gets a reply before it is resolved, accepted or rejected.
- A rejection cites evidence: a quoted source or a failing repro.

**Also a run in the cloud.** An Answer run uses it once, to answer a review
you submit, or CI or the automated review on a pull request a build in the
cloud opened. It checks first that there is something to do, and starts no
session when there is not. It pushes once and ends.

**What it writes.** Commits on the branch, a reply on each thread, and one
report.

**When it stops.** After two rounds ([`rules.review-rounds`](../reference/settings/rules.md#rules)), whatever is still in dispute goes to you instead of through
another round. In the cloud a pull request also gets at most four answers.

**What it never does.** Resolve a thread it neither fixed nor disproved.
Dismiss a failing test as flaky without reproducing it. Merge.

## `lunamill-resolve-conflicts`

**What it does.** Merges your default branch into a pull request that
conflicts with it, runs the gate, and pushes the merge. It never rebases or
forces a push. A conflict in the lock file is settled by rebuilding it with
[`commands.relock`](../reference/settings/commands.md#commandsrelock), and one in a file
that a [`resolver` plugin](../customize/plugins.md#resolver) of yours rebuilds, by
that skill. When the two sides of a conflict contradict each other, it
pushes nothing, comments why, and opens a ticket, because which side wins
is your decision.

**When to use it.** Ask it for one pull request ("resolve the conflicts on
280"). `lunamill-address-review` calls it when the pull request it is
working conflicts. Runs in the cloud also use it, after each push to your
default branch and nightly: one run for each pull request that conflicts,
and none when there is not one.
