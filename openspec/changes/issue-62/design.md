# Design

## Where it goes

- **`src/setup.mts`**: a new step kind, `credential`, beside `value` and `secret`. It has `needs`, `parts` (each `{ name, prompt, masked }`), `intro`, `get`, `check(values)` resolving to `{ account, lines }`, or rejecting with an `HttpError` (from `src/tickets/transport.mts`) for a refusal and with any other `Error` whose message is the line to print, `refused(reason)` returning the refusal line of line 13, `skipped`, `revoke?: { page }`, and `machine: { under: string } | null`, the settings key under `tickets` the file files it by (`"site"`). It has no `stored`: the factory words that line. `secretSteps`, `neededSecrets`, and `partsOn` treat a credential's part names as they treat a secret's `storeAs`, so the runner's lines in `doctor` (`NAME is set, for LABEL`) and the "already set, replace them?" question come for free.
- **`src/lib/credentials.mts`** (new): the file's path (`$XDG_CONFIG_HOME` or `~/.config`, then `software-factory/credentials.yaml`), `read(tool, key, names, env)` with line 1's precedence and line 4's mode check (`(mode & 0o077) !== 0` refuses), and `write(tool, key, values)`, which makes the folder with mode `0o700`, writes a temporary file opened with mode `0o600` in the same folder, and renames it over the old one. YAML through the `yaml` package the settings already use. The path is printed from `~` when it is under `os.homedir()`.
- **`src/tickets/github-open.mts`** (new): GitHub's opener, the `githubTickets(...)` construction `src/tools.mts` and `openTickets` hold today, taking the target (with `boardOwner`), the settings (`fieldNames`), and the transport. It imports nothing from `src/tickets/index.mts` or `src/tools.mts`.
- **`src/tickets/index.mts`**: `openTickets(settings, target, opts, systems = TOOLS.tickets)` opens `systems[settings.tickets.type]` through the registry, then wraps it with `withTicketFields` as today. `src/tools.mts` stops importing `openTickets`, and imports GitHub's opener from `github-open.mts`, so there is no import cycle. It reads the credential with `src/lib/credentials.mts` when the tool's setup has a `credential` step with `machine`, and passes the values to the tool's `open`. A missing or unreadable credential throws `CredentialError` (new, in `src/tickets/types.mts`) carrying line 3's or 4's text. `DEFAULT_TICKETS = "github"` is exported here. `refOf` and `keyOf` keep their own `github` check, which is #63's to open up.
- **`src/tools.mts`**: the tickets entry's `open(target, settings, opts)` takes `target.boardOwner`, `opts.transport` (the poller's `fetchTransport`, or the GitHub CLI's by default), and `opts.credential` (the values). GitHub's ignores `credential`. The registry is the one file outside `src/tickets/` that names a ticket system.
- **`src/poller.mts`**: `once` passes the settings' `tickets.type` to `sources`, and the hosted loop passes `DEFAULT_TICKETS`. `sources` opens that registry entry with the `fetch` transport, the board's owner, and the credential read by `src/lib/credentials.mts` (from the job's `env` in Actions), in place of `githubTickets`. `sources` takes the registry as a parameter, so a test hands it Fake Tickets. The boundary test gains a check that nothing outside `src/tickets/` and `src/tools.mts` imports `src/tickets/github.mts` or `github-open.mts`.
- **Refusals**: for a ticket system with a machine credential, `openTickets` wraps each method of the opened adapter so an `HttpError` with status `401` becomes `CredentialError` with line 5's or 6's text, knowing where the credential came from. GitHub's adapter is not wrapped. `src/cli.mts` prints a `CredentialError`'s message on standard error and exits 1, with no stack.
- **`src/session-start.mts`, `src/status.mts`**: `status --hook` catches `CredentialError` and prints `✗ ` and its message under `## Work in progress`, exiting 0, so the session starts.
- **`src/init.mts`**: the credential step runs where secret steps run today, writing the file as well when `machine` is set. Lines 17 to 21 add a branch before `runner.secretNames()`: with settings present and a machine credential, it reads the file (line 2), checks it with the tool's `check`, prints the `This machine` row, and when missing or refused asks, stores, asks line 18's question, and returns early on no, or on a failed listing (line 21).
- **`src/doctor.mts`**: line 25's check is `doctor`'s own, through a helper in `src/lib/credentials.mts` that reads the credential and calls the tool's `check`, printed under the ticket system's heading. A tool's `checks` do not call it.
- **`src/sync.mts`**: a `withTicketEnv(text, names, file)` beside `withNpmEnv`, applied to the seven workflows of line 10, to the jobs `withNpmEnv`'s test picks (a job that runs `npm ci` or the `factory-agent` action), skipping a name the job's `env` already has. The names are the ticket system's credential part names, read from the registry through the settings' `tickets.type`. Both helpers add lines to the same `env:` block; a job without one gets one, as `withNpmEnv` does.
- **`src/guard.mts`** and a new `src/guard-credentials.mts`: the check of line 9, run for `Bash` from the existing `PreToolUse` group, and for `Read|Grep|Glob` from a new group `src/sync.mts` writes. The hook reads every string value in `tool_input`.
- **`src/remove.mts`** and each setup's `leftovers`: `leftovers` stays a list of lines; `remove` groups them by tool label. The label lines move: the pull requests' into `githubCodeHostSetup.leftovers`, the tickets' into `githubTicketsSetup.leftovers`; the signing key joins the code host's secrets line. Line 30's lines come from the helper in `src/lib/credentials.mts`, for any ticket system with a machine credential, which reads the file's keys only.
- **`tests/fake-tools.ts`**: Fake Tickets' token becomes a credential of two parts, `FAKE_TICKETS_EMAIL` (in the open) and `FAKE_TICKETS_TOKEN` (masked), with `machine: { under: "site" }`, a `revoke` page, and a `check` that resolves with the account `Fake User` and rejects the token `bad` with `HttpError(401, ..., "Unauthorized")`. Its `open` records the credential it was given, so a test can see which source won, and returns an adapter whose calls throw that `HttpError` when the token is `bad`.

## Contracts

- The file: `software-factory/credentials.yaml`, mode `600`, in a folder of mode `700`. Its shape is Proposed docs section 2: tool name, then the `machine.under` setting's value, then each part's name and value. The three comment lines at its top are written when the file is made.
- Environment variables: each credential part's name, read only when every part's name is set (line 1). No new variable for the factory itself.
- The settings: no new key. `tickets.site` is Fake Tickets' and Jira's own, as today.
- `.claude/settings.json`: one new `PreToolUse` group, `{ "matcher": "Read|Grep|Glob", "hooks": [{ "type": "command", "command": "npx --no-install factory guard credentials" }] }`, written and removed as the factory's other hooks are.

## States

The credential on this machine is one of: from the environment, in the file and accepted, in the file and refused, missing, or the file unreadable. `init`, `doctor`, the session-start hook, and every ticket command read the same state through `src/lib/credentials.mts` and the tool's check, so they never disagree.

## Edge cases

- Only some of a credential's names set in the environment, or set empty, as a workflow gives an unset secret: the file is read (line 2), so a half-set environment does not mix with the file. In Actions there is no file, so line 3 names the secrets to set.
- The file present with no entry for this site: missing, line 3.
- The file not valid YAML: every command prints `PATH is not valid YAML: REASON. Fix or delete it, then run factory init again.` and exits 1; `init` and `doctor` as lines 19 and 25 say.
- Windows: `fs.stat` reports no group bits, so the mode check passes there; the factory is not tested on Windows today.
- A Codespace or Claude Code on the web: no file, so the environment is the only source; line 3 names both ways.
- Two `init` runs at once: the rename makes the last one win whole.

## Risks and rollback

- **A wrong mode check locks people out.** The first thing to change is the check in `src/lib/credentials.mts`; the file itself is untouched by the check.
- **The guard's substring catches an innocent command,** such as a search for the words in this repository's own docs. The reason says what to do instead, and the factory's own source never needs a session to read the file.
- **A workflow job missing the env lines** fails only for a ticket system that is not GitHub, which none is until #63.

## Dependencies

- None to start. #63 waits on this ticket, recorded.
