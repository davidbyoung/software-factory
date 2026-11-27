# Proposal

From [davidbyoung/software-factory#105](https://github.com/davidbyoung/software-factory/issues/105). A small change: its acceptance criteria are in the ticket, and this folds in the one spec line it makes false.

## What and why

`verdict-override` is meant to pass Review verdict for the one commit the approver read. If the label is added just as a push lands, it can pass the newer commit, which nobody read.

The "Record the verdict" job has no concurrency group, and it reads the pull request as it is when the job runs, not as it was when the label was added. So a labeled run that starts after the push sees the new head, still carrying the label, and posts success on it. The push's own run removes the label only after posting its own status, and since statuses are last-writer-wins, the newer commit can end up green.

## Decisions

- **The labeled run approves the commit in its own event,** as `policy-override` does, and posts on it only while it is still the pull request's head. Otherwise it posts nothing, takes the label off, and says why.
- **Every other run counts the override only for the commit it was given on:** a reopen, a pull request marked ready, a review ending, and a Merge order run. An author can close and reopen their pull request, or mark it a draft and then ready, right after a push. The labeled run's announcement comment, by the workflow's own account, records the full commit in a hidden marker, and the newest such record decides.
- **No concurrency group on the verdict job.** GitHub keeps one pending run per group and cancels the older, which could drop a push's own run.
- **A review that ends on a head the override does not cover posts what it found.**
- **The base branch is #106's.**
