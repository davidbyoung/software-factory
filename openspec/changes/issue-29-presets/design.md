# Design

## Where it goes

- **`src/preset.mts` (new).** Finding a preset: NAME is a package name (two segments when it starts with `@`), then an optional folder path. The package's folder is resolved from the repository's root with `createRequire`, as `hasPackage` in `src/config.mts` does, and the preset's file is `factory-preset.yaml` in that folder. `resolve(defaults, presets, own, choices)` returns the combined raw settings, a provenance map from each key path (and each list item) to its source, and the agent and skill files to write. The `preset` commands (`add`, `remove`, `choices`, `choose`, `check`, `changes`) live here too, each with a `main(argv, deps)` taking injected dependencies (npm, terminal, files), as `src/init.mts` does.
- **`src/config.mts`.**
  - `loadSettings` reads the lock's `settings` and passes them to `parseSettings`. Before that it runs the stale check of Spec lines 4 to 7 and throws a `SettingsError` with its message, so every reader, the commit hook included, stops the way it already stops on unsound settings. `FACTORY_LOCK` and `FACTORY_SETTINGS` are read in `defaultDeps`.
  - `factory config check` and `factory sync` resolve from the files instead. They validate each preset's raw settings against `SETTINGS_KEYS`, with the refusals of lines 24 to 27, before combining.
  - `parseSettings` accepts `presets` (a list of strings) and `off: true` on a plugin entry. `pluginsOf` leaves out a plugin marked off.
- **`src/explain.mts`.** `explainLines` takes the provenance map in place of the raw file. Its `sets(raw, path)` becomes a mark function: `# default`, `# NAME`, `# NAME, chosen over OTHER`, `# NAME, not chosen yet`, `# over NAME`, or no comment. `factory config explain` prints the lock's `settings` (line 65). `factory sync` writes the lock from the same lines.
- **`src/sync.mts`.**
  - `lockText` writes the new shape as YAML, and `lockedFiles` parses it as YAML, since its line pattern would read `presets` items as files.
  - `plan` adds each preset agent and skill to the files it writes, keeps a file the repository wrote itself (line 23), and drops stale choices (line 54).
  - A new `withPresetPackages`, beside `withRules`, writes the preset packages into `factory-deps-auto-merge.yml`'s exclusion, as one more `!contains(steps.meta.outputs.dependency-names, 'PACKAGE')` line per package.
- **`src/session-start.mts`:** prints the stale message as a warning instead of failing. **`src/guard-commit.mts`:** already stops on a `SettingsError`, so it blocks (line 8). Check that `guard-permission` and `guard-ticket-text` don't read settings, so a stale lock never stops a session from running `factory sync`.
- **`src/doctor.mts`:** reads the lock as YAML for its version check, and adds one line per preset, as Proposed docs shows. **`src/remove.mts`:** line 67. **`src/deps.mts`:** reads preset packages from the lock (line 59). **`src/review-tools.mts`:** reads `FACTORY_LOCK` (line 11).
- **`workflows/factory-claude-review.yml`,** step "List the tools the review may use":

  ```bash
  if git show "$BASE:.claude/factory.lock" 2>/dev/null | grep -q '^settings:'; then
    git show "$BASE:.claude/factory.lock" > "$RUNNER_TEMP/factory.lock"
    export FACTORY_LOCK="$RUNNER_TEMP/factory.lock"
  else
    # today's lines, with FACTORY_SETTINGS
  fi
  ```

- **`skills/factory-deps/SKILL.md`,** step 4: a pull request that updates a preset gets the same handling as the factory's, posting `npx --no-install factory preset changes origin/DEFAULT` as its comment. Edit the source, run `node bin/factory.js sync`, and commit both.
- **`src/cli.mts`:** the `preset` commands, each a row in the command table.
- **`settings.schema.json`:** `presets`, and `off` on plugin entries.
- **Docs:** line 68. `docs/presets.md` is copied from Proposed docs, with its headings two levels shallower.

## Contracts

