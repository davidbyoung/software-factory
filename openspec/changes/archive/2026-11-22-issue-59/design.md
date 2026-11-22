# Design

## Where it goes

- **Settings.** `src/config.mts`: `Settings.tickets.labels: { spec: string; followUp: string }` and `Settings.codeHost.labels: { mergeAutomatic: string; mergeManual: string; verdictOverride: string }`, parsed beside `branchNameOf`, with the defaults in one exported `DEFAULT_LABELS`. `labels` is a generic key under `tickets` (not one of an adapter's `keys` in `src/tool-names.mts`). `settings.schema.json` gains both blocks with `additionalProperties: false`. The lock (`settings-lock`) and `factory config explain` carry them as every other setting, with `# default`.
- **Name checks.** `src/tool-names.mts`'s `Built` gains a per-tool label check for tickets and for code hosts, `(name: string) => string | null`, returning the reason or null; `BUILT` registers GitHub's for both (empty only). `Built` and `builtOf` change shape to carry it, so `tests/config.test.ts`'s `builtOf(TOOLS)` comparison and its fixtures change with them, and `tests/fake-tools.ts` gains a ticket tool that refuses a space, for line 7. `config.mts` runs the empty check (line 4), the adapter's check (line 7), then the duplicate check (lines 5 and 6), comparing with `toLowerCase()` across both blocks when `tickets.type === code-host.type`. The registry test that `tools.mts` and `tool-names.mts` agree covers the new slot.
- **Readers of a hard-coded name.** Replace each with the setting: `follow-up` in `src/ticket.mts` (`followUp`), `src/lib/work-status.mts`, `src/board.mts`, `src/status.mts`, `src/lib/refined-check.mts`, and `src/tickets/index.mts` (`withTicketFields`'s `whole`); `spec` in `src/lib/refined-check.mts`, `src/ticket-fields.mts` (the label check near line 183, not the field key `spec`), and `src/commands.mts` (the `specs new` call near line 218); `AUTOMATIC` and `MANUAL` in `src/merge-policy.mts`; `OVERRIDE` in `src/review-verdict.mts`, `src/guard-commit.mts`, `src/guard-ticket-text.mts`, and `src/remove.mts` (`LABELS`). Where a function takes no settings today, pass the names in rather than reading the lock inside it, as `withTicketFields` takes `mapping`: `missingParts` in `src/lib/refined-check.mts` takes them in place of its `SPEC_LABEL` and `FOLLOW_UP_LABEL` constants, and its callers, `src/board.mts`, and `src/lib/work-status.mts` pass them from the `Settings` the command already loaded. A caller with no `Settings` loads them the way other commands do, from the lock; with no lock (as in a hook outside a factory repository), it uses `DEFAULT_LABELS`.
- **Hooks.** `src/guard-commit.mts` builds its `addsOverride` pattern from the configured name: regex-escaped, with each space matching ` `, `%20`, or `+` and each `:` matching `:` or `%3A`, as the current constant does. It reads the name from the lock and falls back to the default when there is none. `refuseOverride` in `src/guard-ticket-text.mts` compares against the configured name and the key, ignoring case.
- **Translation.** One function, say `labelOf(settings, word, side)`, maps a key to its name for `side` `tickets` or `code-host` and returns any other word unchanged; `factory ticket label`, `factory ticket open --label`, and `factory pr label` use it. One function formats a label list for output (line 13), used by `ticket view`, `--field labels`, and `ticket list`.
- **Workflow.** `workflows/factory-review-verdict.yml` line 33 compares `github.event.label.name` with `'verdict-override'`. `src/sync.mts` rewrites that one literal to the configured name, in the same shape as `RULE_PHRASES`/`withRules`: replaced only when the name differs from the default, and it must match exactly once. A name containing `'` is written with the quote doubled, as GitHub expressions escape it.
- **Prose.** Every copied source that names a label (`rules.md`, `review.md`, `skills/`, `agents/`, `workflows/`'s prompts, and `.claude/skills/dx-first` and `ticket-order` here) names `merge-automatic`, `merge-manual`, and `verdict-override` instead of the old defaults; `spec` and `follow-up` stay. `rules.md` gains one sentence where it first names a label: "A label is named here by its key under `tickets.labels` or `code-host.labels`; `factory ticket view` shows the key beside a label a repository renamed." Run `node bin/factory.js sync` and commit the copies.
- **Docs.** `docs/configuration.md` as `## Proposed docs` shows; the lines in "Other docs pages that change"; and `openspec` lines through `factory specs new 59` / `finish 59`.

## Contracts

- YAML keys: `tickets.labels.spec`, `tickets.labels.follow-up`, `code-host.labels.merge-automatic`, `code-host.labels.merge-manual`, `code-host.labels.verdict-override`. Values: strings, trimmed.
- Output: `NAME (KEY)` in a labels list, only when `NAME !== KEY`.
- Error lines: as Spec lines 4, 5, and 7, prefixed `.claude/factory.yaml: `.

## States

None new. A label is configured or default; the lock records which.

## Edge cases

- A name with `: ` must be quoted in YAML. js-yaml reports it as `bad indentation of a mapping entry` at the line; line 23 recognizes that error on a line whose value holds `: ` and replaces the message. Test it with `verdict-override: owner: pass`.
- A configured name equal to another key's default, such as `spec: follow-up`, is a duplicate, reported on the key the file sets (line 5).
- `--add` with a key from the other side, such as `factory ticket label 12 --add merge-manual`, is a plain label name.
- Workflows run from the default branch's copy, so a renaming pull request is judged by the old names until it merges.

## Risks and rollback

A missed reader of a hard-coded name silently stops finding the follow-ups ticket or the override. The verify task greps `src/` and `workflows/` for the five old literals and for `"follow-up"` and `"spec"` used as labels. Rollback is reverting the pull request; repositories with no `labels` block see only the three new default names.

## Dependencies

- #61 waits on this (recorded as #61 blocked by #59).
- No owner-only step.
