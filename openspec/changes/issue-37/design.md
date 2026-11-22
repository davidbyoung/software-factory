# Design

## Where it goes

- **`src/specs/`, new, following `src/tickets/`'s pattern** ("Adding a ticket system" in `docs/developing.md`): `types.mts` holds the `SpecTool` type, `openspec.mts` its one adapter, and `index.mts` the registry by name. Nothing outside `src/specs/` names OpenSpec's commands or folders, except `config.mts`'s list of names, which it takes from the registry.
- **`SpecTool`** gives: `name` (`OpenSpec`, for init's messages); `label` (init's option text); `install` (`package`, `@fission-ai/openspec`; `via`, `npm install --save-dev`; `argv`, the command run; and `installed(root)`, which for OpenSpec reads `package.json`'s `dependencies` and `devDependencies`); `defaultCheck`; `env` (`{ DO_NOT_TRACK: "1" }`); `processFiles` (`["openspec/config.yaml"]`); `runs(root)`, whether its command runs, for line 8; `list(root)`; `start(root, n, labels)`, returning the folder, whether it existed, the files with `new` or `update` and their text, and the "Then:" line; and `finish(root, n)`. A tool's prerequisites and what a cloud build needs, from the portability table, are for the ticket that adds such a tool: OpenSpec needs neither, and nothing here reads them.
- **`src/tool-names.mts`**: `BUILT` gains `specs: ["openspec"]`, and `config.mts` builds `SPECS` as `["none", ...BUILT.specs]`, so `factory config check`'s message stays `specs must be one of none, openspec`. `OPENSPEC_CHECK` moves to the adapter's `defaultCheck`. `settings.schema.json`'s enum follows; `tests/settings-schema.test.ts` holds them equal.
- **`src/tools.mts`**: `Registry` gains `specs: Record<string, SpecTool>`, so `init` and the command tests take a fake adapter, as they do a fake ticket system.
- **`src/commands.mts`**: `specs-list`, `specs-new`, and `specs-finish` beside `specs-check`; `specs-change-name` goes. `specs-new` reads ticket N's labels through `openTickets`, the way `factory ticket` does, to choose line 5 or line 6. `src/cli.mts` gains the three word entries and the help lines (line 16), and loses `change-name`.
- **`src/init.mts`**: the question after `askBranchName`. "The settings in effect have `specs`" means the settings file or any preset it follows writes a `specs` key, `specs: none` included; `Settings.specs` cannot tell, since it defaults to `none`. So `presetSpecsAt`, beside `presetBranchNameAt`, resolves the layers as that does and reports whether any layer's raw document has `specs` (the resolution's per-key sources, or the merged raw document, whichever `resolveFiles` exposes; add a field to its result if neither does). The answer is written with `doc.set("specs", ...)` beside the branch name's write. The install runs after `package.json` and the settings are written and before the sync, through a new `InitDeps.install(argv)` returning the exit status and the command's standard error, so tests stub it. Line 23's step goes first under "Left to do".
- **`src/merge-policy.mts`**: `FACTORY_FILES` takes every adapter's `processFiles`, whatever `specs` is set to, in place of the literal `openspec/config.yaml`, so the held files don't depend on the settings a pull request could change. It is code that decides who merges: the trace covers it.
- **Skills, agents, and rules** (sources, then `node bin/factory.js sync`):
  - `rules.md`, "Spec track": the `spec` label applies whatever `specs` says; the spec tool only adds the copy in the repository. The `DO_NOT_TRACK` paragraph goes (the adapter sets it). "Small changes": "No OpenSpec change either, unless the change makes a line of your specs false" reads the same with `specs: none`, where there are no written specs.
  - `skills/factory-refine/SKILL.md`: drop "The `spec` label is used only when ... prints `openspec`"; step 0 runs `npx --no-install factory specs list` in place of `openspec list --specs`, and reads each file it prints; step 1's Track adds `spec` with either value; step 2 names capabilities "as `factory specs list` names them, or a new one in the same style".
  - `skills/factory-build/SKILL.md`: "The spec track applies only when ... `openspec`" becomes "the `spec` label decides the track"; step 2 runs `npx --no-install factory specs new N`, writes each file it lists as it says, runs its "Then:" line, and commits; with `specs: none` the command prints its `-` line and the step ends there. Step 4 records the Spec-line-to-test mapping in the pull request body for every `spec` ticket, then runs `npx --no-install factory specs finish N` and `factory specs check`. Step 6's "name the spec it changed under `openspec/specs/`" applies only when `finish` folded one.
  - `agents/factory-ticket-readiness.md`: the `spec` label check no longer depends on `openspec`; it reads the files `factory specs list` prints in place of `openspec/specs/<capability>/spec.md`.
  - `skills/factory-resolve-conflicts/SKILL.md`: its mention of `openspec/` stays a path, not a command, so line 15 does not catch it.
