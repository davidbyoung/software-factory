## 1. Settings

- [ ] 1.1 Parse `tickets.labels` and `code-host.labels` with defaults in `src/config.mts`, add them to `settings.schema.json`, and test lines 1, 3, and 4 in `tests/config.test.ts`.
- [ ] 1.2 Add the per-tool label check to `Built` and `BUILT`, run it and the duplicate check in `config.mts`, and test lines 5, 6, and 7 with a test registry whose ticket tool refuses spaces.
- [ ] 1.3 Check `factory config explain` and the lock show the five names with `# default` (line 1), in the existing explain and lock tests.
- [ ] 1.4 Recognize the unquoted `: ` YAML error and print line 23's message; test it in `tests/config.test.ts`.

## 2. Readers and writers

- [ ] 2.1 Replace every hard-coded `follow-up` and `spec` label read in the files under "Where it goes", passing names in; test line 14 (follow-ups by a configured name in `factory follow-up`, status, and the refined check) and line 15.
- [ ] 2.2 Merge policy uses the configured names; test line 19.
- [ ] 2.3 Review verdict, both guards, and `remove` use the configured override name; update the approvers tests to lines 16 to 18, and test line 12 and line 20.
- [ ] 2.4 Add the key-to-name translation to `factory ticket label`, `ticket open --label`, and `pr label`; test lines 10 and 11.
- [ ] 2.5 Print renamed labels as `NAME (KEY)`; test line 13 for `view`, `--field labels`, and `list`, and that default names print unchanged.

## 3. Sync and init

- [ ] 3.1 Rewrite the workflow's label literal in `sync.mts`; test line 8, including `sync --check` failing on a stale copy and a name with `'`.
- [ ] 3.2 Test that `factory init` writes no `labels` key (line 9) in the existing init tests.

## 4. Prose and docs

- [ ] 4.1 Rename the three pull request labels in every copied source and this repository's own skills; add the rules sentence; run `node bin/factory.js sync`.
- [ ] 4.2 Write the docs as `## Proposed docs` shows; the docs tests cover lines 21 and 22 (add a test that no docs page names the old three).
- [ ] 4.3 Run `docs-reader` on the changed `docs/configuration.md` sections.

## 5. Verify

- [ ] 5.1 Map every Spec line to its test, and name any without one.
- [ ] 5.2 `grep -rn "merge: automatic\|merge: manual\|verdict: override\|verdict(:" src workflows rules.md review.md skills agents docs README.md` finds nothing; grep `src/` for `"follow-up"` and `"spec"` and check each remaining one is not a label.
- [ ] 5.3 `npx --no-install factory specs check`, then `npx --no-install factory gate`.
- [ ] 5.4 Trace the change with `factory-trace`, since it changes the rules and the hooks.