- **`overridden` in the lock:** a map from each key path (a list item as its list's path and the item, a file as its path) to a list of `{from: LAYER, value: V}`, one per layer whose value was replaced, in layer order. LAYER is a preset's NAME, `default` for the factory's default, or `.claude/factory.yaml`. `preset changes` reads it at REF and in the working tree, so it never needs an old preset installed.

- **The lock:**

  ```yaml
  # Written by `factory sync`: the factory's version, the presets, the
  # settings in effect, and the files it wrote. Do not edit.
  version: 0.5.0
  presets:
    - name: "@acme/factory-preset"
      version: 1.4.0
  settings-hash: sha256:3f9a...
  settings:
    version: 2
    repository: acme/billing
    rules:
      small-change-lines: 40 # @acme/factory-preset
  files:
    - .claude/skills/factory-build/SKILL.md
  ```

- **`settings-hash`:** `sha256:` and the hex SHA-256 of `.claude/factory.yaml`'s bytes, a NUL byte, then `.claude/factory.choices.yaml`'s bytes, or nothing for a missing file.
- **`.claude/factory.choices.yaml`:** a flat YAML map from a dotted setting path (`rules.small-change-lines`) or a file path from the root (`.claude/agents/x.md`) to a preset NAME. A plugin is keyed by its list's path and its name, `plugins.build.reviewers.security-reviewer`.
- **Preset files:** `PACKAGE/FOLDER/agents/NAME.md` is written to `.claude/agents/NAME.md`, and `PACKAGE/FOLDER/skills/NAME/` to `.claude/skills/NAME/`, every file in it.
- **The registry in `preset add`'s error:** `npm config get @SCOPE:registry`, then `npm config get registry`. The status from npm's `E401`, `E403`, or `E404` code.
- **Environment:** `FACTORY_LOCK` is a path to a lock file. `FACTORY_SETTINGS` is unchanged.
- **Editing `.claude/factory.yaml`:** through the `yaml` package's `Document` API, which keeps comments and order, so `add`, `remove`, and `drop` change only their own lines.

## States

- **The lock:** fresh, or stale for one reason, checked in this order: missing (line 69), no `settings` (line 7), `factory.yaml` changed (4), choices changed (4), a preset not installed (6), a preset's version differs (5). The first that applies is the message. The installed-version checks run only where `node_modules` exists.
- **A disagreement:** not chosen yet (the later preset applies), chosen, or dropped (line 54).
- **`preset add`:** package not installed or already installed, then installed, then summarized, then applied or declined. A decline returns to the first state.

## Edge cases

- Two presets from one package share one install, and `preset remove` keeps the package while another listed preset is in it.
- A preset with no `agents/` or `skills/` folder.
- A plugin named in a preset and in `.claude/factory.yaml`: the repository's entry applies, as a single value does.
- A preset that sets a single-value plugin role, such as `plugins.refine.refiner`: chosen as a single value.
- A `.claude/factory.yaml` with no `presets`: the lock still gets `presets: []` and `settings`, and nothing else changes.
- A list item's mark when two layers add the same value: the first layer's.
- `factory sync` makes the lock's `settings` with an `exists` that also counts the files this sync writes, such as the design skill, so the lock and `config explain` after the sync print the same lines (line 65).
- A merge conflict in the lock: resolved by deleting it and running `factory sync`, which loses nothing, since choices live in their own file.
- `preset add` interrupted after the install and before applying: the next `factory sync` is unaffected, since `presets` didn't change, and the package is an unused dev dependency.

## Risks and rollback

- **Every command stops in a repository whose lock is stale or from an earlier release.** The update pull request's sync fixes it, and doctor names it. To roll back, revert the release. A repository on the earlier release reads `factory.yaml` as today.
- **Settings read wrongly from the lock change behavior everywhere.** The test that the lock's `settings` and `config explain`'s output are the same lines, and that parsing them gives the same `Settings` as resolving the files, guards it.
- **A preset update merged by itself.** Covered by the test for line 14.

## Dependencies

- Nothing open blocks this. #31 waits on it, recorded on #31.
- No owner-only step.
- The pull request changes workflows, a skill, and the code that reads settings, so it gets a `factory-trace` before it is marked ready, and `docs-reader` reads `docs/presets.md` and the changed sections.
