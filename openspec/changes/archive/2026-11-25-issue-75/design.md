# Design

## Where it goes

- **`src/lib/changes.mts` (new):** the change (lines 6 to 8, 14, 15), `$BASE`, and the folder expansion (line 2: `git ls-files` and `git ls-files --others --exclude-standard`, cut to the first name under the pattern's parent, kept only where the folder exists). Pure functions over a `git` dependency, as `src/handoff/bundle.mts` takes one.
- **`src/lib/plan.mts` (new):** given a setting's commands, the change, the gate's commands, and `commands.ignore`, which run and why (lines 9 to 13, 17, 18). One function every command uses, so the covered rule has one home.
- **`src/config.mts`:** `commandsOf` parses text, an item, or a list (items as `{ run, in, files, report? }`); `SETTINGS_KEYS` gains `commands.ignore`; `Site` becomes a list; a preset entry takes `{ name, in }`; the `config check` stops and warnings (lines 19 to 26) beside `patternWarnings`. `settings.schema.json` matches, as its test requires.
- **`src/commands.mts`:** `gate`, `test-one`, `end-to-end` run through the plan; new `coverage`, `relock`, `build-setup` subcommands, each with an entry in `src/commands-list.mts` and `src/cli.mts`. Output through `src/lib/output.mts`.
- **`src/pr.mts`:** the uncovered-line reading `factory pr uncovered` does (line 751) is shared with `factory coverage`, taking the diff's base and the working tree (line 40) and a folder for `parseLcov`. `factory pr uncovered` keeps its own behavior.
- **`src/guard-commit.mts`:** before-commit through the plan, with line 7's change and line 49's line.
- **`src/site.mts`:** a list of sites, `--site`, the folder under the run's directory (line 53).
- **`src/preset.mts` (`combine`, `STEPS`, `single`) and `src/preset-commands.mts` (`RUNS`):** folder presets (lines 58 to 66).
- **`src/explain.mts`, `src/init.mts` (`runGate` runs as `--all`), `src/sync.mts` (`NEEDS` for `end-to-end` with any command).**
- **`.github/workflows/session.yml`:** `factory build-setup` in place of the read-and-loop at line 296. Edited where it is, not synced.
- **Skills, through their source and `node bin/factory.js sync`:** `factory-address-review` 1b (`factory coverage`); `factory-resolve-conflicts` and `factory-deps` (`factory relock`); `factory-design` (`factory relock --all`, `factory build-setup`); `factory-build` step 5 (read the plan; report a file to cover, never add it to `commands.ignore`; and for each new end-to-end file run `factory end-to-end FILE`, which picks the command, in place of reading `factory config get commands.end-to-end` as a command to run); `factory-mutate` (test-one wording); `factory-ui-reviewer` (several sites).
- **Docs** from the comment's Proposed docs, at the real pages' heading levels (lines 68, 69), `docs/presets.md`, `docs/cli.md`, `README.md`.
- **Specs:** `factory specs new 75`, written from the Spec above, with each "No longer" line changing the existing requirement it names.

## Settled after the readiness reads

These are the builder's calls, made in refinement so the build needs no question. Each extends the Spec line it names; write a test for each.

- **Plan lines print only when a setting has a command with `in` or `files`** (line 18). Otherwise every command, new ones included, prints `$ COMMAND` before each and its closing line, as `factory gate` does today: `factory gate --all` and `--dry-run` on an all-text gate print no header, and `--dry-run` lists each command as `runs ... every change`. A single `coverage: {run, report}` with no `in` is in this case.
- **One row per item, one count per folder.** T and R count each folder's command. An item that runs in one folder is the row `cd FOLDER && COMMAND`; in several, `COMMAND, in R' of the N folders of IN` (or `in each of the N folders` when all), with the first matching file as its reason. A failure line's count is of the folders it ran in.
- **The other settings' plan cases** (lines 34, 35) word as the gate's, with the setting's key: `commands.relock: 0 of T run, since nothing changed since origin/DEFAULT` and `✓ Nothing to check.`; `factory coverage` with only ignored files ends `✓ Coverage ran: nothing it covers changed.`; `factory site compare` with nothing to picture ends `✓ No site changed.`
- **A settings file change runs every command** (line 12) whether or not the gate has an item: it is the one way to try a command a pull request adds.
- **Long lists are capped.** Line 26 prints at most 20 path lines, folders first then files, each in name order, a folder shown as the shallowest folder whose tracked files are all uncovered, then `  and N more paths`. Line 31 lists at most 10 files, then `  and N more`.
- **Line 24's rule:** it warns when a root pattern in `files` starts with the item's own `in` pattern and a `/`, such as `packages/*/src/**` on `in: packages/*`. `packages/shared/**` doesn't, so it doesn't warn.
- **A coverage item in a list needs `report`:** `factory config check` fails with `.claude/factory.yaml: commands.coverage[N].report: is required in a list`. A preset's coverage items need the same; the existing "Part of site, or of coverage" pass applies to a single map only.
- **`factory test-one` and `factory end-to-end` ignore `commands.ignore`:** they take a file, not a change.
- **`factory config explain`** writes `commands.ignore` only when it is set, so a repository with no items sees no new line (line 67, and draft §1's rule).
- **`factory config get site` and `site.KEY` with a list** print one line per site, `FOLDER: VALUE`; one site prints as today. `factory-refine`'s and `factory-design`'s reads of `site` are updated with the skills under Where it goes.
- **Folder presets:** `--in` repeats for several folders (`--in 'services/*' --in 'workers/*'`), written as a list. A preset item with its own `in` runs in `PRESET_FOLDER/ITEM_IN`. Reviewer `files`, `site.design-guide`, and every path a folder preset gives are read from each folder, and a pattern `in` expands on disk, as line 2 says. The summary's row for a folder preset's command reads as today's runs line with `, in IN` after it, such as `at the gate, in services/*`.
- **Presets listed twice:** "A preset listed twice" and "A preset already listed" still refuse the same name with the same `in`, or with no `in` twice, with today's messages, adding ` --in IN` after the name when there is one. The same name with a different `in` is a second entry.
- **More existing requirements that change**, each changed by the Spec line in brackets when `factory specs new 75` writes the spec: `commands` "Config get a command" (line 50), `cli-output` "The gate says it passed" (line 30's ending when commands are left out), `settings` (accepts `commands.ignore`, items, a list of sites, and `{ name, in }` in `presets`), `init-presets` and `tool-setup` (`init` checks the gate as `--all` does), `presets` "Part of site, or of coverage" and "The summary's runs lines" (above), and `cloud-run` "Setup before the session" (the session's job runs `factory build-setup`).
- **Lines 68 and 69 are checked by the docs tests** (headings exist, anchors resolve) and by review. The first sentence of `docs/existing-repo.md` is: "Most repositories already have a toolchain, a board, instructions for a coding agent, a team, or several packages in one repository."
- **`factory-build`'s `factory config get commands.gate` check** still reads "prints nothing" as unset; a long list is fine.

## Contracts

- Item keys: `run`, `in`, `files`, and `report` on coverage only. Site keys: today's plus `in`, `files`. Preset entry: a string, or `{ name, in }`.
- Environment: `$BASE`, `$FILE` (from the item's folder), `$NAME`, `$PORT` as today.
- Output lines exactly as the Spec gives them, with the count rule above the Spec.

## States

A setting is either all text (behaves as today, line 18) or has an item. A run is one of: can't tell (every command), settings changed (every command), uncovered file with a gate item (every command), ignored only, nothing changed, or matched. The first that applies, in that order, decides; `--all` skips all of them.

## Edge cases

Deleted package (its folder is gone, so it is not expanded, and its deleted files are covered by nothing: every command runs); a new package (line 2 counts untracked folders); two items on one folder (two commands); a rename (both names, `--no-renames`); a pattern `in` with no folder (warning, runs nothing); a shallow clone (line 15); no commit yet (line 7); an all-text gate (line 11).

## Risks and rollback

The risk is a gate that passes without running a check. Lines 10, 12, and 14 run everything when unsure; a test for each fails if they skip. Rollback is reverting the pull request: settings with no items never reach the new code.

## Dependencies

None. No open ticket blocks this one or waits on it.
