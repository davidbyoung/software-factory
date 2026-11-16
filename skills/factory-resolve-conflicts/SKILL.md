---
name: factory-resolve-conflicts
description: Resolve the merge conflicts between main and the open pull requests: the conflict sweep that runs after each push to the default branch and nightly, and the conflict fix factory-address-review calls for one pull request. Use when asked to resolve the conflicts on a pull request, and as the run a workflow starts for the sweep.
---

# Resolving conflicts

One workflow starts the conflict sweep, and a local `factory-address-review`
session calls "A conflict with main" when its pull request conflicts.
Working the review itself, the threads, the checks, the coverage report,
the replies, the rounds, and the report, is in the `factory-address-review`
skill, as is the run a review of the owner's starts; this one says what a
run does before and around that. The section numbers below are
`factory-address-review`'s. The owner's login, which reviews count, and
the `<!-- agent -->` marker are defined in `factory-address-review`
section 0a, and where the marker goes in a comment in its section 4.

Tickets go through `factory ticket` and a pull request through
`factory pr`. The workflow has set the run up: the dependencies are installed and the
`build-setup` commands have run, so a run does no setup of its own.

Asked to resolve the conflicts on one pull request N, a session skips the
sweep: it checks the stop marker and that the sweep's queue admits the pull
request, as "A conflict with main" says, runs that section for N, and then
works the review of its push as `factory-address-review` section 0 says.

## The conflict sweep

Run as "the conflict sweep", by the workflow that starts after each push
to the default branch and nightly. It ran `factory pr conflicts` first,
which is steps 1 to 3 below, and starts a session only when it exits 0.
Read what it read again, since time has passed. It finds every pull request that conflicts with
main and sends each through "A conflict with main" and then its review.

1. **List the queue**, oldest first. Drafts, Dependabot's (the
   `factory-deps` skill keeps those), forks, and pull requests
   not based on main are left alone:

   ```bash
   npx --no-install factory pr conflicts
   ```

   It prints the number of each one that conflicts and has no stop
   comment, which is steps 2 and 3 done for the whole queue, and exits 1
   when there is none.

2. **Read one's state**, whether it can merge, its branch, and its last
   commit:

   ```bash
   npx --no-install factory pr view N --field mergeable
   npx --no-install factory pr view N --field branch
   npx --no-install factory pr view N --field head
   ```

   `dirty` is a conflict. `clean`, `behind`, `blocked`, `unstable`, and
   `has_hooks` are not, and a pull request that is only behind main is
   not touched. The code host works the state out lazily, so it is often
   `unknown` just after a merge: read it up to 5 times, 10 seconds apart.
   Still `unknown` is a skip, which the next merge or the nightly sweep
   retries.

3. **Skip a pull request with a stop comment for its current head**
   ("A conflict with main", "Stopping"). Look for the marker with the head's SHA; a
   marker for an older head does not count, since a new push may have
   settled it:

   ```bash
   OWNER_LOGIN=$(npx --no-install factory config get repository | cut -d/ -f1)
   npx --no-install factory pr comments N --author "$OWNER_LOGIN" \
     --contains "conflict-stop head=HEAD_SHA"
   ```

   Agents post through the owner's account (section 0a), so the marker,
   not the author, is what makes it a stop comment.

4. **Nothing `dirty` without a stop comment:** stop, with no comment, no
   push. Otherwise go on: the workflow has already run the setup.
5. **Each conflicted pull request in turn**, oldest first: run "A
   conflict with main". If it ended `fixed`, work the review of that push
   as `factory-address-review` section 0 describes, under that skill as a whole, its
   preamble through section 8, and step 6 of the owner's-review run in
   `factory-address-review`, before the next pull request, so a
   "changes" verdict does not stall an auto-merge pull request. If it
   ended `stopped`, go on to the next.
6. **Report** each pull request as `skip` (with why), `fixed`, or
   `stopped`, as `factory-address-review` section 8 lays out.

## A conflict with main

The fix and the stop, used by the sweep and by any other `factory-address-review` run
that finds the pull request `dirty` (its section 0). Only a pull request the
sweep's queue admits is fixed here: based on main, not a draft, not
Dependabot's, and not from a fork. `dirty` means a conflict with the pull
request's own base, so merging main into one stacked on another branch
would not fix it.

This run merges main into the branch. It never rebases, never force
pushes, never merges the pull request, approves it, turns on auto-merge,
marks a draft ready, or adds the `verdict: override` label. Its push
removes an existing override, as any push does.

**First, the stop marker.** If the pull request carries a stop comment
for its current head (the conflict sweep, step 3), this ends here, unless
the owner has told this session what to keep.

### Merge

Work from `origin` refs, since a run may start on another commit:

