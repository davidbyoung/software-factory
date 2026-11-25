# Proposal

From [davidbyoung/software-factory#93](https://github.com/davidbyoung/software-factory/issues/93).

## Why

In a public repository with no activity for 60 days, GitHub switches off a workflow that has a schedule. `factory.yml` holds the factory's schedules and its pull request jobs, so the next pull request gets no "Review verdict", and nothing says why. `factory doctor` checks for it only where `builds.trigger` is `github-action`.

Decided by the owner on 2026-11-23: keep the two workflow files, and make it loud.

Decisions:

Settled with the owner on 2026-11-25, beside those above:

- **What the check tells you to do after you enable the file:** push a commit to the pull request. GitHub does not run what it missed, re-running the failed check starts neither the verdict nor the review, and closing and reopening posts a comment on the ticket that its pull request closed without merging.
- **A `factory.yml` a person disabled:** the check fails too, with a line that does not say GitHub did it.
- **A fork where GitHub has the file off since the fork was made:** the check passes inside the fork, and says so. `factory doctor` still fails there.
- **GitHub does not answer:** the check passes with a warning, and `factory doctor` prints a `?` line and fails nothing for it.
- **Where an organization's repository runs the poller:** `factory doctor` prints the line for `factory.yml` and the line for `factory-poller.yml`.

Build order: no open ticket has to be built before this one, and none waits on it.

## What Changes

- The "Factory files in step" check on a pull request fails when `factory.yml` is disabled, with one line that says GitHub switched it off and how to enable it: the Actions tab, or `gh workflow enable factory.yml`.
- `factory doctor` prints its `factory.yml is disabled` line for every repository, whatever `builds.trigger` is.
- There is no third workflow file for the schedules.

## Capabilities

### Modified Capabilities

- `workflow-files`
- `run-credential`
- `tool-setup`
