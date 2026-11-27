# Tasks

## 1. Start the spec

- [ ] 1.1 Run `factory specs new 125` and write Spec lines 1 to 20 into it; `factory specs check` passes.

## 2. Printed addresses, red first

- [ ] 2.1 In `tests/init-pull.test.ts`, `tests/config.test.ts`, `tests/cli.test.ts`, and the `factory init` and `factory init --org` tests that assert the Free plan, secrets, and `--org` closing lines, change each expected address or line to Spec lines 13 to 18, and watch each go red.
- [ ] 2.2 Add the table of pages beside `docsPage` in `src/init-shared.mts`, point every caller at it, and make `src/config.mts` and `src/cli.mts` print addresses. The tests from 2.1 go green.
- [ ] 2.3 Add a test that reads each entry of the table and fails when its file under `docs/`, or its heading, is missing. Watch it go red against today's `docs/` (the new paths do not exist yet), and green after group 3.

## 3. Move the pages

- [ ] 3.1 Create the ten folders and move each section of today's pages to its new page, by "Where today's pages go", rewriting only its joins. One commit per section of the sidebar.
- [ ] 3.2 Split `docs/configuration.md` into `docs/reference/settings/README.md`, one page per top-level key, and `examples.md`, keeping each entry's anchor.
- [ ] 3.3 End each page under `docs/features/` but its `README.md` with "On your tools" (Spec line 8).
- [ ] 3.4 Write the new pages: `docs/get-started/how-it-works.md`, `docs/maintain/troubleshooting.md`, and the `docs/integrations/jira.md` stub marked Planned, and the README and the three overviews as "The pages" in Proposed docs show them.
- [ ] 3.5 Give `docs/get-started/quick-start.md` its first lines (Spec line 6) and `docs/setup/organization.md` "What each developer does next" (Spec line 7).
- [ ] 3.6 Delete each of today's pages once it is empty, and check none is left: `ls docs` shows only `developing.md` and the ten folders.
- [ ] 3.7 Fix every link: the docs tests' check for a link to a missing file or heading passes.

## 4. The docs tests and the files that name a page

- [ ] 4.1 Repoint `tests/docs.test.ts`, `tests/cli.test.ts`, and any other test that reads a page by path, to the new pages; the check that a setting links to its entry expects its page under `docs/reference/settings/`. Each passes, and a mutation that breaks one link it checks turns it red.
- [ ] 4.2 Write rules 2 and 5 under "A page a reader follows" in `docs/developing.md`, and change its settings-link rule to the new pages (Spec line 12).
- [ ] 4.3 Update `.claude/factory.yaml`'s opening comment, `CLAUDE.md`, the `dx-first` skill's examples, and the two code comments.

## 5. Read and verify

- [ ] 5.1 Run `docs-reader` on each section's new or rewritten pages, one run per section, and fix its findings.
- [ ] 5.2 Make the list of each of today's headings beside its new address, from `main`'s `docs/` and this branch's, and put it in the pull request's body; a heading with no new address is a fact lost (Spec line 4).
- [ ] 5.3 Map every Spec line to the test or the review that checks it, in the pull request's body.
- [ ] 5.4 Restate each `docs` requirement that names a page (Spec line 20), and run `factory specs finish 125`; `factory specs check` passes.
- [ ] 5.5 Run `npm run format`, `factory gate`, and `npm run pack-check`.
