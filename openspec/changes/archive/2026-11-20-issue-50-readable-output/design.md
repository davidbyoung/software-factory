# Design

## Where it goes

- **`src/cli.mts`.** Each `COMMANDS` entry a person runs gains `group` (one of the five) and `summary` (the docs' words, as Proposed docs shows). `usage()` prints the groups in order, then a last line naming "Run for you" in `docs/cli.md`, by path: a github.com address outside the GitHub folders fails the boundary check, and the docs ship in the package; `main` prints `factory has no command "WORDS".` and a blank line first when `argv` names no command and is not `--help` or `-h`, WORDS being every argument joined by spaces; `guard WORD` with an unknown word counts as no command, as today. Usage goes to standard error, as now.
- **`src/sync.mts`.** `--check` prints its lines with painted marks, as `doctor` does; the success line goes to standard output. Line 4's sentence prints only for a person's `factory sync`: `run(argv, announce = false)` gains the flag, and `src/cli.mts`'s `sync` entry passes `true`. `init`'s `sync.run([])` (`src/init.mts`) and the preset commands, which call `main` directly (`src/preset-commands.mts`), pass nothing, so their output is unchanged.
- **`src/config.mts`.** `check` prints line 7 after the warnings, with its mark painted through `d.paint`. The design-skill warning says `factory sync`.
- **`src/board.mts`.** `inspectBoard` keeps `problems`, `notes`, and `lines` as they are, since `doctor`'s board check and the sync's `apply` and `checkFields` read them. A new `boardRows` builds board check's rows, one per state, extra column, and field, each `{ state, key, text }`, beside it rather than inside it, so nothing the sync reads changes. `boardReport` prints them; `main`'s `check` exits 1 when a row is `fail`.
- **`src/columns-suggest.mts`.** The `shown` words for a state with no column follow line 10: `none, shows in COLUMN`, or `none`.
- **`src/doctor.mts`.** `Check` (in `src/setup.mts`) gains an optional `group`. `checks()` sets it where each check is made: `settings`, then the tool kind (`codeHost`, `runner`, `tickets`, `agent`), and `off` for the parts. A new `printChecks(checks, labels, paint, indent)` returns the lines with headings, used by `main` and by `init`. The secret lines are merged by name before printing. `SYNC` and `INIT` drop `npx --no-install`.
- **`src/agent/claude-code.mts`, `src/tickets/github-setup.mts`.** Drop the `${LABEL}: ` prefix from the check texts, and `npx --no-install` from fixes. Any other tool that prefixes its label and a colon drops it too; the heading carries the name.
- **`src/code-host/github-setup.mts`.** The sign-in check reads `Signed in as LOGIN`, or fails `Signed in`.
- **`npx --no-install` in messages for a person:** `AGAIN` and the no-board message in `src/init.mts`, `Run: npx --no-install factory init` in `src/preset-commands.mts`, the design-skill warning in `src/config.mts`, `sync --check`'s last line, and the fixes in `src/doctor.mts`, `src/agent/claude-code.mts`, and `src/tickets/github-setup.mts`. `SYNC` in `src/preset.mts` and `src/npmrc.mts` stay.
- **`src/init.mts`.** The closing checks print through `printChecks` with an indent of 2. `AGAIN` drops `npx --no-install`.
- **`src/explain.mts` / `src/config.mts`.** The two header lines are printed at the `explain` print site, before `paintExplainLines`' output, so they are dimmed as comments; neither `explainLines` nor the lock includes them.
- **`src/site.mts`.** `stopKept` (`src/site/servers.mts`) already returns whether it stopped anything. An exported `stopMessage(stopped)` gives line 28's text, and `site stop` prints it.
- **`src/commands.mts`.** `Deps` gains an optional `paint`, set by `run` from `colorOn()`, as `board.mts` does. `exec` adds `npm_config_loglevel: "warn"` to the environment unless set; one run here showed it hides `npm notice run` lines, which npm 11 prints in place of the old `> script` banner, and nothing else. `gate`, `test-one`, `end-to-end`, and `specs check` print their closing line with a painted mark, a pass on standard output and a failure on standard error; the gate's failure line changes to the `✗ The gate failed on:` text. The `npm notice run 'factory' ...` lines from an outer `npx --no-install factory` print before the factory starts, so only a person's global install shows the clean transcript.
- **`docs/developing.md`.** Add "### A command's output" after "### A page a reader follows", with the text Proposed docs quotes.
- **`CLAUDE.md`.** Under "Rules by area", the `docs/developing.md` line reads: "how the package is laid out, how to run it from source, how to change a skill or add a ticket system, how a command's output reads, and how to release." Wording only, so no `factory-trace`.
- **`.claude/skills/dx-first/SKILL.md`.** Step 2's first bullet adds: "Each transcript follows "A command's output" in `docs/developing.md`, not the rules for a page."
- **Docs that quote changed output:** `docs/cli.md` (the `gate`, `sync --check`, and `specs check` rows, the `gate failed on` sentence, and a table of `board check`'s words: `synced`, `skipped`, `off`, `none, shows in`, and `no state`), `docs/configuration.md` ("prints nothing" for `config check`, and `gate failed on:`), `docs/updating.md` ("prints nothing", "out of sync"), `docs/quick-start.md` (`gate failed on`), `docs/existing-repo.md` (board check's "any problem").

## Contracts

- Exit codes are unchanged everywhere. Standard output and standard error keep today's split, except the new success lines, which go to standard output.
- `npm_config_loglevel=warn` is set only for settings commands the factory runs, never for its own process.
- The usage's docs link is a fixed URL to `main`.

## States

`board check` rows: `pass`, `fail`, `unknown` (`?`), `off` (`-`), and `none` (no mark, when the Status field is missing). `doctor`'s groups are fixed and printed in order, skipping empty ones.

## Edge cases

- A tool with no checks prints no heading.
- `doctor` with invalid settings prints one check under `Settings and files`.
- A part whose secret is shared by the organization reads `is set by the organization, for A and B`, as today, once.
- `factory sync` that writes files keeps today's `wrote` and `deleted` lines, which `preset add` and `remove` print as their own.
- `sync --check` with 1 file differing uses `doesn't`.

## Risks and rollback

A skill or workflow that matched an old line breaks. Search `skills/`, `agents/`, `rules.md`, `workflows/`, and `actions/` for `gate failed on`, `Claude Code: `, `Problem:`, `written`, and `Run npx --no-install factory` before building; the commit guard's own message is separate and unchanged. The rollback is the revert of the pull request.

## Dependencies

None, and no owner-only step.
