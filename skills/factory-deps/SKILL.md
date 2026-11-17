---
name: factory-deps
description: Move every open Dependabot pull request one step closer to merged: resolve conflicts with the default branch, fix failing CI, do a major bump's migration, and open an issue for anything it cannot fix. Use when asked to look after, unstick, or fix Dependabot pull requests, and from the workflow that runs it.
---

# Shepherding Dependabot pull requests

A minor or patch bump already has auto-merge on, set by
`factory-deps-auto-merge.yml`, so it merges by itself once its checks are
green. The job here is to get it there. A major bump never has
auto-merge, and neither does a bump of the factory itself, and this skill
never turns it on or merges anything: the owner reads a major's migration,
and every update of the factory, before it lands.

Every command below goes through `factory deps`, `factory ticket`, or
`factory pr`. The default branch's name is what
`npx --no-install factory default-branch` prints, and the commands below
write it as DEFAULT.

## 0. The queue, and each one's state

A run started by the workflow ran `factory deps --any` first, which exits
0 when a Dependabot pull request is open, and starts a session only then.
Read the list again, since time has passed.

```bash
npx --no-install factory deps
```

It lists the open Dependabot pull requests, oldest first, and for each
one: whether it is a major, its head branch and commit, its mergeable
state, whether auto-merge is on, the newest run of each gate, how many
earlier shepherd comments it has, and the next step this skill takes. A
failed read exits nonzero with the error; it never reports an empty
queue it could not read.

Work each one through the steps below, oldest first. One that stops goes
in the report and the next one starts.

## 1. What the state means

- **Major or not:** the title's "from X to Y". A different leading number
  is a major. A grouped pull request ("Bump the npm group") is minor and
  patch only.
- **Checks still running, or whether it can merge is still `unknown`:** leave it for
  the next run.
- **Two earlier shepherd comments already report a fix that did not turn
  CI green:** stop on it. Open an issue (step 6) if none is linked yet.

## 2. Conflicts with the default branch

The ruleset does not require a branch to be up to date with the default
branch, so a
pull request that is only `behind` merges as it is; leave it. Updating it
would only start CI again.

A `dirty` state is a conflict, almost always in the lock file, and
blocks the merge. Check the branch out (step 3), merge `origin/DEFAULT`,
take the default branch's lock file, run `commands.relock`, the command
`npx --no-install factory config get commands.relock` prints, so the bump
is reapplied on top of it, and commit the merge. Any other conflicted file
that matches the `files` of a resolver
(`npx --no-install factory plugins resolver`) is that resolver's, as
"Merge" in the `factory-resolve-conflicts` skill says.

Then go on: a branch with a conflict can be failing as well.

## 3. Failing checks

Check out the branch and reproduce the failure before changing anything:

```bash
git fetch origin HEAD_REF && git switch HEAD_REF
```

Install what the branch's lock file lists, with `commands.relock`, the
command `npx --no-install factory config get commands.relock` prints. Then
run the gate, `npx --no-install factory gate`, and the end-to-end suite
where the repository has one, as its `CLAUDE.md` says to run it, with what
it needs, such as a browser, installed first.

Read the failing job's log too, since a failure can be specific to CI:

```bash
npx --no-install factory pr failed N
```

It prints what a failed check wrote about itself, and each failed job's
name and the end of its log.

Fix what the new version broke, in the code, tests or config that use it,
following `CLAUDE.md` and the area's rules it lists under "Rules by area".
The fix adapts
the project to the new version. It never:

- pins or downgrades the dependency back, or adds an override for it;
- skips, deletes or loosens a test, or lowers a coverage threshold;
- relaxes a lint rule or type setting to make an error go away;
- makes a CI step non-blocking, for example with `continue-on-error`.

If the only fix is one of those, or needs a decision about how the site
should look or behave, stop and open an issue (step 6).

Run the gate again (`npx --no-install factory gate`), then commit one coherent
change whose message describes the defect, and push to the same branch.
No attribution trailer naming an AI assistant. Never push to the default
branch and never force push.

Wait for the checks of the new head, up to 20 minutes:

```bash
timeout 1200 npx --no-install factory pr wait-checks N
```

It waits until GitHub shows the pushed commit as the pull request's head,
then until every workflow run on it has finished. It prints `success` when
each passed or was skipped, or `failure:` with the name of each check that
failed, and exits 3. A `timeout` exit of 124 means the checks were still
running after 20 minutes: leave the bump for the next run.

If one still fails, try once more in the same run. A second failure is the
end for this run: comment what was tried and leave it for the next one.

## 4. An update of the factory

A pull request that bumps `@davidbyoung/software-factory` gets steps 2 and
3, and the files the new version writes. After `npm ci` on its branch:

```bash
npx --no-install factory sync
```

Commit what it wrote as a second commit, "Sync the factory's files to
VERSION", and push. The push changes workflows, so it needs a token with
the `workflow` scope, such as the build token; a refused push is a stop
(step 6), with GitHub's error. Until then CI's `factory sync --check` fails, which is
the sign the commit is missing. Then comment on the pull request with the
files the sync changed and the release notes' steps to do by hand, first.
Never enable auto-merge, never approve and never merge: it waits for the
owner, whatever its size.

## 5. Majors

A major gets steps 2 and 3, plus the migration:

- Read the release notes and migration guide between the two versions,
  from the package's GitHub releases or its changelog in `node_modules`.
- Make every change the guide calls for, not only the ones CI caught.
- Update instruction files that name the version, such as the "Stack"
  section of `CLAUDE.md` and any file it imports. For a framework, read
  the new docs under `node_modules/` that those instructions point to and
  correct any rule they contradict.
- Never enable auto-merge, never approve and never merge.

Then comment on the pull request with what the migration changed, what
the guide called for that did not apply, and anything the owner should
check before merging.

## 6. Opening an issue

For anything stopped on, open one issue per pull request, written so it
can be started without this run, and link it from the pull request:

```bash
TITLE="Dependabot #N: what fails"
EXISTING=$(npx --no-install factory ticket list --title "$TITLE" | cut -f1 | head -1)
if [ -n "$EXISTING" ]; then
  npx --no-install factory ticket comment "$EXISTING" --body-file issue.md
else
  npx --no-install factory ticket open --title "$TITLE" --body-file issue.md
fi
```

One already open with that title gets a comment rather than a second
issue.

The body names the pull request, the failing check, the error, what was
tried, and why it stopped.

## 7. Report

Comment on every pull request this run changed, starting the body with
`<!-- factory-deps -->` so the next run can find it:

```bash
npx --no-install factory pr comment N --body-file comment.md
```

Say what was done (updated, fixed and how, migrated), the state of its
checks, and what it now waits on: its own auto-merge, the owner's merge
of a major, or an issue. Pull requests left untouched get no comment.

Finish with one summary of every pull request in the queue and its state.
Use American English and the Oxford comma.