- **This repository's `CLAUDE.md`** ("Spec track: this repository") names `DO_NOT_TRACK=1` for OpenSpec; it now comes from the adapter, so that sentence goes.
- **Docs**: as Proposed docs shows; "Adding a spec tool" in `docs/developing.md` mirrors "Adding a ticket system": the four rules (nothing runs the tool but its adapter, the folder, the registry, and the table of what an adapter gives).

## Contracts

- `specs` values: `none`, `openspec`. The change folder: `openspec/changes/issue-N/`, N lowercased. Archived changes: `openspec/changes/archive/<date>-issue-N/`, as `openspec archive NAME --yes` names them.
- `list` reads `openspec/specs/*/spec.md` itself. The OpenSpec commands the adapter runs, each with `DO_NOT_TRACK=1`: `npx --no-install openspec new change issue-N`; `npx --no-install openspec archive issue-N --yes`; `npx --no-install openspec --version` for `runs`.
- Usage lines follow `USAGE` in `src/commands.mts`: arguments are checked before the settings are read, as `specs check` does today.
- The `-` line, `✓`, and `✗` marks follow "A command's output" in `docs/developing.md`, painted as `src/lib/color.mts` paints the other commands.

## States

A ticket's spec change, with OpenSpec: not started (no folder) → started (`openspec/changes/issue-N/`, by `new`) → folded (`openspec/changes/archive/*-issue-N/`, by `finish`). `new` on a started change and `finish` on a folded one change nothing and exit 0 (lines 7 and 10). With `none` there are no states.

## Edge cases

- A build that restarts after `new`: line 7 lets it carry on. After `finish`: line 10.
- Ticket N that doesn't exist: line 13's order, so `new` prints the ticket system's not-found message before it looks at OpenSpec or the folder.
- npm's output: `InitDeps.install` returns the exit status and npm's standard error, the stream npm writes its errors to; line 23 prints its last five lines.
- A repository with no `package.json` and OpenSpec chosen: init writes its private `package.json` first (it already does), then installs into it.
- `specs` set as a block (`type: openspec`, `check: ...`): the adapter is `specs.type`'s, and `check` stays the settings' value.
- A preset that sets `specs`: line 20, so init neither asks nor overrides.
- `specs: openspec` written by hand after init: the next `factory init` shows the `Install` row (line 21).

## Risks and rollback

- Every repository that installs the factory builds its `spec` tickets through the rewritten build skill. If `factory specs new` or `finish` misbehaves, spec builds stop at step 2 or 4 with its `✗` line, not silently. Rollback is the previous release.
- Repositories with `specs: none` start getting the `spec` label and the longer body on large changes. That is the intent; a repository that wants the old shape has no switch (not asked for).
- `merge-policy.mts` holds the adapters' process files: a mistake there could let `openspec/config.yaml` merge without the owner. `tests/merge-policy.test.ts` keeps a case for it.

## Dependencies

None. No owner-only step. No open ticket blocks this one or waits on it.
