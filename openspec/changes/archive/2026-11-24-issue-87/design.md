# Design

## Where it goes

- `src/init.mts`: the stop goes after `presetOn` is defined and before the `notAsked` lines are printed. It needs `met` and `reachable`, which are defined further down from `context`, `secrets`, and the opened tools. Make them a function of a list of secret names and a `SetupContext`, and call it at the stop with the tools `settings` names (`settings` is not null where `presetOn` is true): `settings.tickets.type`, `settings.builds.runner`, `where.codeHost`, and `agentName`. The question `pick` asks, with two or more ticket systems, must not come before the stop.
- The repository's own secret names are already read beside `organizationSecretNames` near `withheld`. Keep them, as `null` when the read failed: `catch(() => [])` there would read a failure as no secrets, and line 7 says not to stop then.
- The stop's condition is `withheld !== null && !organization.setUp && (held || elsewhere)`, the third row's, so an organization that is not set up is left alone.
- PARTS is `listed(...)` over `PRESET_PARTS`, as `presetRows` makes the `Parts` row.
- The sentence under `Found` is printed where it is today unless the plan withholds the secrets: then it is held back until after `followPresets` and the stop.
- `docsPage(d.packageVersion, "github/setup.md#on-githubs-free-plan")` makes the address, printed as `src/init-org.mts` prints its own.
- `src/code-host/github.mts`, `secretsWithheldBy`: where `GET orgs/OWNER` answers with no `plan`, call `requiresStatus(await defaultBranch(), REVIEW_VERDICT)`, whose status name decides nothing here, or the same read, and return `PLANS.free` on `NoRulesError`, null otherwise. `NoRulesError` is made there already. A rejected `orgs` read stays null.
- `src/doctor.mts`, `withheld`: gains `fix`. `line` puts a fix that does not start with `Run ` after a colon. It serves the npm secrets' lines too, and the text holds for them.

## Contracts

None: no setting, secret, or file format changes.

## States

`withheld` is a plan's name or null, as today. The repository's own secret names become a list or null.

## Edge cases

- A preset that turns on only the board, with the repository's own `FACTORY_BOARD_TOKEN` stored: goes on.
- The repository's own `CLAUDE_CODE_OAUTH_TOKEN` alone: stops, naming the board and builds that start from the board, and not the review.
- `builds.trigger: manual` in the repository's own settings: `presetOn` is already false for it.

## Risks and rollback

A wrong stop keeps someone from setting a repository up, so it needs both a known plan and a listed set of secrets. Removing the one block in `src/init.mts` undoes it.

## Dependencies

None. `src/init.mts` is also touched by the pull request for #85, which moves `askBranchName` out of it; that is a merge conflict at most.
