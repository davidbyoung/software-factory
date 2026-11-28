# Tasks

## 1. The product-name test

- [x] 1.1 Write the test of Spec line 1 in `tests/product-name.test.ts`, reading the files it names and the string literals under `src/`, with its list of allowed files. Run it and watch it fail on today's text.

## 2. The package and the command

- [x] 2.1 `package.json`: `name` `@kodor-ai/kodor`, `bin` `{ "kodor": "bin/kodor.js" }`, `repository.url` `git+https://github.com/kodor-ai/kodor.git` (Spec 2). A test reads `package.json`.
- [x] 2.2 Start the specs with `node bin/factory.js specs new 130`, before anything is renamed. Then, in one command: `git mv bin/factory.js bin/kodor.js`; in `.claude/settings.json`, change each `bin/factory.js` to `bin/kodor.js` by hand, so the session's hooks keep running; `git mv` this repository's three settings files to `.claude/kodor.yaml`, `.claude/kodor.lock`, and `.claude/kodor.choices.yaml`; and change `bin/launch.js`, `src/config.mts`, `LAUNCHER`, the other places that name the launcher, the `check` script in `package.json`, and `tests/pack-check.mts` to the new paths. Set `repository: kodor-ai/kodor` in `.claude/kodor.yaml`. Do not run `sync` until 7.2: before the names it writes have changed, it would write the old ones again. Then change the rest of `bin/launch.js`: `KODOR_VERSION`, the cache folder, the package it downloads, and its messages (Spec 3 to 8). Update their tests, red first for each changed message.

## 3. Settings, label, and what sync writes

- [x] 3.1 The label key `tickets.labels.kodor` with default `kodor`, in `src/config.mts` and `settings.schema.json` (Spec 13, 14). Tests in the config and labels tests.
- [x] 3.2 Rename `skills/factory-*` and `agents/factory-*` to `kodor-*`; the rules path and `IMPORT_LINE`; `.github/kodor-review.md`; the hooks and `WORK` in `.claude/settings.json` (Spec 15, 16). Tests in `tests/sync.test.ts`.
- [x] 3.3 `src/workflow-files.mts` and the workflows edited in place: file names, titles, job ids, the job "kodor files in step", `uses:` homes, and every `FACTORY_` name to `KODOR_` (Spec 17 to 20). Tests read the YAML, as `tests/release-workflow.test.ts` does.
- [x] 3.4 The settings version: `src/config.mts` accepts `version: 1` only, and tells a `version: 2` file to see "Moving to kodor" through a `DOCS_PAGES` entry in `src/lib/docs-page.mts` in place of `settingsVersion2`; `src/init.mts`, `src/init-org.mts`, and `src/preset.mts` write and assume `version: 1`; `settings.schema.json` and every example under `docs/` but the upgrade notes below "Moving to kodor" say `version: 1` (Spec 9 to 12, 31). Tests in `tests/config.test.ts` and the init tests, red first, and the fixtures that write `version: 2` change to `version: 1`.

## 4. Setup

- [x] 4.1 `kodor init`'s first line, branch, titles, ruleset, and signing key (Spec 21, 22). Tests in `tests/init*.test.ts`.
- [x] 4.2 `kodor init --org`: `kodor-config`, its description, the board, the property, the App's name and address, and `kodor-preset.yaml` (Spec 23, 24). Tests in `tests/init-org.test.ts` and the preset tests.

## 5. Folders, credentials, image, updates, and addresses

- [x] 5.1 The work folder, the credentials file, the guard's path, `KODOR_JIRA_*`, and the `User-Agent` (Spec 25, 26).
- [x] 5.2 `POLLER_IMAGE`, the poller's variables, and `release.yml`'s registry checks, tarball address, and image tags (Spec 27). A test reads `release.yml`.
- [x] 5.3 `src/update.mts`'s branch, title, and lines, and `FACTORY_REPOSITORY` in `src/lib/docs-page.mts` (Spec 28, 29).

## 6. Prose and docs

- [x] 6.1 Every printed string, and the text of `skills/`, `agents/`, `rules.md`, `review.md`, and `approval-policies/`, says kodor (Spec 1). The sync runs in 7.3.
- [x] 6.2 `README.md` and "Moving to kodor" as "The pages" under Proposed docs, `docs/get-started/install.md`, and every other page and `docs/developing.md` by the names, leaving the upgrade notes below "Moving to kodor" alone (Spec 30 to 32). The docs tests read commands as `kodor ...`. Run `docs-reader` on `README.md` and the new section.
- [x] 6.3 This repository's `CLAUDE.md` and `.claude/change-types.md`.
- [x] 6.4 Run 1.1's test and watch it pass.

## 7. Specs and this repository's setup

- [x] 7.1 Rename `openspec/specs/factory-label/` to `openspec/specs/kodor-label/`; rewrite the old names in `openspec/specs/`; `node bin/kodor.js specs finish 130`; `node bin/kodor.js specs check` passes.
- [x] 7.2 The other shipped files and the prefix matchers under "Where it goes", with a test for `src/remove.mts` keeping a user's own skill and removing a `kodor-` one, red first.
- [x] 7.3 Run `node bin/kodor.js sync`, the first since 2.2. It deletes the old copies under `.claude/` and `.github/` and writes the new ones. Then, by hand, as the upgrade note's reader does: delete `@.claude/factory/rules.md` from `CLAUDE.md`, and `~/.local/share/software-factory/work` from `additionalDirectories` in `.claude/settings.json`. `node bin/kodor.js sync --check` passes.

## 8. Verify

- [x] 8.1 Map each Spec line, 1 to 32, to the test that checks it, and name any line without one so it gets one.
- [x] 8.2 Compare each transcript under Proposed docs with what the command prints, in the pull request's side-by-side comparison.
- [x] 8.3 The pull request lists the owner's steps at merge and at the first release (Dependencies).
- [x] 8.4 `npm run format`, `kodor gate`, `npm run pack-check`, and `npm run site-check` pass. No end-to-end spec is added.
