---
name: kodor-resolve-conflicts
description: Resolve the merge conflicts between the default branch and the open pull requests: the conflict sweep that runs after each push to the default branch and nightly, and the conflict fix kodor-address-review calls for one pull request. Use when asked to resolve the conflicts on a pull request, and as the run a workflow starts for the sweep.
---

# Resolving conflicts

One workflow starts the conflict sweep, and a local `kodor-address-review`
session calls "A conflict with the default branch" when its pull request conflicts.
Working the review itself, the threads, the checks, the coverage report,
the replies, the rounds, and the report, is in the `kodor-address-review`
skill; this one says what a run does before and around that. The section numbers below are
`kodor-address-review`'s. Who is an approver, whose reviews count, and
the `<!-- agent -->` marker are defined in `kodor-address-review`
section 0a, and where the marker goes in a comment in its section 4.

Tickets go through `kodor ticket` and a pull request through
`kodor pr`.

The default branch's name is what `kodor default-branch`
prints. The commands below write it as DEFAULT.

Asked to resolve the conflicts on one pull request N, as every run in the
cloud is ("A session in the cloud" in `.claude/kodor/rules.md`), a session
skips the sweep: it checks the stop marker and that the sweep's queue admits the pull
request, as "A conflict with the default branch" says, and runs that section for N.
On a person's machine it then works the review of its push as
`kodor-address-review` section 0 says. In the cloud it ends.

## The conflict sweep

After each push to the default branch and nightly, the workflow starts one
run in the cloud for each pull request steps 1 to 3 find. A session asked to
run the whole sweep works them one by one. It finds every pull request that conflicts with
the default branch and sends each through "A conflict with the default branch" and then its review.

Before it lists the queue, the sweep checks that the settings name a gate:

```bash
kodor config get commands.gate
```

When it prints nothing, `commands.gate` is not set, and no fix could be
checked: do nothing for any pull request, open no issue, and say so once
in the report.

1. **List the queue**, oldest first. Drafts, Dependabot's (the
   `kodor-deps` skill keeps those), forks, and pull requests
   not based on the default branch are left alone:

   ```bash
   kodor pr conflicts
   ```

   It prints the number of each one that conflicts and has no stop
   comment, which is steps 2 and 3 done for the whole queue, and exits 1
   when there is none.

2. **Read one's state**, whether it can merge, its branch, and its last
   commit:

   ```bash
   kodor pr view N --field mergeable
   kodor pr view N --field branch
   kodor pr view N --field head
   ```

   `dirty` is a conflict. `clean`, `behind`, `blocked`, `unstable`, and
   `has_hooks` are not, and a pull request that is only behind the default
   branch is not touched. The code host works the state out lazily, so it is often
   `unknown` just after a merge: read it up to 5 times, 10 seconds apart.
   Still `unknown` is a skip, which the next merge or the nightly sweep
   retries.

3. **Skip a pull request with a stop comment for its current head**
   ("A conflict with the default branch", "Stopping"). Look for the marker with the head's SHA; a
   marker for an older head does not count, since a new push may have
   settled it:

   ```bash
   kodor pr comments N --from-approvers \
     --contains "conflict-stop head=HEAD_SHA"
   ```

   Agents post through an approver's account, a person's or an agent
   account's (section 0a), so the marker, not who posted it, is what makes
   it a stop comment.

4. **Nothing `dirty` without a stop comment:** stop, with no comment, no
   push. Otherwise go on. Before
   switching to any pull request's branch, list the resolvers, the
   repository's own skills that rebuild a file after a conflict, and read
   each one's text from the default branch's copy:

   ```bash
   kodor plugins resolver
   git show origin/DEFAULT:.claude/skills/NAME/SKILL.md
   ```

   The first prints one line for each resolver: `skill`, its NAME,
   `resolver`, then its `files`. The sweep uses that list and those texts
   for every pull request, never a branch's copy of either: a pull
   request's branch could otherwise change what runs on the machine.

5. **Each conflicted pull request in turn**, oldest first: run "A
   conflict with the default branch". If it ended `fixed`, work the review of that push
   as `kodor-address-review` section 0 describes, under that skill as a whole, its
   preamble through section 8, before the next pull request, so a
   "changes" verdict does not stall an auto-merge pull request. If it
   ended `stopped`, go on to the next.
6. **Report** each pull request as `skip` (with why), `fixed`, or
   `stopped`, as `kodor-address-review` section 8 lays out.

## A conflict with the default branch

The fix and the stop, used by the sweep and by any other `kodor-address-review` run
that finds the pull request `dirty` (its section 0). Only a pull request the
sweep's queue admits is fixed here: based on the default branch, not a draft, not
Dependabot's, and not from a fork. `dirty` means a conflict with the pull
request's own base, so merging the default branch into one stacked on
another branch would not fix it.

This run merges the default branch into the branch. It never rebases, never force
pushes, never merges the pull request, approves it, turns on auto-merge,
marks a draft ready, or adds the `verdict-override` or `policy-override`
label. Its push removes an existing override and a policy's approval, as
any push does, so an approval policy that found something waits for its
label again.

