# Proposal

From [davidbyoung/software-factory#74](https://github.com/davidbyoung/software-factory/issues/74).

## Why

A run in the cloud held a token that outlived the session using it, in the same job as the AI, so text a session read could have led it to give the token away. The first change for this ticket, in `openspec/changes/archive/2026-11-23-issue-74/`, set an organization up with such runs. This one replaces how they run.

- **The AI and the GitHub key are never in the same job** (the owner, 2026-11-24, replacing the two decisions on who a review and a build post as): every cloud run is Prepare, Session, and Publish, as "A run in the cloud" says. The verdict comes from the review's own run, never from a comment. Research, live tests, and the options compared are in the pull request.
- **The same design for a person's own account** (the owner), with unsigned build commits.
- **A ticket that changes a workflow file is built on a computer** (the owner): a build that could push one could read the repository's secrets.
- **Every kind of run is in this ticket** (the owner): build, review, answer, conflict, and dependency.
- **Each round is its own run and remembers nothing:** a resumed conversation would be a file anyone signed in can download from a public repository.
- **Everyone's builds use one credential, an owner's choice:** a subscription by default, or an API key, which the coding agent's documentation advises for a secret shared across repositories.
- **In a public repository, builds are off when the tickets are kept somewhere private:** what Prepare hands over can be downloaded there.
- **Costs accepted** (the owner): no Docker in a build, a host list, slower rounds, and hooks off in the cloud, where the gate, CI, and Publish's checks take their place.

## What Changes

- Every run that uses AI is three jobs, Prepare, Session, and Publish, and the session's holds no GitHub sign-in.
- A session's `factory` commands read what Prepare handed over, and its writes are asked for, checked, and done by Publish.
- The review is a job of `run.yml`, its verdict is the session's structured answer, and no comment changes it.
- `builds.hosts` lists the hosts a session may reach.
- `factory review tools`, `factory review tickets`, and `factory review cost` go, and so does the variable for the App's slug.

## Capabilities

### New Capabilities

- `cloud-run`
- `handed-over`
- `prepare`
- `publish`
- `rounds`
- `review-verdict`

### Modified Capabilities

- `run-credential`
- `ticket-keys`
- `settings-lock`
- `npm-registry-secrets`
- `ticket-credentials`
- `org-setup`
- `settings`
- `tool-setup`
- `workflow-files`
- `docs`
