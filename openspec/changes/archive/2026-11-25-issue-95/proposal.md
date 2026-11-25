# Proposal

From [davidbyoung/software-factory#95](https://github.com/davidbyoung/software-factory/issues/95).

## Why

In an organization's repository that the organization's secrets do not reach, `factory init` says "The review and builds in the cloud stay off", then turns on the parts a preset sets. They can't work without the secrets. #87 made init stop for one cause, a private repository on GitHub Free. Two causes are left, which #87 put under "Not doing":

- an owner on a paid plan shared the secrets only with other repositories;
- nobody has run `factory init --org` for the organization.

Done when:

- In both cases, when a preset turns on a part that the secrets reaching the repository do not meet, init stops before any change, as it does on GitHub Free, and says what the presets turn on and who can fix it.
- Init never says a part stays off and then turns it on.
- Where init cannot list the secrets, it does not stop on a guess.

Where:

- `factory init` in `src/init.mts`: `keepsBack`, `staysOff`, and the stop after "A part the presets turn on here".
- The spec is `init-organization`. `docs/github/setup.md`, "In an organization", says what init does for each `Organization` row.

Moved here from #4, where it was found while building #87. The owner agreed on 2026-11-25 to keep it as a ticket, with this fix.

Decisions:

Each was settled with the owner on 2026-11-25, in the draft under "Proposed docs".

- **What does the stop say where the secrets do not reach?** It names each secret and the variable that is missing, with the page that has it. A developer usually cannot see the organization's settings. (owner)
- **What when init cannot list the organization's secrets?** It does not stop, its `Organization` row says they could not be listed and why, and it claims nothing about what is off. (owner)
- **A preset's builds from the board, with "Builds in the cloud" unchecked.** Fixed here: init does not offer that part in an organization's repository whose preset turns on builds from the board. (owner)
- **A repository the owner keeps the secrets from on purpose** can't follow a preset that turns on one of the three parts. No setting turns a preset's part off, as #87 decided. (owner)
- **The "stay off" line moves after the question about presets** and is left out where it would be false, on GitHub Free too.
- **An organization that is not set up, on GitHub Free, in a private repository** is stopped with the command an owner runs and the plan's limit, since the command alone would not be enough. #87 left it alone.
- **The variables' pages.** GitHub gives at most 30 of the organization's variables a page ("max 30" in [its docs](https://docs.github.com/en/rest/actions/variables)), and the code asks for 100 and stops at a page with fewer. An organization with more could then be read as not set up, which this ticket would turn into a wrong stop, so it is fixed here.
- **Storing the secrets on the repository by hand** still works and stays in the docs. The stop does not name it, as #87 decided.
- **Build order:** none. No open issue has to be built first, and none waits on this one. #94 also changes `src/init.mts`, which is a merge conflict at most.

## What Changes

- `factory init` stops where an organization's secrets do not reach the repository and a preset turns on a part that reads them, whether an owner shared them with other repositories or the organization is not set up.
- The line on what stays off comes after the question about presets, and is left out where it would be false.
- Where the organization's secrets cannot be listed, the `Organization` row says so, and nothing stops.
- "Builds in the cloud" is not offered where a preset's builds from the board need it.

## Capabilities

### Modified Capabilities

- `init-organization`

## Impact

`src/init.mts`, `src/code-host/`, `src/runner/github-actions.mts`, `docs/github/setup.md`, and `docs/credentials.md`.
