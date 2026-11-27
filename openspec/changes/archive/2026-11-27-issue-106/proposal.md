# Proposal

From [davidbyoung/software-factory#106](https://github.com/davidbyoung/software-factory/issues/106). A small change: its acceptance criteria are in the ticket, and this folds in the one spec line it makes false.

## What and why

Changing a pull request's base branch leaves its Review verdict standing, though the diff it judged is no longer the one that would merge. `factory.yml` starts on `edited`, the event GitHub sends when the base changes, only with approval policies on, and neither the verdict, the review, nor the merge policy runs on it.

## Decisions

- **Where the hole is.** A review always judges the diff against the default branch, and Prepare hands over no pull request into another branch. So a pull request into another branch goes green only through `verdict-override`, which stays green once its base becomes the default branch. Without one, it is never reviewed and waits until its next push.
- **The merge policy runs again too,** so a `merge-automatic` label given for the files against one base does not stand for those against another.
- **A base change gets a push's status,** and the override comes off with no comment.
- **The review's own status on the commit is left alone:** it judged the diff against the default branch, which a base change does not change.
- **`edited` is written with the review, auto-merge, or approval policies on,** since each has a job that runs on a base change.
