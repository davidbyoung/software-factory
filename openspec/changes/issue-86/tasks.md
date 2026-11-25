# Tasks

## 1. One reading

- [ ] 1.1 `readYaml` and the naming function in `src/config.mts`, used by `resolveFiles`; `buildHosts` prefixed. Verify: `tests/config.test.ts`, for line 26 and that every fault `parseSettings` throws starts with the file.
- [ ] 1.2 `preset: true` in `parseSettings`. Verify: `tests/config.test.ts`, a pass and a fail for each half in lines 3 to 10.
- [ ] 1.3 `presetFaults` cut to the preset-only rules, `unknownKey` removed, and the shared preset function added. Verify: `tests/preset.test.ts` as it stands passes, with lines 11, 14, 15, and 16 added.

## 2. The readers

- [ ] 2.1 `preset check` (lines 1 to 12, 25). Verify: `tests/preset-commands.test.ts`, "factory preset check", the ticket's three lines first, seen red.
- [ ] 2.2 `preset add` (12, 13). Verify: `tests/preset-commands.test.ts`, with a value the repository's own file replaces.
- [ ] 2.3 `update` (17, 18). Verify: `tests/update.test.ts` for what is printed, and `tests/preset-fetch.test.ts` that the lock is as it was when the second of two presets is refused.
- [ ] 2.4 The poller (23, 24). Verify: `tests/poller.test.ts`, "an organization's preset, as its one poller reads it".
- [ ] 2.5 `init` (19 to 21). Verify: `tests/init.test.ts`, and `tests/init-presets.test.ts` with `presetSource` on a real pinned preset.
- [ ] 2.6 `init --org` (22). Verify: `tests/init-org.test.ts`.

## 3. One test for all of them

- [ ] 3.1 `tests/settings-readers.test.ts`: a table of bad values, one for each shape of message (a key, a list item, no key, an unknown key, a version, GitHub as a host, and broken YAML), each given to every reader line 27 names, asserting the same words. Verify: adding the fault to one reader alone turns it red.

## 4. Docs

- [ ] 4.1 `docs/presets.md`, `docs/cli.md`, and `docs/configuration.md`, as "The docs that change" shows. Verify: the docs tests in the gate.

## 5. Finish

- [ ] 5.1 Map each Spec line to its test and write any that is missing.
- [ ] 5.2 Run the `factory-trace` skill: the poller's and the updates' code decide what runs.
- [ ] 5.3 `factory gate` and `npm run pack-check`.
