# Design

## Where it goes

- `src/config.mts`: `SETTINGS_KEYS["code-host"]` gains `branch-name` (line ~290); `Settings.codeHost` becomes `{ type: string; branchName: string }` (line ~163); the parse at ~726 reads `branch-name` from the `code-host` block, where `typed()` turns `code-host: github` into `{ type }` with no pattern, which then fails line 1. Put the pattern's checks (lines 4 to 8) in one exported function, such as `branchPatternFault(value): string | null`, returning the reason text, so `init` (line 17) and the settings check share it. Validate the settings in effect, after presets, as `loadSettings` already passes them to `parseSettings`. Throw the missing case as a `SettingsError` subclass init can tell apart, as #53 does for its missing states.
- `src/explain.mts` line ~113: `put(["code-host"], s.codeHost.type)` becomes the block, with `branch-name` quoted so the output stays a valid settings file ("The output is a valid settings file" in `openspec/specs/config-explain/spec.md`).
- `settings.schema.json`: `code-host` keeps its `anyOf`, and the object form gains `branch-name` (a string, described with both placeholders). No `required`: a preset can supply it (#53's reasoning). `tests/settings-schema.test.ts` checks the keys against `SETTINGS_KEYS`.
- `src/ticket.mts`: a `branch` subcommand in `ticketCommand`, beside `link`. It reads the ticket (for line 11's not-found, with `factory ticket view`'s wording), reads the pattern from the settings, and calls the code host's `signedInAs()` only when the pattern has `{user}`.
- `src/cli.mts` and `src/commands.mts`: `factory specs change-name N` beside `specs check` (`cli.mts` ~223, `commands.mts` ~40 and ~71), with its usage line.
- `src/init.mts`: the question with `d.ask.input` right after `chosen` is built (~316), skipped when the settings in effect have the key (line 21); the answer checked with the shared function and asked again on a fault; written into `doc` as a `code-host` block with a double-quoted scalar (the `yaml` library's `Scalar` with `type = "QUOTE_DOUBLE"`). Line 22 extends #53's "init reads a file whose one fault is ..." path to this key.
- `src/code-host/types.mts`, `github.mts`, and `tests/memory-code-host.ts`: a `lastForBranch(branch)` beside `forBranch`, returning the newest pull request from the branch, open or not, as `{ number, state: "open" | "merged" | "closed", head }` or null (GitHub: `pulls?head=OWNER:BRANCH&state=all&sort=created&direction=desc&per_page=1`, `merged` from `merged_at`). `src/pr.mts` gains `for-branch`, printing it as lines 15 and 16 say.
- `skills/factory-build/SKILL.md` (then `node bin/factory.js sync`): step 1 runs `npx --no-install factory ticket branch N` and uses its output, BRANCH, in `git switch -c`. Before switching, it runs `git ls-remote --exit-code origin refs/heads/BRANCH`, the full ref: `--heads origin BRANCH` also matches `feature/someone/BRANCH`. Exit 2 goes on. Exit 0 runs `npx --no-install factory pr for-branch BRANCH`: `#M merged`, with the sha `ls-remote` printed equal to `npx --no-install factory pr view M --field head`, deletes the branch with `git push origin --delete BRANCH`, says `Branch BRANCH's pull request #M merged; replacing it.`, and goes on; `#M open` stops with `Branch BRANCH is already on origin, with open pull request #M. Work it with /factory-address-review M`; anything else stops with `Branch BRANCH is already on origin. Delete it with: git push origin --delete BRANCH`. A stop runs `factory ticket stop N "reason"` and posts nothing else. A local branch of the same name is deleted with the remote one in the merged case, and otherwise stops the build the same way, naming `git branch -D BRANCH`. Step 2 and the archive step use `npx --no-install factory specs change-name N`, read once in step 2. No skill, agent, or rule spells `issue-N-short-slug` afterwards: grep for it. Check that the commit guard (`src/guard-commit.mts`) lets `git push origin --delete BRANCH` through for a branch that is not the default; it blocks only force pushes and pushes to the default branch.
- `.claude/factory.yaml` here: `code-host:` block with `type: github` and `branch-name: "{ticket}"`.
- The docs: as Spec lines 24 to 26.

## Contracts

- Setting: `code-host.branch-name`, a string. Placeholders `{ticket}` and `{user}`, each replaced wherever it appears.
- `factory ticket branch N`: stdout one line, the branch; exit 0. Errors on stdout or stderr as `factory ticket view` prints its not-found today; exit 1.
- `factory specs change-name N`: stdout `issue-N` lowercased; exit 0, or 1 when specs are off.
- `factory pr for-branch BRANCH`: stdout `#N open`, `#N merged`, `#N closed`, or `none`; exit 0, and non-zero with the code host's error when it cannot be reached, as the other `factory pr` reads do.
- Line 8's check fills `{ticket}` with `1` and `{user}` with `u` before testing, so only the pattern's own text can fault, and implements git's rules itself (from `git help check-ref-format`, with `--branch`'s leading `-`), with no call to git: settings parsing stays pure. A test runs `git check-ref-format --branch` on one example of each REASON and asserts git refuses it too, and on the valid patterns in the docs and asserts git accepts them.
- Line 12: `signedInAs()` (`src/code-host/github.mts:637`) is `GET /user`. The GitHub implementation turns `gh` exiting 4, which it does with no token, printing `To get started with GitHub CLI, please run:  gh auth login`, or an `HttpError` of 401, into one error type the command maps to line 12's message (fake both in `tests/fake-gh.ts`); every other error passes through unchanged. A GitHub App installation token gets a 403 there, which passes through: the build token is a personal access token (`docs/github/by-hand.md`, the secrets table).

## States

The pattern is missing, faulty (lines 4 to 8), or valid. Missing and faulty stop every command that reads settings, as any settings error does; valid lets `factory ticket branch` print. A build's branch is absent from `origin` (the build goes on), present with a merged pull request and nothing pushed since (the build deletes it and goes on), or present otherwise (the build stops).

## Edge cases

- A preset with a different `code-host.type` replaces the whole block, `branch-name` included (`openspec/specs/presets/spec.md`, line 65's requirement).
- `{ticket}` twice in a pattern: both replaced.
- An empty string: line 7.
- A GitHub login is letters, digits, and single hyphens, so `{user}` never makes an invalid branch; no sanitizing.
- A ticket key with capitals, from a later ticket system: `{ticket}` keeps its case in the branch; `change-name` lowercases it.
- The lock written by an older version has no `branch-name`: commands reading it stop with line 1's message until `factory sync` runs on settings that have it.

## Risks and rollback

- Every repository's next update stops until `branch-name` is set: that is the decision, and #53's path is how it is met. If the path fails in the field, the first change is `factory-deps`'s issue text, not the requirement.
- A build in GitHub Actions needs `gh` signed in for `{user}`: check that `factory-build.yml` passes the build token to the agent's `gh` (it passes `github-token` to the action at line ~48); if not, the build fails at step 1 with line 12's message, which names the fix.

## Dependencies

- Blocked by #53 (Decisions). Nothing open waits on this ticket.
- No owner-only step.
