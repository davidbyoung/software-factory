# Proposal

From [davidbyoung/software-factory#104](https://github.com/davidbyoung/software-factory/issues/104). The ticket's "Proposed docs" are the approved docs page and the design behind it.

## What and why

A repository can add two kinds of check to the factory today: a command,
which passes or fails by itself, and a plugin, which advises a session that
then weighs what it says. Neither fits a check where an exception is
sometimes right but the session must not be the one to grant it, such as:

- a dependency under a license the company has not allowed;
- a database migration with no way back;
- a change to payments that its leads sign off, which `CODEOWNERS` already
  does when what it needs is who reads every change;
- a new credential, or write access for a workflow, which is #82.

As a command, nobody can say "yes, anyway" without editing the check. As a
plugin, the session can say it alone.

An **approval policy** is the third kind. The factory runs it, not the
session. When its check finds something, the pull request waits until a
person who can write to the repository answers, and that answer can be
"yes, anyway". Companies will want full control over approval policies:
which changes are a policy's business, what checks them, and shipping
them in a preset to every repository they own.

The owner asked on 2026-11-25 for guards, named approval policies on
2026-11-26, to be built first, with #82's credentials read as the first
approval policy the factory ships, built after this.

## Done when

- A repository, or a preset, adds an approval policy under
  `approval-policies` in `.claude/factory.yaml`, with any files it needs
  in a folder of its own under `.claude/approval-policies/`.
- A policy says which changes are its business by file patterns, and in
  which folders of a monorepo, as commands do since #75.
- A policy is checked by a command, an agent, or both, where the agent
  reads only what the command found.
- A policy holds the pull request with a required status of its own,
  **Approval policies**, until a person answers.
- Only a person answers, with the `policy-override` label on the commit
  they read. GitHub's record of who added it, checked for write access,
  is the approval, and the factory comments what was approved. A session
  cannot add the label, and `verdict-override` does not pass a policy.
- A policy whose check crashes, times out, or answers in a form the
  factory cannot read holds, rather than passing.
- `factory config explain` lists the policies in effect and where each
  comes from, and `factory approval-policies check --pull N` runs them
  over a past pull request, before they hold anything.
- The docs say when to write a command, a plugin, `CODEOWNERS`, an
  `auto-merge.deny` pattern, or an approval policy.
- The tests use a policy that lives only in the tests. The factory ships
  no policy in this ticket.

## Not in this ticket

- **The credentials policy,** which is #82 and waits on this. #82 also
  keeps a read of the design before code is written, which no
  pull-request check can do.
- **Later additions** that the design leaves room for: a policy that
  warns before it holds, exceptions that expire, a hold on a ticket
  alone, letting a team approve only its own policies (which needs a
  `members` permission the App doesn't have), and policies that wait on
  one another.
- **A forged status.** A required status is pinned only to GitHub
  Actions, so any workflow's token can post it; that holds for
  **Review verdict** today too, and is a ticket of its own if the owner
  wants one.

## Settled in the docs-first draft

- **One pull request or two:** one.
- **Who answers when the author is the only one who could:** the
  `policy-override` label, which any writer adds, the author included,
  since GitHub won't let an author approve their own pull request.
- **A session on a person's computer:** the label commands refuse it, and
  the factory's hooks stop the ordinary ways around them, a tripwire, not
  a lock, as for `verdict-override`. The docs don't point companies at
  Claude Code's managed settings in this ticket.
- **An agent in the cloud:** it signs in with the coding agent's token,
  `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`, as the automated
  review does. Where it can't run, on a fork's pull request, on
  Dependabot's, or with no token set, everything its policy applies to
  waits for approval.
- **Gone from the first draft of this ticket:** a policy with no check,
  which is `CODEOWNERS`; a hold on a session's commit, since a cloud build
  has no hook; a section a policy requires in its ticket, which a check
  reads from the ticket's text instead; and naming who approves, which
  `CODEOWNERS` does.

## Related

#82, the first approval policy, blocked by this. #75, the folders and
patterns approval policies follow. #83, closed into #82, which asked that a High never be put off
without a person.

## Decisions

- **Name:** approval policies, setting `approval-policies`, status **Approval policies**, label `policy-override`, command `factory approval-policies check`. "Guard" stays the name of the existing `factory guard` hooks; "rules" collided with the factory's rules and the `rules:` setting; GitLab calls this feature merge request approval policies.
- **Shape:** a policy is a command item for some folders (`run`, `in`, `files`, #75) with a `name`, and `agent` beside or in place of `run`. No `when`, `match`, `only-if`, `checked-by`, `approved-by`, or `ticket-needs`.
- **Where it runs:** on the pull request only, in GitHub Actions, from the default branch's checkout. No hold on a session's commit, since a cloud build runs no hook.
- **Who approves:** anyone who can write to the repository, the author included, by adding `policy-override` on the commit they read. GitHub's own Approve doesn't count: a pull request a session opens on the owner's computer is the owner's, and GitHub won't let an author approve their own. Naming who approves is `CODEOWNERS`'s job.
- **The approval:** GitHub's labeled event, checked for write access, approving only the findings posted for the label event's own head commit; a push or a change of base takes it off. The factory's comment is for people and is never read back. No finding ids, so nothing carries across pushes.
- **A pull request a policy with an agent applies to never merges itself,** decided by the merge policy from the files before any check runs, since GitHub's auto-merge is turned on within a minute and an agent can be talked out of a finding.
- **Isolation:** a check runs with no GitHub token and no persisted git credentials; an agent runs in a job of its own with no GitHub permissions, read-only tools, and no web access; a separate job posts the status from each check's JSON.
- **The change is read from git,** not GitHub's list of changed files, which stops at 3000.
- **Cut, as covered elsewhere:** a policy with no check (`CODEOWNERS`, `auto-merge.deny`), a ticket section a policy requires (a check reads the ticket's text), SARIF's `warning` and `note` (a plugin's job; a warning first is listed as later), threads on lines (they must be resolved to merge), a listing command (`factory config explain`), and replay over many pull requests (`check --pull N`).
- **Build order:** #82 is blocked by this, already recorded: it is built as the first approval policy the factory ships.
- **In the factory today, not this ticket:** a label added as a push lands can pass Review verdict on the newer commit; a base change leaves Review verdict standing; `auto-merge.deny` reads GitHub's capped file list; any workflow's token can post a required status. Each is a ticket of its own if the owner wants one.
