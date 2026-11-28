# Troubleshooting

For anyone whose factory did something they did not expect. Start with
`factory doctor`, run in your repository's checkout. If its output does not settle it, find what you saw
among the headings below: each says what to do, or which page owns the
fix.

## Reading `factory doctor`

```bash
factory doctor
```

It prints its checks under headings: `Settings and files`, then each
tool's name, then the parts you left off. Each check starts with a mark:
✓ works, ✗ needs fixing, ? worth a look, and - off on purpose. A line
with ✗ or ? says what to do on the line itself. `doctor` exits 1 when a
check fails, and changes nothing
([Commands](../reference/cli.md#setting-up)).

In the steps below, 12 stands for your ticket's number and 15 for its pull
request's. A `/factory-...` command is typed in a
[session](../reference/glossary.md#the-words) of your coding agent.

## A test or a check fails during a build

Nothing to do. The session sees the output, fixes the cause, and tries
again.

## The session stops and says it needs you

It says why, in the session and on the ticket. Answer, then run
`/factory-build 12` again.

## The build stops on `commands.gate is not set`

Your settings do not say how to check a change. Add your test and lint
commands ([Your commands](../customize/commands.md)), then run
`/factory-build 12` again.

## The session was closed or crashed partway

Run `/factory-build 12` in a new session. It picks up the branch it made.

## You want to change what was decided

Run `/factory-refine 12` again, or edit the ticket.

## CI fails on the pull request

Run `/factory-address-review 15`. It reads the failure and fixes it.

## The session does not know the factory's skills

The setup is not merged, or the session started before it was. Merge
the setup's pull request, bring your default branch up to date, and start
a new session ([Quick start](../get-started/quick-start.md#3-merge-the-setup)).

## `factory init` stops on the organization's secrets

The organization is set up, but its secrets do not reach your repository,
or its plan keeps them from a private one.
[GitHub organizations](../integrations/github-organizations.md#when-the-organizations-secrets-do-not-reach-you)
says what to ask an owner for.

## A review or a build in the cloud stops at once

The coding agent's token is usually the cause: it lasts a year.
[Claude Code](../integrations/claude-code.md#when-the-claude-tokens-year-is-up)
says how to tell, and how to replace it.

## `factory status` says a token stops working soon

On your own account, the code host's access token expires on the day
you chose when you made it
([GitHub](../integrations/github.md#when-the-github-access-token-expires)).
The coding agent's token lasts a year
([Claude Code](../integrations/claude-code.md#when-the-claude-tokens-year-is-up)).

## Moving a ticket to Ready starts nothing

Where [`builds.trigger`](../reference/settings/builds.md#builds) is `manual`, nothing starts a build from the
board: tell a session to build it, or run `factory build 12`. Otherwise
the poller is not running:
[When the schedule fails](../features/builds-from-the-board.md#when-the-schedule-fails),
or, for a poller you host,
[When something fails](../features/hosting-the-poller.md#when-something-fails).

## A pull request waits on "Approval policies"

A policy found something only a person may approve.
[When a pull request waits](../features/approval-policies.md#when-a-pull-request-waits)
says how to read it and decide.

## An update's pull request fails

[Updating](updating.md#when-something-goes-wrong) says what to do.

## Anything else

Run `factory doctor`, as above. It says what is wrong, and what to do
about it.