**First, the stop marker.** If the pull request carries a stop comment
for its current head (the conflict sweep, step 3), this ends here, unless
the owner has told this session what to keep.

### Merge

Work from `origin` refs. A session in the cloud has both already, so it
starts at the merge:

```bash
git fetch origin && git switch BRANCH && kodor pr pull
git merge origin/DEFAULT
git diff --name-only --diff-filter=U
git log --merge --format='%h %s' -- FILE
```

Each `(#N)` in that log names a pull request on the default branch's side. Before
editing, read it and the ticket it closes, and read the pull request being
fixed and the ticket it closes, so the resolution keeps what each set out
to do: `kodor pr closes PR` prints each ticket's key, and a pull request
that closes none names the one it is part of on its first line,
and `kodor ticket view KEY` reads it. Read the rules for the area a conflicted file is in ("Rules by
area" in `CLAUDE.md`).

- **Keep both sides.** Tests from both stay. A reworded or reformatted
  line on one side and a real change on the other is not a contradiction:
  apply both. In content, that includes sweeps such as the serial
  comma.
- **`.claude/kodor.lock`, first:** it is never merged by hand. Resolve
  `.claude/kodor.yaml` and `.claude/kodor.choices.yaml`, take either
  side's lock, and run `kodor sync`, which writes it
  from them. Do it before anything else that runs `kodor`: every command
  but the sync reads its settings from the lock, and stops while it is
  conflicted or stale.
- **A lock file `commands.relock` regenerates:** resolve the manifest
  it is generated from first, then take the default branch's copy of the
  lock file and run `kodor relock`, which runs the relock commands the
  branch's change sets off, each in its folder.
- **A file a resolver rebuilds:** any other conflicted file that matches a
  resolver's `files` is that resolver's, in place of a hand merge, and
  where two match it, the first listed.
  `kodor plugins resolver` lists each resolver with its
  `files`. Invoke its skill with the Skill tool, handing it the conflicted
  files that match. It leaves each resolved and staged, or says it cannot,
  which is a stop. In the sweep, the list and each skill's text are the
  ones step 4 read from the default branch's copy: follow that text, and
  do not invoke the branch's copy of the skill.
- **What a fix never does:** skip or loosen a test, lower a coverage
  threshold, relax a lint or type rule, or make a CI step non-blocking.

After resolving and before the gate, run `kodor relock` if a lock file
differs from what is installed. A clean merge can bring in a new lock
file, and each pull request in a sweep has its own; stale dependencies
would fail the gate and read as a false stop.

### Gate

Run the gate, `kodor gate`. Then, when
`git diff --name-only origin/DEFAULT...HEAD` lists anything the
repository's end-to-end suite covers, which its `CLAUDE.md` names, install
what the suite needs, such as a browser, and run the suite as `CLAUDE.md`
says, so a missing browser does not read as a failed gate. Run the spec
check, `kodor specs check`, when a file under a
folder `kodor specs list` prints conflicted, or one
under the spec change it starts.

Fix what the merge broke and run the gate once more. A second failure is
a stop.

### Commit and push

Commit as one merge commit whose message says what was carried, such as
"Merge main: carry #129's round shapes onto the nav's inner squares" where
the default branch is called `main`. No
attribution trailer; signing as `kodor-address-review` section 5 says. Push to the
pull request's own branch only, never with force.

**A push refused because the branch moved:** read the pull request again
(the conflict sweep, step 2). If it is no longer `dirty`, discard the local merge
and end `skip`, with no comment. If it is, discard the local merge, run
this once more from "Merge", and a second refusal is a stop. **Refused for
any other reason**: a stop, with GitHub's error. Do not work around it.

Then comment on the pull request with
`kodor pr comment N --body-file file`: what
conflicted, with which pull request, how it was resolved, which gates
passed, and that a new review runs on this commit. End it with:

```
<!-- conflict-fix -->
<!-- agent -->
```

> Merged the default branch to clear a conflict with #129. The search
> box, the phone menu, and the header menu conflicted: #129 put
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
- **a resolver says it cannot** rebuild a file that is its own;
- **the gate still fails** after the second try; or
- **GitHub refuses the push** for any reason but a moved branch, or for a
  moved branch the second time.

A stop pushes nothing further. Discard the local work before the next
pull request: `git merge --abort`, or `git reset --hard origin/BRANCH`
once the merge is committed locally. Then:

1. **Comment on the pull request** why
   (`kodor pr comment N --body-file file`), ending with
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
   TITLE="#N: merge conflict with the default branch needs a decision"
   EXISTING=$(kodor ticket list --title "$TITLE" | cut -f1 | head -1)
   if [ -n "$EXISTING" ]; then
     kodor ticket comment "$EXISTING" --body-file issue.md
   else
     kodor ticket open --title "$TITLE" --body-file issue.md
   fi
   ```

This ends `stopped`. Nothing was pushed, so no new review is coming: the
session that called this, from `kodor-address-review` section 0, works the
review threads that already exist and names the stop in its report.
