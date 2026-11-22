# Proposal

From [davidbyoung/software-factory#62](https://github.com/davidbyoung/software-factory/issues/62).

## Why

`factory init` must be all someone runs to have a working factory. That holds today only because every tool is GitHub, and a session on a person's machine reaches GitHub through the `gh` CLI's own login. A ticket system that is not GitHub has nowhere to keep its credential and no way to reach the places that need it.

- **No local store.** Nothing under `src/` keeps a secret on a person's machine. Jira's own CLI cannot hand its token to another tool, and Linear has no official CLI. So a session could not run `factory ticket view PROJ-12`.
- **Workflows pass only GitHub's tokens.** The build, sync, poller, review, conflicts, and dependency workflows, and `actions/factory-agent/action.yml`, which passes only `GH_TOKEN` into a session. So a cloud build or the board sync could not read a Jira ticket.
- **Only GitHub's adapter can be opened.** `openTickets` in `src/tickets/index.mts` refuses any type but `github`, and the poller names GitHub's adapters outright.
- **`factory remove` lists every label as one.** It lists the tickets' labels and the pull requests' labels together, which stops being true once the tickets are not the code host's.

On GitHub alone, nothing a user sees changes, except `factory remove`'s list. This is the third of three groundwork tickets before Jira (#63), with #60 and #61. It touches setup and the workflows, not the logic the other two change, so it can be built beside them. `tests/fake-tools.ts` already has a ticket system with a site address and a token of its own, so all of it can be proved with no second ticket system built.

**Decided by the owner on 2026-11-22:**

- **A credential on a person's machine is kept in a file only they can read,** with an environment variable of the same name taking priority. No operating system keychain: on Linux, Windows, and WSL any process running as the person reads an unlocked keychain without a prompt, so it adds little against the real risk, code running as the person, for its complexity. It can be added later as one more place to look, between the variable and the file, with no change for users.
- **An environment variable is for a place that injects it from its own secret store:** CI, Codespaces, a container, and Claude Code on the web. The docs do not tell a person to set one in their shell's profile, which is a plain file other programs inherit from.
- **WSL and remote sessions work out of the box.** WSL and a server reached over SSH use the file. A session where nobody runs `factory init`, such as Claude Code on the web, reads the variables, and the session-start hook names each one that is missing.
- **Each tool names its own secrets, starting `FACTORY_`,** such as `FACTORY_JIRA_TOKEN`. GitHub's names (`FACTORY_BOARD_TOKEN`, `FACTORY_BUILD_TOKEN`, `FACTORY_AUTOMERGE_TOKEN`) do not change, since renaming them would break every repository already set up.
- **The file is keyed by ticket system, then by site,** so a second repository on the same site asks for nothing (Agreed 2 below).
- **The guard hook refuses any tool call whose command or path contains `software-factory/credentials`,** on the shell and on the tools that read, search, and list files (Agreed 5 below).
- **One paste is stored in both places** on the first setup, the repository's secrets and this machine; a teammate's paste goes to their machine only (Agreed 1 below).
- **A teammate who cannot list the repository's secrets** has this machine's credential stored first, and `factory init` stops there, leaving the parts as they are (Agreed 3 below).
- **The session-start hook prints one line in every session** for a missing credential, naming the variables and `factory init` (Agreed 4 below).

## What Changes

- A ticket system declares a credential of one or more parts; `factory init` stores it in the repository's secrets and in `~/.config/software-factory/credentials.yaml`, a file only its owner can read, from one paste.
- Every command that reads tickets reads the credential itself, from the environment first and then the file, and says when it is missing, refused, or in a file others can read.
- `factory init` on a set-up repository asks only for this machine's credential; `factory doctor` and the session-start hook check it.
- The guard hook refuses a session's command or file read that names the file.
- `factory sync` writes the ticket system's secrets into the workflows' jobs.
- `openTickets` and the poller open the ticket system through the registry.
- `factory remove` lists what is left by hand grouped by tool.
- On GitHub alone, nothing changes but `factory remove`'s list.

## Capabilities

### New Capabilities

- `ticket-credentials`

### Modified Capabilities

- `tool-setup`
- `remove`

## Decisions

- **Track: `spec`.** A user sees new output from `factory init`, `factory doctor`, `factory remove`, and the session-start hook, and the change is not small.
- **Build order.** #63 waits on this ticket, already recorded: Jira's credential has nowhere to be kept until it is built. This ticket waits on none. #59 (label names in the settings) and #61 (the factory label) change the label lines `factory remove` prints, which this ticket regroups: that is a merge conflict, not a blocker.
- **One line for a missing credential.** Section 4 of Proposed docs drew Sam's session-start line as `Run: factory init` alone; Agreed 4 settles it as the one line naming the variables and `factory init`, and section 4 now shows that line.
- **The guard's reason names no ticket.** Section 8 drew the guard's reason ending "such as factory ticket view SHOP-12". The hook does not know a ticket, so it ends "such as factory ticket view", and section 8 now shows that.
- **A `This machine` row when the credential is there.** Proposed docs shows the row only when the credential is missing. When it is stored and accepted, the row reads `Jira credential for acme.atlassian.net`, so a re-run says what it found either way.
- **A refused credential on a re-run** is asked for as a missing one is, with the row reading `Jira refused the credential for acme.atlassian.net`.
- **The poller opens the settings' ticket system, and a hosted poller the default one.** `factory poller --once` has the settings, so it opens `tickets.type` through the registry. A poller someone hosts has no settings file, so it opens the default ticket system: `src/tickets/index.mts` exports its name, as `src/agent/index.mts` exports `DEFAULT_AGENT`. With "Not in this ticket", that keeps a hosted poller GitHub's.
- **A cloud build's session sees the token, as it sees GitHub's** (owner, 2026-11-22). In GitHub Actions the job's `env` holds the ticket system's secrets, and a session the `factory-agent` action starts inherits them, as it inherits `GH_TOKEN`. The Done-when bullet that the factory "never puts a credential into a session's environment" holds on a person's machine. `actions/factory-agent/action.yml` needs no change: the job's `env` reaches every step of it.
- **A second repository on the same site copies the credential** (Agreed 2). On its first setup, `init` checks the credential the file holds for the site and, when the ticket system accepts it, stores those values as the repository's secrets with no prompt. Refused or missing, it asks as on any first setup.
- **"Set" means set and not empty.** `${{ secrets.NAME }}` gives an empty value for a secret that is not set, so an empty variable counts as unset (lines 1 and 2).
- **A refusal is a `401`** from the ticket system, caught when a call fails, not checked before each command: a check first would cost every command a request. `403` means no permission, which a new token would not fix.
- **Which workflows get the lines.** The seven of line 10, in each job that runs a factory command or the `factory-agent` action. `factory-check`, `factory-review-verdict`, and `factory-merge-policy` run `sync --check`, `config check`, `review verdict`, `merge-policy`, and `pr label`, none of which opens the ticket adapter.
- **The factory writes the stored line, not the tool.** The tool's check gives the account; `init` words where it went (lines 15, 16, and 20), naming several secrets as "A and B" or "A, B, and C".
- **A sixth hook entry, only with a machine credential.** The guard covers the tools that read, search, and list files through a new `PreToolUse` group in `.claude/settings.json`, matching `Read|Grep|Glob`, beside today's `Bash` group. `factory sync` writes it only when the ticket system in use keeps a credential on the machine, so with GitHub's tickets `.claude/settings.json` is unchanged (line 11) and `docs/github/reference.md` keeps "Five hook entries". `factory remove` takes it out with the others.
- **Transcripts follow today's order.** Proposed docs sections 1 and 7 were drawn with the site asked before the parts and Jira's heading before GitHub Actions'. `init` asks a ticket system's value after the parts, as the `tool-setup` spec says, and `doctor` prints the runner's heading before the ticket system's, so both sections now show that order, and GitHub's output does not change.
- **The builder's calls from the second readiness read:**
  - The tool learns the site on a first setup from the settings document `init` is writing, so `steps(context)` sees the value just asked.
  - On a re-run, the machine branch (lines 18 to 23) runs right after `Found`, before "Which ticket system?" and "Where do cloud builds run?", with the tools the settings name. Those questions, and the branch-name and spec-tool questions, are asked only when the answer is yes, as today.
  - `init`, `doctor`, and `remove` open the ticket system with the credential when it is accepted. When it is not, `doctor` prints line 25's failure and skips the ticket system's own checks, and `init` and `remove` never call the ticket system: `remove`'s leftovers read only the settings and the file's keys.
  - `doctor` words any other failure of the check `✗ The credential on this machine could not be checked (REASON)`, with the fix `Check that SITE can be reached, then run: factory doctor`. A command passes any failure but a `401` through unchanged, as today.
  - After a yes to line 20's question, the repository's missing secrets are stored from the file as line 16 does, with no second prompt. The plan's `Store` row (line 14) appears only when `init` will write the file.
  - On a first setup, line 19's stop applies once the ticket system is chosen, before any other question.
  - The poller: `once` carries the settings' `tickets.type` and `ownLinks(settings)` into `sources` and `linkPulls`; the hosted loop passes `DEFAULT_TICKETS` and `true`, and `readConfig` is unchanged. A `CredentialError` is logged as its message, like any failed read, and `once` exits 1.
  - Leaving any part of a credential empty skips the whole credential: nothing is stored in either place.
  - The file's key is the setting's value exactly as written: `acme.atlassian.net` and `https://acme.atlassian.net` are two keys.

**Not doing:**

- An operating system keychain (Decided by the owner).
- Setup declared for a pair of tools, and a hosted poller for a ticket system other than GitHub ("Not in this ticket").
- Dependabot secrets for a ticket system: no job a Dependabot pull request starts reads tickets.
- Telling a remote session from a local one (Agreed 4).
- Warning before a token expires: the factory reports a refusal, as it happens.
- Jira's adapter, transport, words, and page (#63).
