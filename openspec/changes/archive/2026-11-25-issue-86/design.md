# Design

## Where it goes

- `src/config.mts`: `parseSettings` gains `preset: true` beside `partial`, which implies `partial`. It is a separate switch because `partial` is init's, whose other faults must still stop it (line 19). `buildHosts` throws through `fail`'s prefix like every other fault. `resolveFiles` uses the shared YAML reader.
- A shared `readYaml(text, file)` in `src/config.mts`, made from the `try` in `resolveFiles` and `needsQuotes`: gives the parsed value, or throws a `SettingsError` starting `FILE: `. `resolveFiles`, `readPreset`, `check` in `src/preset-commands.mts`, the poller, init, and init --org call it. Init keeps the `yaml` library's document for editing and calls `readYaml` before anything else.
- `wordsOf` in `src/config.mts`, what a `SettingsError` says after the leading `SETTINGS_FILE`, which `parsePreset` and `fromPreset` put another name before. It replaces the poller's `slice`, and init stops adding the file itself.
- `src/preset.mts`: `unknownKey` and the version rules of `presetFaults` go. `presetFaults` takes a preset's parsed YAML and gives every fault, preset-only first, then the first `parseSettings(raw, () => true, built, { preset: true })` throws. `preset check` calls it, and `readPreset`, the poller, and init --org call `parsePreset`, which reads the YAML and throws the first of them. `preset.mts` already imports `config.mts`, and `config.mts` imports `preset.mts` only inside functions: keep it so.
- `resolveFiles` calls only the preset-only rules on each pin (the pinned settings have no `version`), so line 15 holds. It also refuses a key nobody knows in a pin, as "An unknown key or version in a preset" in `presets` has it, when that is the first fault of the pin by itself: `object` throws an `UnknownKeyError` for one. When the combined parse fails, it runs the shared function on each pin, and a preset whose own message is the same, list positions aside, is named, with the preset's own text. `fromPreset` comes first, since the value's source says whose it is, and the repository's own bad value must not be blamed on a preset that has the same one.
- `src/preset-fetch.mts`: `movePin` becomes one call that pins every preset of the update before it writes the lock. `factory update`'s `main` catches `PresetError` as it catches `NoRelease`. `preset add` catches `PresetError` at `pinAt`, if it does not already.
- `src/init.mts`: `presets.combined` gives null on any error today. It gives null only when nothing is pinned or a preset can't be read, and otherwise lets the `SettingsError` through to the place that prints it.
- `src/init-org.mts`: checked where `files` is read, before "Found".
- `scheduleFault` in `src/preset-commands.mts` returns null unless the interval is one of `POLL_MINUTES`.

## Contracts

What `preset: true` lets stand, each only where the other half is `undefined`: `repository` absent; `tickets.columns` and the board's fields with `tickets.board` absent, the columns' own values still checked as with a board; `builds.poll-minutes` with `builds.trigger` absent; `specs.check` with no `specs` type, its text still checked; `site.start` and `site.url` absent; either key of `commands.coverage` absent; the two agents with `site` or `commands.end-to-end` absent. `exists` is always true for a preset, since a repository supplies the files. A repository's own settings never use this switch.

The poller's `OnceSettings` with no board still logs `No board to read: ...`, as today.

## States

n/a: no state is stored.

## Edge cases

An empty preset file, one that is a list, and one that is a line of text get `parseSettings`'s words. `code-host: github` on one line passes. `branch-name:` with nothing after it counts as left out. A preset in a folder is named by its file's path in the check and by `OWNER/NAME//FOLDER` elsewhere. Two faults in two files are both printed.

## Risks and rollback

A valid preset refused would stop an organization's builds, through the poller. Lines 3 to 8 and 23 guard it; the first thing to change is the `preset` switch. `factory preset check` and the poller on one preset must agree, which line 27's test checks.

## Dependencies

None.

## Where the build departed

- A line of the spec did not say what `factory update --pull-requests` does with the updates after a refused one: it opens them, and exits 1 at the end.
- `factory sync --check --against` compares a moved pin with its commit by `pinAt` with `valid: false`, so a value the repository replaces does not read as a pin that differs.
- Two requirements of `presets` said what the shared rules now say, and are modified to match.
