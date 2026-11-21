# Tasks

## 1. The ticket system's fields

- [ ] 1.1 Add `FieldOps` and the `fields` group in `src/tickets/types.mts`, and `supports fields`. Test `factory ticket supports fields` prints `yes` for GitHub and `no` for a memory adapter without the group (line 24).
- [ ] 1.2 Implement it in `src/tickets/github.mts`; test `list`, `read`, `write`, and clearing in `tests/tickets-github.test.ts` against recorded responses, including a single select returned with `text: false`.
- [ ] 1.3 Give `tests/memory-tickets.ts` a `fields` group.

## 2. Splitting and joining

- [ ] 2.1 `src/ticket-fields.mts`'s `split` and `join`: unit tests in `tests/ticket-fields.test.ts` (new) for lines 13, 14, and 15, including the insertion order, a section ended by `## Mockups`, a shared field written from one section and not cleared, a fenced `## Spec`, the shared Spec and Acceptance criteria field under each label, an empty section clearing its field, and a heading of the repository's own.
- [ ] 2.2 `withTicketFields` in `src/tickets/index.mts`. In `tests/ticket.test.ts`, against the memory adapter: `view` and `view --field body` print the joined document (13); `edit` writes fields and description (15), with `## Mockups` ending a section and a hand-written `mockups` key; `refined --check` prints `sound` for a ticket whose Decisions and Spec are in fields (16); a `follow-up` ticket stays whole (17); a missing field (18), a non-text field (19), an adapter without `fields` (25), a failing field write that leaves the description as it was (26), and both Spec and Acceptance criteria in one shared field (27) each exit 1 with nothing written.

## 3. Settings

- [ ] 3.1 `src/config.mts` and `settings.schema.json`: in `tests/config.test.ts`, line 20's message exact, the Spec and Acceptance criteria exception, line 21 both ways, and line 22's message.
- [ ] 3.2 `src/explain.mts`: line 30 in the config explain tests, with and without a board.

## 4. Init

- [ ] 4.1 Line 28: in `tests/init.test.ts`, with the agent's command not installed, the exact lines, exit 1, no settings file, and no board or secret call. Update the existing tests that ran init without the agent, and remove the column step's not-installed test with its requirement.
- [ ] 4.2 `src/ticket-fields.mts`'s `check`: each reason of line 11, and the order when several apply.
- [ ] 4.3 The field step in `tests/init.test.ts`, including line 2's failing field read and line 7's empty pick, with the memory adapter's fields Priority (single select), Acceptance criteria, Design notes, and Customer: lines 1, 3, 4, 5, and 6, where Yes writes exactly Proposed docs' YAML; line 7 with a change to Customer; line 8's clash and that Spec and Acceptance criteria sharing is none; line 9; line 10; line 2's three cases; line 12 with Fake Agent and the memory ticket system's label.
- [ ] 4.4 Lines 23, 25, and 26 in `tests/doctor.test.ts`: the `✓` line, each `✗` line, and no line with nothing named.
- [ ] 4.5 Line 29's sentences in the `tool-setup` change's MODIFIED requirement, and the existing init tests still pass.

## 5. Docs

- [ ] 5.1 Apply Proposed docs to `docs/existing-repo.md`, `docs/configuration.md`, `docs/github/setup.md`, `docs/quick-start.md`, `docs/skills.md`, `docs/design.md`, and `docs/developing.md`. `tests/docs.test.ts` passes, and `docs-reader` reads the new section and `tickets.fields`.

## 6. Verify

- [ ] 6.1 Map every Spec line, 1 to 30, to its test in the pull request body, and write a test for any line without one.
- [ ] 6.2 Side by side: run init against the memory adapter, or a scratch issue field on GitHub, and put its output next to Proposed docs' transcripts under "Mockup and result".
- [ ] 6.3 `npx --no-install factory gate` and `npm run pack-check`. There are no end-to-end specs here.
