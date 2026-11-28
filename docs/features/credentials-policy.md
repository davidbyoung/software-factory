# The credentials policy

For anyone whose pull request waits on the `credentials` policy, or who
wants to know what it checks, and how to turn it off.

## What you get

### The factory's own policy

Every repository has the policy `credentials`, with nothing to write. A
change that adds a credential, or lets a workflow do more, is read for
security by an agent that didn't build it, before the change merges.
`factory sync` writes its two files, as it writes the factory's skills:
the script `.claude/approval-policies/credentials/find.mts`, and the
agent's instructions, `.claude/agents/factory-credentials-reader.md`.
`factory config explain` shows it among your settings:

```yaml
approval-policies:
  - name: credentials
    run: node .claude/approval-policies/credentials/find.mts
    agent: factory-credentials-reader
    files: ["**"]
```

## What it needs

Nothing to add: `find.mts` runs on Node 22.18 or later, which the factory
needs anyway, and the agent runs on your coding agent's token.

## Turn it on

Nothing to turn on: every repository has the credentials policy.

## How it works

### What it reads

`find.mts` reads the lines a pull request adds. It leaves out tests,
specs, and docs: any folder `test/`, `tests/`, `spec/`, `specs/`, or
`docs/`, at any depth, and any `*.test.*` or `*.spec.*` file. It picks
a pull request, for the agent to read, when it adds any of these:

| What the change adds                                                                                                                                     | Example                                                                            |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| A credential's name your default branch doesn't have, ending `_TOKEN`, `_SECRET`, `_PASSWORD`, `_KEY`, `_PAT`, `_AUTH`, `_CREDENTIAL`, or `_CREDENTIALS` | `CODECOV_TOKEN`, `STRIPE_KEY`                                                      |
| A secret passed to a workflow                                                                                                                            | `${{ secrets.DEPLOY_KEY }}`, `secrets['X']`, `toJSON(secrets)`, `secrets: inherit` |
| Write access for a workflow                                                                                                                              | `contents: write`, `permissions: { contents: write }`, `write-all`                 |
| A workflow file, new or moved into `.github/workflows/`                                                                                                  | `.github/workflows/deploy.yml`                                                     |
| A `pull_request_target` trigger                                                                                                                          | `on: pull_request_target`                                                          |

Most pull requests add none of these. Their **Approval policies** status
reads `Nothing to approve`, and the agent never runs. In two
repositories that use the factory, it picked 31 of 259 merged changes,
about 1 in 8. Each of the 31 changed at least 99 lines.

### What the agent does

`factory-credentials-reader` is handed only the lines `find.mts` picked.
It can read the rest of your code, as it stands on your default branch,
to follow them through. It traces each
credential and permission to everything that can reach it, counting
another AI agent as someone an attacker may be steering. It reports a
finding only when it is serious: a credential that keeps working after
the run ends, or works beyond this repository, within reach of someone
who shouldn't have it, or a person's approval that can now be skipped.
It runs with Opus, which its file names.

When it finds nothing, the status says the agent cleared it, not a
person. That pull request still waits for a person to merge it, never
for [`auto-merge`](../reference/settings/auto-merge.md#auto-merge), and **Details** lists what `find.mts` found, which the
agent cleared.

### What it costs

A session spends nothing on it. On the cloud runner, each push to a pull
request marked ready runs three jobs: one reads the change, one runs
`find.mts`, and one posts the status. A push to a draft runs only the
first, which posts that the policies check once it is marked ready. In a
private repository, the cloud runner may bill each job:
[GitHub Actions](../integrations/github-actions.md#limits-that-come-from-github)
says how. When `find.mts` picks something, the agent takes about a
minute, on your coding agent's token.

### What it won't catch

- **A credential your code builds from settings,** whose name appears
  only in docs and tests, which `find.mts` doesn't read.
- **A sensitive line written a way `find.mts` doesn't recognize.**
- **A change whose own text talks the agent out of a finding.** It then
  shows as cleared: the pull request still waits for a person to merge
  it, and **Details** lists what the agent read, so look at it before
  you merge.

## Its settings

It is on with nothing to write. To turn it off, set `off: true` on it
under [`approval-policies`](../reference/settings/approval-policies.md#approval-policies).

### Turning it off

In `.claude/factory.yaml`:

```yaml
approval-policies:
  - name: credentials
    off: true
```

Then run `factory sync`. It deletes the policy's two files, and, where
`credentials` was your only policy, takes the job that runs policies out
of `.github/workflows/factory.yml`. Commit what it changed with the
settings, from your computer, open a pull request, and merge it.

Where no policy is left on, also take **Approval policies** out of the
ruleset "Software factory", under your repository's Settings, Rules,
Rulesets: nothing posts the status any more, so a pull request would
wait on it forever.

Nothing then reads a change for security before it merges. **It worked
when** `factory config explain` no longer lists `credentials`, and the
next pull request merges without an **Approval policies** status.

## When something goes wrong

### When `credentials` makes a pull request wait

The **Approval policies** status, in the pull request's checks list,
reads
`credentials: 1 waiting for approval. To accept it, add the policy-override label`.

1. **Open the status's Details,** which lists each finding with its
   file and line, such as:

   > `.github/workflows/deploy.yml:12` The deploy key is in the same job
   > as the AI that reads the ticket. An AI steered by a ticket's text
   > could read the key and send it out, and it has no end date.

2. **Decide.**
   - **It is real:** push a fix, yourself or by commenting for a session
     that works this pull request. The push is read again, and a label
     added for an earlier commit approves nothing on it.
   - **It is fine as it is:** add the `policy-override` label, under
     **Labels** on the pull request. Anyone who can write to the
     repository may, you included. It approves what the agent found on
     this commit, as [When a pull request waits](approval-policies.md#when-a-pull-request-waits)
     says.

**It worked when** the status reads `Approved by` with your name, or,
after a fix,
`Nothing to approve` or `cleared by factory-credentials-reader, not a person`.

**When the status says the agent can't run,** as
`credentials: factory-credentials-reader can't run here, so everything it applies to waits for approval`,
no agent read the lines. That happens on a pull request from a fork, on
one from a dependency bot whose runs get no secrets, or where your
repository has no coding agent's token
([Checking with an agent](approval-policies.md#checking-with-an-agent)).
[GitHub](../integrations/github.md#limits-that-come-from-github) says
which bot's runs get none. Read the lines **Details** lists yourself, then
add `policy-override`. A fork's or such a bot's pull request is always
read by you this way. Where the
token is missing, run `factory init`, which sets it, and `factory doctor`
says whether it is set.

## On your tools

- [GitHub Actions](../integrations/github-actions.md)
- [Claude Code](../integrations/claude-code.md)
