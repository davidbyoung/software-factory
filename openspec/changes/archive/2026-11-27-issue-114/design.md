# Design

This builds on #81's code, merged to `main` in pull request #120: `src/lib/claude-token.mts`, the day lines in `src/doctor.mts`, `tokenWarning` and `status`'s `tokenReader`, and `init`'s question before `Replace them?` in `src/init.mts`. Branch from `main`.

## Where it goes

- **The expiry from GitHub.** `tokenOwner` in `src/code-host/github.mts`, and its type in `src/code-host/types.mts`, also returns `expires: string | "never"`: the `YYYY-MM-DD` at the start of the `github-authentication-token-expiration` header, or `never` when it is absent. A header that does not start with a date counts as absent. GitHub writes it as `2027-02-25 00:00:00 UTC`.
- **Passing it to `init`.** The `verify` result of a secret step in `src/setup.mts` gains an optional `kept?: Record<string, string>`, values to write beside the token in the file, and `machine.serves` resolves with the same field. `src/code-host/github-setup.mts`'s step returns `{ expires }` from both. `init` writes `pasted` for every kept token, generalizing #81's `AGENT_TOKEN`-only write, and adds `kept`'s values, and only `expires` on a store from the machine (line 12).
- **The day, worded.** `src/lib/claude-token.mts` gains the access token's lines beside the Claude token's: a `TokenDay`-like value from `expires` (no year added: the day is the day), `never` as its own stage that never warns, and builders for lines 2 to 5, 8, 9, 13, 14, and 16. Rename the file `src/lib/token-day.mts` if both tokens live there, and update its imports. `pastedDay` in `src/lib/credentials.mts` gets a sibling for `expires`, or one reader that returns both.
- **Which secrets hold it.** One pure function, given the repository's dated secrets, the token's names, and the file's `pasted`, returns NAMES and OLDER, with OLDER's earliest `updated_at`. The token's names are the `storeAs` of the code host's kept secret step from `secretSteps(tools, context(on))`, which is `tokenNames` in `github-setup.mts` for the parts on. `doctor`, `tokenWarning`, and `init` all call it.
- **`factory doctor`.** In the `reads` loop in `src/doctor.mts`, after the last `is set` line of the token's names, push line 1's line, then line 5's. Only when `!isOrganization`, and only names in `own`: a shared organization secret is never the person's token.
- **`factory status`.** `tokenWarning` in `src/doctor.mts` returns a list of lines, Claude's first, then line 8's, then line 9's, and `status.mts`'s `Source.token` becomes `() => Promise<say.Line[]>`; the blank line before them stays one. Its early `return null` when `readsAgentToken` is false gates only Claude's line: the access token's lines have their own gate: a repository a person owns, a token the file holds for the owner, and the token's names for the parts on, as Spec line 6 says.
- **`factory init`.** Beside #81's `agentStep`, find the code host's kept step and ask line 13's or line 14's question before `Replace them?`, in the tools' order, so with both due the GitHub token's comes first. Put the step in `asked` with `names` of NAMES and OLDER, in `keeping` for line 13's yes and `servedFrom` for line 14's. Keep the step out of `replace` as #81 does. Line 16 joins #81's `pastedOld` check in the `servedFrom` loop, reading the file's `expires`, and, when the file has none, checks the `kept.expires` that `serves` resolves with before putting the token in `servedFrom`: a near one gets line 16's line through `stale`, and is asked for.
- **The step's line** (line 17) is the `intro` in `github-setup.mts`.

## Contracts

- GitHub's `github-authentication-token-expiration` header, on any REST call made with a personal access token that has an expiry, as `YYYY-MM-DD HH:MM:SS UTC`.
- The credentials file entry: `github: { github.com/OWNER: { token: ..., pasted: YYYY-MM-DD, expires: YYYY-MM-DD | never } }`.

## States

The token's day: `fine` (more than 30 days), `soon` (30 to 0), `over` (after it), and `never`. Each set secret of the token's names: the machine's, or older.

## Edge cases

- The token's secrets read by no part: the `is set` lines are not printed, so neither is line 1 or line 5.
- Only some names older: line 1 names the others, line 5 the older ones.
- An `expires` the file holds as something other than a date or `never`: treated as absent.
- Both the Claude token and the access token due in `init`: two questions, the GitHub token's first.
- `--hook`'s time limit: no new request, since the days come from the file and the secrets listing #81 already reads.

## Risks and rollback

If GitHub stops sending the header, every newly pasted token reads `expires: never`, and `doctor` says it has no expiry date when it may have one. That misleads and breaks nothing. The first thing to change is the header's parsing in `tokenOwner`.

## Dependencies

#81 is closed, its pull request #120 merged, so nothing blocks the build. No owner-only step.
