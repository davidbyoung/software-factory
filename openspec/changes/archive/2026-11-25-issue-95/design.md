# Design

## Where it goes

- `src/init.mts`, the early read near `withheld`: the two `.catch(() => [])` for the organization's secrets and variables keep the failure instead, as `ownNames` already does for the repository's own. Keep `shared` and `variables` in scope for the stop. `organization` and `elsewhere` are computed as today, with an empty list for a failed one.
- One value for which row it is, decided once beside `keepsBack` and used by the row, the stop, and the "stay off" line: set up; the plan keeps the secrets back (`keepsBack`, as today: `withheld` and `held || elsewhere`); unlisted; narrowed (`held`); not set up. In that order, so the plan's row wins over unlisted. `keepsBack` is defined after the row today: move it above.
- The stop: the block headed `if (keepsBack)` becomes one block for the plan, narrowed, and not set up, with the plan's own lines unchanged. `reachable` there is `secretsReach(d.tools, context, names)`, where `names` is `ownNames` for the plan's stop and, for the others, `ownNames` plus, when not `withheld`, `shared`, with `APP_KEY` dropped from `shared` when `APP_CLIENT_ID` is not in `variables`. `APP_KEY` among the repository's own secrets counts as it does today.
- The secrets and the variable line 2 prints come from the unmet parts' needs, read the way `secretsReach` reads them (`secretSteps(...).filter(isKept)`, the part's `needs`, and for `from-board` those of `cloud` and `board` too). A need whose `anyOf` holds `APP_KEY` and is not met by `names` gives `APP_KEY` when `shared` lacks it, and the variable when `variables` lacks `APP_CLIENT_ID`. Any other unmet need gives its `anyOf` joined by `or`. Keep the order: the App's key first.
- The "stay off" line is printed only after `followPresets`, in one place, with `gap()` as the plan's is now. The early call after Found goes. `settings` after `followPresets` is the settings in effect: line 15's review is `settings?.["pr-review"]`'s own reading in `partsOn`, so use the same test `partsOn` (`src/parts.mts`) uses for the review and builds that start from the board.
- Line 16: in the `offered` filter, for an organization's repository, drop `cloud` when `presetOn("from-board")`, as it is already dropped where the organization is set up. `before` then keeps it on through the `PARTS.filter((p) => before.has(p) && !offered.includes(p))` beside it.
- The two pages' addresses: `secretsPage()` and `variablesPage()` on `Organization` in `src/code-host/types.mts`, beside `appsPage()`, filled in `src/code-host/github.mts` with `${SITE}/organizations/NAME/settings/secrets/actions` and `.../settings/variables/actions`. `src/init.mts` reaches them through `organizationHosts()[where.codeHost]?.organization(owner)`, as it reads `addressOf` today; opening one makes no call. Where the code host has no entry, the two addresses and the `factory init --org` command's address are left out, as the row does with `?? owner`.
- `docsPage(d.packageVersion, "github/setup.md#when-the-organizations-secrets-do-not-reach-you")` makes the steps' address.
- `src/runner/github-actions.mts`, `organizationVariableNames`: `per_page=30`, and a page with fewer than 30 is the last.

## Contracts

None: no setting, secret, or file format changes. `Organization` gains two methods, so any other implementation of it, in `tests/` too, gains them.

## States

The `Organization` row is one of five: set up, not set up, kept back by the plan, not reaching, and unlisted. `ownNames`, `shared`, and `variables` are each a list or a failure.

## Edge cases

- Only the App's key is kept back, and the Claude token is shared: stops, naming a board and builds that start from the board, and lists only `FACTORY_APP_PRIVATE_KEY`, plus the variable if it is kept back too.
- The key is shared and the variable is not: the stop lists only the variable.
- The repository's own `CLAUDE_CODE_OAUTH_TOKEN` alone: the review is met, and NAMES leaves the credential out.
- The repository's own `FACTORY_BOARD_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN`: goes on, and prints no line on what stays off.
- `--preset` with no `factory-config` found: the not set up stop.
- `factory-config` written by hand with the App never registered: the stop of line 1, whose "If one is not listed there" line covers it.
- The owner's kind cannot be read: it is treated as an organization's, and the listing then fails, so nothing stops.
- A board-only preset met by `FACTORY_BOARD_TOKEN`, with no Claude credential: goes on, and line 13 or 14 prints, since the review and builds in the cloud are off.

## Risks and rollback

A wrong stop keeps someone from setting a repository up, so it needs both listings to have worked. Removing the block's two new branches undoes it.

## Dependencies

None.
