# Proposal

From [davidbyoung/software-factory#74](https://github.com/davidbyoung/software-factory/issues/74).

## Why

Setting the factory up today is done one repository at a time. Each `factory init` asks every question, stores a personal access token in that repository's secrets, and leaves the branch, the commit, and the pull request to the developer. A company with 212 repositories would repeat that 212 times, with one person's token in each.

This ticket makes setup two steps:

1. **An organization's owner runs `factory init --org ADDRESS`, once.** It registers the organization's own GitHub App from a form the factory fills in, stores the App's key and the Claude token as organization secrets, creates `OWNER/factory-config` with the organization's preset and its one poller, and sets the rule that requires the factory's checks.
2. **A developer runs `factory init` in a repository.** It reads the presets first and asks only what they leave open, works out which repository it is setting up from the remotes, and opens the setup pull request itself. The developer handles no secret.

A person with no organization keeps the one token GitHub requires, kept on their machine so a second repository asks for nothing.

It is the second of three tickets from one design, drafted with `dx-first` on #72 and approved by the owner on 2026-11-23. It builds on #73, which makes a preset a repository and a repository's workflows two files. The research behind the design is a comment on #72.

**Decided by the owner on 2026-11-23:**

- **A personal access token is the last resort.** It does not scale for a company. An organization's runs use credentials an admin sets up once.
- **An organization installs one App, the factory's** (Q3), which each organization registers for itself. Claude's own GitHub App is not installed, provided the review's test passes.
- **An organization is set up once, by an admin.** A developer who sets a repository up later handles no secrets, and says only what is that repository's own.
- **`factory init --org` is for an organization only.** A personal account runs `factory init` in each repository.
- **A person's token is also kept on their machine** (Q5), in the file that already holds a ticket system's token.
- **`init` opens the setup pull request** (Q8), after asking "Go ahead?".
- **The remote is a proposal.** `init` reads every remote, and asks when they name more than one repository, or a fork.
- **The `repository` line is always required,** and `init` only works out what to propose for it.
- **A company shares its ticket system through a preset** that each repository names. Presets stay optional.
- **One poller for the whole ticket system,** in the organization's `factory-config` repository.
- **A build never sets a repository up.** One human touch for each repository is accepted.

## What Changes

- `factory init --org ADDRESS` is added, for an organization's owner to run once. It creates the board, creates `ORG/factory-config` with the organization's preset and its poller's workflow file, registers the GitHub App "Software Factory for ORG" from a manifest and waits for its install, stores the App's key, its client ID, and the coding agent's credential for the organization, and defines the `software-factory` property and the rule that requires "Review verdict" where it is `on`. Run again, it does only what is missing.
- One poller serves an organization's board: `factory poller --once --preset FILE` makes today's pass for each repository with a ticket in the ready column, the factory's new `poller.yml` runs it from `ORG/factory-config`, and a new release reaches that repository's `factory-poller.yml` as a pull request. A repository that follows a preset whose repository runs the poller gets no schedule of its own.
- Both workflow files pass `app-key`. Where the App's key and client ID reach a run, a job makes a token of the App's and uses it wherever it uses the build, board, or auto-merge token today. The automated review and the "Review verdict" status keep the workflow's own token. Under the App, a session's commits name the App's bot as committer and are not signed.
- `factory enroll` is added, run on a push to the default branch: it sets `software-factory` to `on` under the App, or makes the repository's rule with a person's build token.
- `factory init` takes the repository from the `repository` line, or proposes one from every remote and asks when there is a fork or more than one. `factory default-branch`, and each command that reads `origin/HEAD` today, reads the remote whose address is the `repository` line's.
- `factory init` reads the presets before it asks anything, from `--preset NAME`, a `factory-config` repository of the same owner, or what the machine last used, and asks nothing they answer. It asks for the gate when nothing sets it.
- In an organization's repository, `factory init` asks for no GitHub token: it says whether the organization is set up and whether its secrets reach the repository.
- `factory init` runs the gate, commits what it wrote on a branch, pushes it, and opens the pull request, after "Go ahead?". The rule that requires "Review verdict" is made after the setup merges, and `factory doctor` says whether it is required.
- In a person's repository, `factory init` also keeps the GitHub token and the coding agent's credential in the credentials file on the machine, and stores them for the next repository of the same account without asking.
- The lock records whether each preset's repository holds `factory-poller.yml`, and `factory remove` lists the `software-factory` property among what is left by hand in an organization's repository.
- `docs/github/setup.md` and "On GitHub" in `docs/credentials.md` are rewritten, and no page tells a reader to install Claude's GitHub App or says a token from a GitHub App is not supported.

## Capabilities

### New Capabilities

- `org-setup`
- `org-poller`
- `run-credential`
- `init-repository`
- `init-presets`
- `init-organization`
- `setup-pull-request`
- `machine-tokens`

### Modified Capabilities

- `settings-lock`
- `workflow-files`
- `tool-setup`
- `default-branch`
- `remove`
- `docs`

## Impact

- `src/init.mts`, `src/setup.mts`, and `src/parts.mts`.
- `src/code-host/` and `src/runner/`: each tool's setup steps, and the credential for a run.
- `src/guard-credentials.mts`, `src/poller.mts`, and `workflows/factory-poller.yml`.
- `docs/github/reference.md`: the refusal of an App's token.
- The docs: `docs/quick-start.md`, `docs/existing-repo.md`, `docs/github/setup.md`, and `docs/github/by-hand.md`, for the two setups and what is left to do by hand; `docs/credentials.md`, for the App, the organization's secrets, and the token on a person's machine; and `docs/builds.md` (the one poller), `docs/cli.md` (`factory init --org` and `--preset`), and `docs/presets.md` ("The ticket system is set through a company preset").
- An organization that uses the factory: the App's key and the coding agent's credential reach every repository of the organization.

## Decisions

Each question under "Open questions for refinement" in the ticket is answered here, and both `dx-first` steps are done.

- **The review's comments stay from `github-actions[bot]`, and a build's are the App's** (the owner): a build holds the App's token, and the verdict believes a summary by its author, so one account for both would let a build pass its own review.
- **A build's commits under the App are unsigned,** and "Signed commits from cloud builds" is not offered in an organization's repository (the owner). Verified commits under an App are #77.
- **The test organization is `aphiria`** (the owner), on GitHub's Free plan, with public scratch repositories. The organization-wide rule is tested against a stubbed GitHub.
- **`builds.trigger: github-action` serves an organization too** (the owner): no fourth value. A repository gets no schedule when a preset it follows comes from a repository that runs the poller.
- **How a build's commits are authored and signed under the App:** as "A run in an organization" in the ticket says. The refusal of an App's token in `docs/github/reference.md` goes.
- **#70 is still needed, and unchanged:** it is about a poller someone hosts for one repository. An organization's poller that someone hosts is not built. Neither ticket waits on the other.
- **GitHub Enterprise Server is not built,** as in #73: its servers cannot call the factory's workflows on github.com.
- **"Merge order" leaves this ticket's rule.** #72 builds that status, and adds it to the rule.
- **`init` in an organization's repository never asks for a GitHub token.** Where the organization's secrets do not reach it, the parts that read one stay off. Storing a token by hand, as `docs/github/by-hand.md` says, still works: the workflows read it when there is no App's key.
- **The rule is made after the setup's merge,** by the first run on the default branch, for a person and for an organization. `init` makes it only when the default branch already has `factory.yml`.
- **`init` asks for the gate** when nothing sets it, and runs it before it commits.
- **`init` opens a pull request whenever it changed a file,** on a first run and on a later one.
- **`factory init --org` works in this order:** the board, `factory-config`, the App, the secrets, the rule. The App's key is stored the moment GitHub hands it over, so a run that stops later loses nothing.
- **The secrets and the variable reach every repository of the organization,** whichever repositories the App is installed on, since a later run holds no key to ask GitHub for that list. So anyone who can push a branch to any of them can use the App's key, on every repository the App is installed on. `docs/credentials.md` says so, and how an owner narrows the secrets by hand.
- **Backwards compatibility: none,** as for #73.
- **Build order:** this ticket waits on #73, which is closed. #72 waits on this ticket, recorded there.

**Not doing:** GitHub Enterprise Server. Verified commits under an App (#77). A poller someone hosts for an organization. A repository opting out of its organization's poller. Replacing the App's key from the command: GitHub makes a new key only on the App's page, and `docs/credentials.md` gives the steps, which end with `gh secret set FACTORY_APP_PRIVATE_KEY --org ORG --visibility all`. A command that takes an organization's setup out: `docs/removing.md` lists what to delete. `factory doctor` checking the tokens on a person's machine. An App for a personal account. "Merge order", and a ticket across repositories (#72). GitLab.

**Checked by review, not by a test:** each transcript in the ticket's "Proposed docs" against what the command prints, in the builder's "Mockup and result" comparison in the pull request.
