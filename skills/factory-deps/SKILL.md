---
name: factory-deps
description: Move every open Dependabot pull request one step closer to merged: resolve conflicts with the default branch, fix failing CI, do a major bump's migration, and open an issue for anything it cannot fix. Use when asked to look after, unstick, or fix Dependabot pull requests, and from the workflow that runs it.
---

# Shepherding Dependabot pull requests

A minor or patch bump already has auto-merge on, set by the factory's
job for Dependabot's pull requests, so it merges by itself once its checks are
green. The job here is to get it there. A major bump never has
auto-merge, and this skill never turns it on or merges anything: the
owner reads a major's migration before it lands. Dependabot does not
update the factory or a preset: the factory's own Updates job opens those
pull requests, and they are not this skill's.

Every command below goes through `factory deps`, `factory ticket`, or
`factory pr`. The default branch's name is what
`factory default-branch` prints, and the commands below
write it as DEFAULT.

## 0. The queue, and each one's state

First, check that the settings name a gate:

```bash
factory config get commands.gate
```

When it prints nothing, `commands.gate` is not set, and no fix here could
be checked: do nothing for any pull request, open no issue, and say so
once in the report.

The workflow starts one run in the cloud for each open pull request of
Dependabot's, and names it: that run works that one alone, through the steps
below, and ends in place of waiting for its checks ("A session in the cloud"
in `.claude/factory/rules.md`).

```bash
factory deps
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
  is a major. The npm group ("Bump the npm group") is minor and patch
  only.
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
`factory config get commands.relock` prints, so the bump
is reapplied on top of it, and commit the merge. Any other conflicted file
that matches the `files` of a resolver
(`factory plugins resolver`) is that resolver's, and a
conflict in `.claude/factory.lock` is resolved first, by `factory sync`, as
"Merge" in the `factory-resolve-conflicts` skill says.

Then go on: a branch with a conflict can be failing as well.

## 3. Failing checks

Check out the branch and reproduce the failure before changing anything:

```bash
git fetch origin HEAD_REF && git switch HEAD_REF
```

A session in the cloud is on the branch already.

Install what the branch's lock file lists, the way the repository's
`CLAUDE.md` says to install, which is `npm ci` for npm. Then
run the gate, `factory gate`, and the end-to-end suite
where the repository has one, as its `CLAUDE.md` says to run it, with what
it needs, such as a browser, installed first.

Read the failing job's log too, since a failure can be specific to CI:

```bash
factory pr failed N
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

Run the gate again (`factory gate`), then commit one coherent
change whose message describes the defect, and push to the same branch with
`factory pr push`.
No attribution trailer naming an AI assistant. Never push to the default
branch and never force push.

Wait for the checks of the new head, up to 20 minutes:

```bash
timeout 1200 factory pr wait-checks N
```

It waits until GitHub shows the pushed commit as the pull request's head,
then until every workflow run on it has finished. It prints `success` when
each passed or was skipped, or `failure:` with the name of each check that
failed, and exits 3. A `timeout` exit of 124 means the checks were still
running after 20 minutes: leave the bump for the next run.

If one still fails, try once more in the same run. A second failure is the
end for this run: comment what was tried and leave it for the next one.

## 4. A pull request that names the factory

Where `.github/dependabot.yml` watches `github-actions`, Dependabot may
open a pull request that raises the factory's version in
`.github/workflows/factory.yml` or `.github/workflows/factory-review.yml`.
`factory deps` says `leave (step 4)` for it. Do nothing to it: no step 2,
no step 3, and no comment. Raising the version there without the files
that version writes fails "Factory files in step", it never has
auto-merge, and the Updates job's own pull request, which holds both,
replaces it. Say in the report (step 7) that the owner can close it, and
that an `ignore` entry for `davidbyoung/software-factory` in
`.github/dependabot.yml` stops the next one.

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
EXISTING=$(factory ticket list --title "$TITLE" | cut -f1 | head -1)
if [ -n "$EXISTING" ]; then
  factory ticket comment "$EXISTING" --body-file issue.md
else
  factory ticket open --title "$TITLE" --body-file issue.md
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
factory pr comment N --body-file comment.md
```

Say what was done (updated, fixed and how, migrated), the state of its
checks, and what it now waits on: its own auto-merge, the owner's merge
of a major, or an issue. Pull requests left untouched get no comment.

Finish with one summary of every pull request in the queue and its state.
Use American English and the Oxford comma.
