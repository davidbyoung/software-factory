# Proposal

From [davidbyoung/software-factory#87](https://github.com/davidbyoung/software-factory/issues/87).

## Why

In a private repository of an organization on GitHub Free, the organization's secrets do not reach the repository. `factory init` there says the review and builds in the cloud stay off, then turns them on, because it takes every part a preset sets as on without checking that the secrets the part needs reach the repository. From the setup of the test "turns on no part that reads a secret, and asks for none" in `tests/init-organization.test.ts`, which passes because it reads neither the plan nor the settings in effect:

```text
Builds on your machine work now. The review and builds in the cloud stay off until acme is set up.

From the presets, so not asked
  Parts            a board, the review, and builds that start from the board
```

None of the three parts can work there: the review needs the Claude token, the board sync the App's key, and builds that start from the board both. "Until acme is set up" is wrong too, since it is. The owner met it in `aphiria/scratch` on 2026-11-24, where `factory doctor` then failed three checks with no way to clear them.

It contradicts "In an organization" and "On GitHub's Free plan" in `docs/github/setup.md`, and the `init-organization` spec, which says each part that reads a token is left off.

Decisions:

- **Are GitHub Free organizations still supported?** Yes. Their public repositories work, with "Review verdict" required per repository. (owner, 2026-11-24)
- **What does `init` do where a preset's parts cannot work?** It stops and changes nothing. A first draft had it turn the parts off in the repository's own settings, with a new `pr-review: off`; the owner chose to stop instead.
- **What does it recommend?** Only making the repository public, or moving the organization to a paid plan. Storing the secrets on the repository by hand still works and stays in `docs/github/by-hand.md`, and the message does not name it. (owner)
- **What when GitHub does not show the developer the plan?** A second sign: GitHub refuses to list branch rules for a private repository on GitHub Free, which `requiresStatus` already reads as `NoRulesError`. GitHub's docs say "Organization-level secrets and variables are not accessible by private repositories for GitHub Free". That a member who is not an owner is shown no plan is untried: it needs such an account.
- **A repository already set up** is stopped the same way when `init` runs there, since its presets still turn the parts on. `doctor` gives the fix, and its other lines stay.
- **Build order:** none. No open issue has to be built first, and none waits on this one.

## What Changes

`factory init` stops before it changes anything, names the parts, and says to make the repository public or move the organization to a paid plan. `factory doctor` says the same where the repository is already set up.

## Capabilities

### Modified Capabilities

- `init-organization`
- `tool-setup`