```bash
git fetch origin && git switch BRANCH && git pull --no-rebase origin BRANCH
git merge origin/main
git diff --name-only --diff-filter=U
git log --merge --format='%h %s' -- FILE
```

Each `(#N)` in that log names a pull request on main's side. Before
editing, read it and the issue it closes, and read the pull request being
fixed and the issue it closes, so the resolution keeps what each set out
to do. Read the rules for the area a conflicted file is in ("Rules by
area" in `CLAUDE.md`).

- **Keep both sides.** Tests from both stay. A reworded or reformatted
  line on one side and a real change on the other is not a contradiction:
  apply both. In content, that includes sweeps such as the serial
  comma.
- **`package-lock.json`:** resolve `package.json` first, then take main's
  lock file and run `npm install`, as the `factory-deps` skill
  does.
- **What a fix never does:** skip or loosen a test, lower a coverage
  threshold, relax a lint or type rule, or make a CI step non-blocking.

After resolving and before the gate, run `npm ci` if `package-lock.json`
differs from what is installed. A clean merge can bring in a new lock
file, and each pull request in a sweep has its own; stale modules would
fail the gate and read as a false stop.

### Gate

Run the gate ("After every code change" in `CLAUDE.md`). Then, when
`git diff --name-only origin/main...HEAD` lists anything the end-to-end
suite covers, which that section names, install its browser and run the
suite, so a missing browser does not read as a failed gate. Run the spec
check when a file under `openspec/` conflicted.

Fix what the merge broke and run the gate once more. A second failure is
a stop.

### Commit and push

Commit as one merge commit whose message says what was carried, such as
"Merge main: carry #129's round shapes onto the nav's inner squares". No
attribution trailer; signing as `factory-address-review` section 5 says. Push to the
pull request's own branch only, never with force.

**A push refused because the branch moved:** read the pull request again
(the conflict sweep, step 2). If it is no longer `dirty`, discard the local merge
and end `skip`, with no comment. If it is, discard the local merge, run
this once more from "Merge", and a second refusal is a stop. **Refused for
any other reason**, such as a merge that brings in `.github/workflows`
changes the credential may not push: a stop, with GitHub's error. Do not
work around it.

Then comment on the pull request with
`npx --no-install factory pr comment N --body-file file`: what
conflicted, with which pull request, how it was resolved, which gates
passed, and that a new review runs on this commit. End it with:

```
<!-- conflict-fix -->
<!-- agent -->
```

> Merged main to clear a conflict with #129. `Search.tsx`,
> `MobileMenu.tsx`, and `HeaderMenu.tsx` conflicted: #129 put
> round shapes on the buttons, and this pull request draws them on inner
> squares inside larger targets. I kept both by moving the shapes to the
> inner squares. The gate and end-to-end tests pass. A new review runs on
> this commit.

This ends `fixed`.

### Stopping

Stop when:

- **the two sides contradict:** keeping one undoes what the other set out
  to do, and neither the pull requests nor their issues settle which
  wins;
- **two sides state different facts:** a fact in the repository's content
  says one thing on each side;
- **the gate still fails** after the second try; or
- **GitHub refuses the push** for any reason but a moved branch, or for a
  moved branch the second time.

A stop pushes nothing further. Discard the local work before the next
pull request: `git merge --abort`, or `git reset --hard origin/BRANCH`
once the merge is committed locally. Then:

1. **Comment on the pull request** why
   (`npx --no-install factory pr comment N --body-file file`), ending with
   the marker for its current head:

   ```
   <!-- conflict-stop head=HEAD_SHA -->
   <!-- agent -->
   ```

   > This pull request conflicts with #140 in `docs/limits.md`, and I
   > did not resolve it. The two sides give different numbers for the same
   > requirement, and choosing one is your call. Nothing was pushed. I
   > won't try again until this branch changes.

2. **Open an issue**, one per stop, with no labels. It starts no build,
   since only the owner moving its card to Ready does. Its body names the pull request, the other pull request, the
   files, why it stopped, and that fixing the branch or telling a session
   what to keep ends it. If an open issue with that exact title exists,
   comment on it instead. Never close one; the owner does.

   ```bash
   TITLE="#N: merge conflict with main needs a decision"
   EXISTING=$(npx --no-install factory ticket list --title "$TITLE" | cut -f1 | head -1)
   if [ -n "$EXISTING" ]; then
     npx --no-install factory ticket comment "$EXISTING" --body-file issue.md
   else
     npx --no-install factory ticket open --title "$TITLE" --body-file issue.md
   fi
   ```

This ends `stopped`. No new review is coming: GitHub runs no `pull_request`
workflows on a commit that conflicts, so the run that called this, from
`factory-address-review` section 0 or from step 4 of the owner's-review run in `factory-address-review`, works the
review threads that already exist, without waiting for a new review, and
names the stop in its report.
