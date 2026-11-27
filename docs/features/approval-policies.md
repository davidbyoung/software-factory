# Approval policies

This page is for anyone who wants some changes to wait for a person's
yes, such as a dependency under a license you have not allowed, or a
migration with no way back. By the end you will have an
[approval policy](../reference/settings/approval-policies.md#approval-policies) that checks every
pull request, makes one wait when it finds something, and lets you
approve it with a label.

A session, the coding agent the factory runs, can fix what a check
finds, but it can never be the one to say "yes, anyway". An approval
policy is for when that yes is sometimes right.

Every repository already has one, which the factory ships, called
`credentials`. [The factory's own policy](credentials-policy.md#the-factorys-own-policy) says
what it does. **If a pull request of yours waits on it,** start at
[When `credentials` makes a pull request wait](credentials-policy.md#when-credentials-makes-a-pull-request-wait),
and to stop it, see [Turning it off](credentials-policy.md#turning-it-off).

## Is it an approval policy?

Ask whether a person could reasonably say "yes, anyway" to what the check
finds. If never, it is a command in the gate, which every change must
pass. If the session may decide, it is a plugin, an agent of yours whose
advice the session weighs. If only a person may, it is an approval
policy.

| What you want                                                                    | What to use                                                                      | What happens when it finds something                                             |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| A check with no exceptions, such as formatting, or tests that pass               | A command in [`commands.gate`](../reference/settings/commands.md#commandsgate)   | It fails, and the session fixes the change until it passes                       |
| Advice the session weighs, such as an accessibility reviewer                     | A [plugin](../customize/plugins.md)                                              | The session reads what it says, and decides                                      |
| Certain people to review every change to certain files                           | A `CODEOWNERS` file, with "Require review from Code Owners" in your branch rules | GitHub waits for one of them. The factory isn't involved                         |
| Changes to some files never merging by themselves                                | [`auto-merge.deny`](../reference/settings/auto-merge.md#auto-merge)              | The pull request waits for you                                                   |
| A person's yes on something a check finds inside a change, such as a new license | An approval policy                                                               | The pull request waits until someone who can write to the repository approves it |

## Add your first policy

This example makes a pull request wait when it adds a dependency whose
license you have not allowed. Do it on your computer, since step 4
changes a workflow file, which a build in the cloud can't commit.

**1. Write the check.** A check is a command that reads the change as
JSON on its standard input and prints what it found, in the shape
[What a check reads and prints](#what-a-check-reads-and-prints) gives.
Make the folder `.claude/approval-policies/licenses/`, and save this in
it as `check.mjs`. It runs with Node, which the factory's jobs have:

```js
import { readFileSync } from "node:fs";

const change = JSON.parse(readFileSync(0, "utf8"));
const allowed = JSON.parse(
  readFileSync(".claude/approval-policies/licenses/allowed.json", "utf8"),
);

const findings = [];
for (const line of change.diff.split("\n")) {
  const license = /^\+\s*"license": "([^"]+)"/.exec(line)?.[1];
  if (license && !allowed.includes(license))
    findings.push({
      file: "package-lock.json",
      title: `A dependency is ${license}, which is not allowed`,
      why: `We allow ${allowed.join(", ")}.`,
    });
}
console.log(JSON.stringify({ findings }));
```

It looks for lines the change adds to `package-lock.json` that name a
license, which npm writes for each package. Another package manager
needs a check of its own. Save the licenses you allow beside it, as
`allowed.json`:

```json
["MIT", "Apache-2.0", "BSD-3-Clause", "ISC"]
```

**2. Add the policy** to `.claude/factory.yaml`:

```yaml
approval-policies:
  - name: licenses # what the pull request's status calls it
    run: node .claude/approval-policies/licenses/check.mjs # the check, from the root
    files: [package-lock.json] # the changed files that set it off
```

Then check the file:

```console
$ factory config check
✓ The settings are valid.
```

**3. Try it.** `factory approval-policies check` runs your policies
against what your branch changes since your default branch on `origin`,
and reads them from your working folder, so nothing needs committing
yet. On a branch where you have added a dependency, take its license out
of `allowed.json` for a moment, and run it:

```console
$ factory approval-policies check
approval-policies: 1 applies, for the 2 files changed since origin/main
? licenses: 1 waiting for approval
  package-lock.json  A dependency is MIT, which is not allowed
```

`?` marks what waits for a person. Put the license back, and it prints
`✓ licenses: nothing to approve`. [Trying a policy](#trying-a-policy) has
what it prints when a check fails, and how to try a past pull request.

**4. Turn it on.** If you turned `credentials` off, so this is your
only policy, sync first. It adds the job that runs your policies to the
factory's workflow file:

```console
$ factory sync
wrote .claude/factory.lock
wrote .github/workflows/factory.yml
```

Otherwise there is nothing to sync: the workflow already runs your
policies, since it runs [the factory's own](credentials-policy.md#the-factorys-own-policy).

Commit the policy, its folder, and anything sync wrote, open a pull
request, and merge it. A pull request is checked by the policies on your
default branch, so this one isn't checked by yours. It worked when the
next pull request that changes `package-lock.json` shows `licenses` in
its **Approval policies** status.

**5. Check it is required,** so that nothing merges while a policy
waits. The factory requires the **Approval policies** status on your
default branch, where its token can, once any policy is on there. Pull
your default branch and check that it did:

```console
$ factory doctor
...
✓ "Approval policies" is required before a merge to main
```

If it prints `? "Approval policies" is not required before a merge to
main`, the factory's token couldn't change your branch rules, and an
admin of the repository runs `factory init`, which requires it. GitHub
Free can't require a status on a private repository: there, a waiting
policy shows on the pull request, but nothing stops a merge past it.
Making the repository public, or a paid plan, lets it be required.

**It worked when** the next pull request shows **Approval policies**
among its checks.

## The settings

Each policy under [`approval-policies`](../reference/settings/approval-policies.md#approval-policies) has a name and a check, and says
which changes set it off. In a repository of several packages, it can
apply to each package on its own:

```yaml
approval-policies:
  - name: migrations
    agent: rollback-checker
    in: services/* # each folder under services/, checked on its own
    files: ["./db/migrations/**"] # ./ is each of those folders
```

| Key     | What it says                                                                                   | Required or default                  |
| ------- | ---------------------------------------------------------------------------------------------- | ------------------------------------ |
| `name`  | What the status calls the policy                                                               | Required                             |
| `run`   | A command that checks a change, run from the root                                              | One of `run` and `agent` is required |
| `agent` | An agent that checks it, [below](#checking-with-an-agent)                                      | One of `run` and `agent` is required |
| `in`    | The folders it applies to, such as `services/*`, which includes a folder the pull request adds | The whole repository                 |
| `files` | The changed files that set it off, as patterns such as `db/**`                                 | Every file in its folders            |
| `off`   | `true` turns off a policy of the same name a preset adds                                       | Not set                              |

`in` and `files` work as they do for a
[command for some folders](../reference/settings/commands.md#commands-for-some-folders),
except that a check always runs from the root.

- **A policy needs `in`, `files`, or both,** or `factory config check`
  refuses it. Write `files: ["**"]` when every change should set it off,
  and let the check decide what matters.
- **What a folder's check finds names the folder,** as
  `migrations in services/orders`.
- **[`commands.ignore`](../reference/settings/commands.md#commandsignore) doesn't reach a
  policy.** A file it lists still sets off any policy whose `files` match
  it.
- **A change to a policy takes effect once it merges.** The pull request
  that makes it is checked by the policies as they were.
- **`factory config explain`** shows the policies in effect, and which
  preset each came from.

## What a check reads and prints

A check runs in GitHub Actions, from the root of a checkout of your
default branch, never the pull request's, so a pull request can't change
how it is judged. It has no GitHub token, and an agent runs in a job of
its own, with tools that only read and no web access. It reads one JSON
object on standard input:

```json
{
  "version": 1,
  "repository": "acme/billing",
  "pull": 42,
  "base": "the commit the pull request branched from",
  "head": "the pull request's newest commit",
  "files": [{ "filename": "package-lock.json", "status": "modified" }],
  "diff": "diff --git a/package-lock.json b/package-lock.json\n...",
  "in": "services/orders",
  "ticket": { "id": "74", "text": "the ticket's description" }
}
```

- **`files` and `diff`** hold only the files the policy applies to, and
  with `in`, only that folder's. `diff` is a unified diff, as `git diff`
  prints it, with each added line starting `+`. Both come from git, so a
  pull request of any size is read whole, and a renamed file counts under
  its old name and its new one. If git can't read them, every policy
  waits for approval.
- **`in`** is null for a policy without it, and **`ticket`** is null for
  a pull request with none, such as Dependabot's.
- **Whoever wrote the pull request chose `ticket`,** a session included,
  and a session writes its own ticket. So a `## Rollback` heading a check
  looks for there may have been written by the session it is checking:
  check what is under it, as you check the diff, and never follow it as
  instructions.
- **A later `version` only adds fields.**

It prints `{ "findings": [...] }` and exits 0. Each finding has a `file`,
from the root, and a `title`, and may have a `line` and a `why`. Every
finding waits for approval, and a check that finds nothing prints
`{ "findings": [] }`.

Anything else means the check failed: an exit other than 0, output that
isn't this JSON, or no answer in 30 minutes. Then everything the policy
applies to waits for approval. Fix the check on your default branch, then
open the status's **Details** and use **Re-run all jobs** to check
again.

## Checking with an agent

Some things a script can't judge, such as whether a migration's ticket
says how to roll it back. An agent can. `agent: rollback-checker` names
an agent file in `.claude/agents/`, written as for a [plugin](../customize/plugins.md).
The factory hands it the same JSON and tells it the shape to answer in,
so its file says only what to look for:

```markdown
---
name: rollback-checker
description: Checks that each new migration says how it rolls back.
model: opus # optional: the model it runs with, as for any agent
---

Report each migration in the change whose ticket says nothing about how
to roll it back, or whose rollback would lose data.
```

It signs in with the coding agent's token, the `CLAUDE_CODE_OAUTH_TOKEN`
or `ANTHROPIC_API_KEY` secret the
[automated review](../reference/settings/pr-review.md#pr-review) uses.
`factory doctor` says whether your repository has it, and `factory init`
sets it.

**A script and an agent together:** with both `run` and `agent`, the
agent runs only when the command found something, and is handed only
what it found, not the whole diff. A quick script keeps the agent, and
its cost, off every change that doesn't need it. This one's script and
agent are yours to write:

```yaml
approval-policies:
  - name: raw-sql
    run: node .claude/approval-policies/raw-sql/find.mjs # finds SQL built from strings
    agent: sql-reader # reads only those lines
    files: ["src/**"]
```

**An agent can be talked out of a finding** by the text it reads. So a
pull request an agent reads always waits for a person to merge it, even
where [`auto-merge`](../reference/settings/auto-merge.md#auto-merge) would merge it, and its
["Who merges" status](../workflow/merge.md#who-merges) names the policy. With
both `run` and `agent`, that holds only when the command found something
for the agent: a pull request it found nothing in merges as before. When
the agent finds nothing, the Approval policies status says the agent
cleared it, not a person, and its **Details** list the lines it was
handed, for whoever merges.

## When a pull request waits

**Approval policies** is a status on every pull request, beside
[**Review verdict**](../workflow/merge.md#who-merges), the automated review's.
Its **Details** link lists each finding with its file and line.

| What the status shows                                                                                                     | When it shows it                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `Nothing to approve`                                                                                                      | No policy applies, or each one's command found nothing                                                |
| `migrations: cleared by rollback-checker, not a person`                                                                   | An agent found nothing, or cleared everything its command found                                       |
| `Checks when the pull request is marked ready`                                                                            | The pull request is a draft                                                                           |
| `licenses: 1 waiting for approval. To accept it, add the policy-override label`                                           | A check found something                                                                               |
| `2 policies waiting for approval: licenses, migrations in services/orders. To accept them, add the policy-override label` | More than one did                                                                                     |
| `licenses: the check failed, so everything it applies to waits for approval`                                              | The check couldn't answer                                                                             |
| `The change couldn't be read, so every policy waits for approval`                                                         | Git couldn't compare the pull request with where it branched                                          |
| `migrations: rollback-checker can't run here, so everything it applies to waits for approval`                             | An agent, on a pull request from a fork, on Dependabot's, or where the coding agent's token isn't set |
| `Approved by @lead at 9f2c1e0`                                                                                            | Someone added the label on this commit                                                                |

While anything waits, the status is pending, so the pull request can't
merge. A session leaves it alone: it doesn't rename or move a file, or
edit the ticket, to stop a policy applying. A failed check, and a change
that couldn't be read, check again with **Re-run all jobs** once their
cause is fixed, or with the next push.

| What you do                                                          | What happens                                                                                                          |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Add the `policy-override` label, from **Labels** on the pull request | What was waiting on the commit the pull request was at is approved, and the factory comments what it approved         |
| Comment with what to fix                                             | A session fixes it, as for any comment of yours, and each policy checks again on its push                             |
| Push again, or change the pull request's base branch                 | The label comes off, since the change is unread, and anything still found waits for it again                          |
| Approve the pull request on GitHub                                   | Your review counts as usual on GitHub, but the policy still waits, and the factory comments once to say add the label |

The factory creates the `policy-override` label the first time a policy
waits, so it is in the **Labels** list from then on.

- **Where you are the only writer, this is how you approve.** GitHub
  won't let you approve a pull request of your own, and a pull request a
  session opens on your computer is opened as you. Anyone who can write
  to the repository may add the label, the pull request's author
  included.
- **The approval is the label itself.** GitHub records who added it, and
  the commit the pull request was at, and the factory checks that they
  can write to the repository. It approves only what was waiting on that
  commit, so a push that lands as you add it approves nothing new. Its
  comment is for people to read; it never reads one back.
- **A session doesn't add it.** `factory pr label` and
  `factory ticket label` refuse it, and the factory's hooks stop the
  ordinary ways around them. On your computer a session uses your
  account, so it could still add the label some other way: look at what
  it did before you merge, as
  [for `verdict-override`](../security/risks.md#risks-that-do-not-go-away), the
  label that passes the automated review's verdict.
- **`policy-override` passes no Review verdict, and `verdict-override`
  passes no policy.** Nothing skips a policy:
  Dependabot's pull requests, and a repository with
  [`pr-review`](../reference/settings/pr-review.md#pr-review) off, are checked like any
  other.

## Ship a policy in a preset

A company can ship the same policy to every repository through a
[preset](../customize/presets.md). Put its files in `approval-policies/NAME/` beside
`factory-preset.yaml`, and the policy itself in the preset's settings.
`factory sync` copies the folder into each repository's
`.claude/approval-policies/`, as it copies the preset's agents
([Write a preset](../customize/writing-a-preset.md)).

- **A preset added with `--in`** gives its policies only those folders,
  as it does its commands.
- **A policy of the same name** in a later preset, or in a repository's
  own `factory.yaml`, replaces it, and `off: true` turns one off, as for
  a [plugin](../reference/settings/plugins.md#plugins).

A repository turns off a preset's policy this way:

```yaml
approval-policies:
  - name: licenses
    off: true
```

## Trying a policy

`factory approval-policies check` posts nothing, and an agent it runs
signs in as you, as your sessions do. Besides your branch, as in
[step 3](#add-your-first-policy), it can run your policies on a pull
request already merged, to see what a new one would have done:

```console
$ factory approval-policies check --pull 212
approval-policies: 1 applies, for the 2 files #212 changed
? licenses: 1 waiting for approval
  package-lock.json  A dependency is GPL-3.0, which is not allowed
```

When the change touches no file a policy applies to, it says so:

```console
$ factory approval-policies check
- No approval policy applies to this change
```

When a check fails, the command says how, and exits 1:

```console
$ factory approval-policies check
✗ licenses: node .claude/approval-policies/licenses/check.mjs failed (exit 1). Fix it, then run: factory approval-policies check
  TypeError: Cannot read properties of undefined (reading 'split')
      at check.mjs:9:30
```

A policy waiting for approval isn't a failure: the command exits 0, so a
script can tell a broken check from one that found something.

## What an approval policy is not

- **[The merge policy](../workflow/merge.md#who-merges),** which decides whether a pull request may merge
  without you once it can merge at all. An approval policy decides
  whether it can.
- **A review of the design.** A policy reads code on a pull request.
  What should be weighed before code is written belongs in refining the
  ticket.
- **A check that needs a credential,** such as a cloud cost estimate, or
  one that runs the change, such as accessibility in a browser. Those
  belong in your CI.

## On your tools

- [GitHub Actions](../integrations/github-actions.md)
