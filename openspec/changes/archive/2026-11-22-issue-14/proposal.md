# Proposal

From [davidbyoung/software-factory#14](https://github.com/davidbyoung/software-factory/issues/14).

## Why

The factory treats "the owner" as the part of the repository's name before the slash. In a repository an organization owns, that name is never a comment's author, so every review is ignored and every `verdict: override` label is refused. The planned `approvers` list would fix that by duplicating the code host's access list, which goes stale when someone joins or leaves.

Instead, a session asks the code host whether the account has write access to the repository. Those people can already push code and edit the settings, so obeying their comments grants nothing new. No setting is added.

## What Changes

- An approver is an account that can write to the repository, as the code host says. `factory pr state`, `factory pr review-pending`, and `factory pr comments --from-approvers` keep only an approver's reviews and comments, and say "approver" where they said "owner".
- New `factory ticket answers N` prints the comments on a ticket that count as answers: an approver's, without the factory's mark.
- `factory review verdict` honors `verdict: override` from any approver, and comments why when it removes one.
- A cost comment counts on the factory's mark alone, so Cost shows in an organization's repository and for an agent account.
- The skills and the readiness agent read approvers through those commands, and the docs drop the planned `approvers` setting.

## Capabilities

### New Capabilities

- `approvers`: who a session obeys, and the commands that report it.

### Modified Capabilities

- `docs`: the configuration, developing, glossary, limitations, existing-repo, CLI, and builds pages.

## Impact

`src/tickets/github-access.mts` (new), `src/code-host/`, `src/tickets/`, `src/pr.mts`, `src/ticket.mts`, `src/cli.mts`, `src/review-verdict.mts`, `src/lib/work-status.mts`, `src/board.mts`, the review, conflict, and refine skills, the readiness agent, `dx-first`, and the docs.

## Decisions

- **An approver is an account with write access to the repository.** On GitHub that is a `permission` of `admin` or `write` from "Get repository permissions for a user", which counts every grant. Triage, read, a bot, an app, and a name that is no account are not.
- **No `approvers` key**, and **CODEOWNERS is not read.**
- **Any approver can pass the verdict, and it is tied to no one person.** The factory keeps no record of who added the label.
- **A refused override gets a comment saying why**, with a second wording for a lookup that failed.
- **A move to Ready is not checked.** Board access already decides who can move a card.
- **The agent mark, not the author, makes a comment the factory's own.**
- **An agent account's override is not told apart from a person's.** The guards that refuse the label stay the tripwire.
- **When the code host cannot say, nobody is obeyed.**
- **No command prints whether a name is an approver.**
- **A ticket's answers are read with `factory ticket answers N`**, not a `--from-approvers` flag, since on a pull request that flag keeps the factory's own comments. The ticket system's adapter says whose comment may decide.
- **A cost comment counts on the agent mark alone.**
- **No new token scope.**
- **Output says "approver" where it said "owner".** The rules' and skills' prose keeps "the owner" for the person who steers and merges.
