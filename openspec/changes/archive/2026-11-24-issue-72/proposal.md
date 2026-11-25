# Proposal

From [davidbyoung/software-factory#72](https://github.com/davidbyoung/software-factory/issues/72).

## Why

The factory builds a ticket in one repository, with one pull request whose merge closes it. A story often touches several, and with Jira a ticket lives in none.

Decided on 2026-11-23, with the draft:

- **Where a ticket's repositories come from.** Found for each ticket, confirmed by a person, and recorded on the ticket. There is no standing map from a project to repositories.
- **When refinement asks (Q6).** Only when the agent finds a second repository, or the ticket names one.
- **How many pull requests.** One in each repository, from one ticket. The ticket closes when every one has merged.
- **A repository without the factory.** Flagged at refinement, and refused at the claim. A build never sets one up.
- **A build on a machine (Q1).** One session for every repository.

Decided on 2026-11-24, at refinement:

- **A build in the cloud (P1, changes Q1).** One run for each repository, one after another in merge order, since #80 gave each run one repository's secrets, Node, and sandbox, and agreed that a build reaches nothing beyond its repository.
- **Who may name a repository.** Someone who can write to every repository on the list, recorded by `factory ticket repositories`. A claim, a cloud run, and every status read only a list confirmed that way. The threats, as asked for in the note of 2026-11-24:
  - An issue's author, on a public repository anyone, edits its text to name a private repository, whose code is then handed to a session. Closed: the text alone names nothing.
  - A hijacked session edits its own ticket's text to name another. Closed: Publish keeps the section as it is, and cannot run the command.
  - Someone who can write to `acme/api` names `acme/payroll`, which they cannot see, and reads its code through the pull request. Closed: they cannot confirm that list.
  - Text in `acme/api`'s branch leads `acme/web`'s session to write bad code. Left, as "Write bad code" in `docs/credentials.md` is: it is a draft pull request, never merges itself, and a person reads it.
  - A session handed `acme/web`'s private code writes it into `acme/api`'s pull request, where `acme/api`'s readers see it. Left between private repositories: whoever confirmed the list can write to both. Closed between a private and a public one.
- **The rest of that note.** Each repository's run uses its own rules, gate, hosts, and setup. Publish starts the next build as soon as its pull request is open, then waits for the CI of that pull request alone, to mark it ready; one whose CI fails is answered as any, while the order holds the later ones. A pull request records the ticket it is for, in each repository. A refused commit, such as a workflow file's, holds back its own repository and the ones after it, and an earlier pull request stays open. The note takes one session in the cloud as settled; P1 changed that after it.
- **Where the other repositories go on a machine (P2, changes the draft).** Outside the checkout, under `~/.local/share/software-factory/work/`. Inside it, Vitest in the first repository ran the second's tests and its gate failed. `.factory/work/` and its `.gitignore` line are dropped.
- **What holds a later pull request (P3).** "Review verdict" waits. "Merge order" is shown, and no rule requires it, so #74's "adding Merge order to the rule" is dropped: a newly required status would block every pull request in a repository whose factory is older.
- **A pull request that merges itself (P4).** Never one that is part of a ticket across repositories.

Settled from the code and the docs at refinement:

- **A ticket that touches only its own repository** has no Repositories section on GitHub: the issue's own repository is its record. Refinement says so in one line, as Q6 asks.
- **The ticket decides the order,** not the `Depends-On:` line, which is there for a person to read.
- **Which run starts.** The poller starts a build in the ticket's own repository, and `factory build N` in the checkout's, both as today. That run starts the next repository's when it is another.
- **How a pull request is named.** By its number, in its own checkout, as today. Output that names one in another repository writes `acme/web#41`.
- **Whose comment is an instruction, and who approves.** On the ticket, someone who can write to the ticket's own repository, with no access to the others needed. On a pull request, someone who can write to that pull request's.
- **A ticket reopened after it finished.** Merges from before it finished no longer count.
- **Every repository has one owner,** the ticket's own included, since an App's token is for one owner.
- **Private and public repositories together** are not built in the cloud, where what a session read of one could be written to the other.
- **No token that reaches the other repository.** "Merge order" says so and nothing waits on it, since waiting would hold the pull request forever.
- **With the automated review off,** "Merge order" is information, since nothing the factory posts is required there.
- **The `repository` line wins in a run** for the commands that already read the settings. The steps that read none, through `reachOf`, keep GitHub's name, as the draft says.
- **Build order.** #73 and #74 are done. #63 waits on this ticket, since Jira implements the same ticket adapter.

## What Changes

- A ticket names its repositories and the order they merge in, recorded and confirmed by `factory ticket repositories`.
- On a machine one session builds them all, with `factory workspace` cloning the others. In the cloud each has a run of its own, one after another.
- Each pull request says `Part of`, "Merge order" shows what it waits for, "Review verdict" holds it, and the ticket closes when the last one merges.
- Commands that read the settings take the repository from the `repository` line in a run too.

## Capabilities

### New Capabilities

- `ticket-repositories`
- `workspace`
- `repository-builds`
- `repositories-done`
- `merge-order`
- `repository-line`
- `repository-confirmation`

### Modified Capabilities

- `ticket-keys`
- `review-verdict`
- `merge-policy`
- `run-credential`
- `workflow-files`
- `status`
- `ticket-fields`
- `remove`
- `docs`

## Impact

- Not doing: one repository's CI against another's unmerged change; a cloud session that changes two repositories, or starts an answer on an earlier pull request; a ticket that spans owners; requiring "Merge order" in any rule; the nightly catch-up in a repository with no board; a migration for tickets written before this; GitLab and Jira themselves, which the adapter's calls leave room for.
