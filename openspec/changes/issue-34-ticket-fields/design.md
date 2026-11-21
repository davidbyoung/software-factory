# Design

## Where it goes

- **`src/tickets/types.mts`:** `TextField` and `FieldOps` as Proposed docs' "For contributors" gives them, plus `write(ticket, values: Record<string, string | null>): Promise<void>`. `Tickets.fields?: FieldOps`, `"fields"` in `GROUPS` and `GROUP_KEYS`, and a `supports` case. `list()` returns every field with its type, `{ name, description, text: boolean }`, so the checks of lines 19 and 23 can tell a missing field from one that doesn't hold text; the init step offers only `text` ones.
- **`src/tickets/github.mts`:** the GitHub `fields` group, through the transport, with the `repo` scope:
  - `list`: `repository(owner, name) { issueFields(first: 100) { nodes { __typename ... on IssueFieldText { id name description } ... on IssueFieldSingleSelect { id name } ... on IssueFieldNumber { id name } ... on IssueFieldDate { id name } } } }`, in the order returned. Only `IssueFieldText` is `text: true`.
  - `read`: `issue(number) { issueFieldValues(first: 50) { nodes { ... on IssueFieldTextValue { value field { ... on IssueFieldText { name } } } } } }`.
  - `write`: `setIssueFieldValue(input: { issueId, issueFields: [{ fieldId, textValue }] })`, and `{ fieldId, delete: true }` to clear. Look up field IDs from `list`.
  - `holds` returns `{ max: null }`. `plainText` is `true`.
  - These names were confirmed against GitHub while drafting, by introspection and real calls: `issueFields`, `IssueFieldText`, `issueFieldValues`, `IssueFieldTextValue`, and `setIssueFieldValue` with `textValue`. A 256 KB value was stored whole, GitHub drops a value's final newline, and an unpinned field took a value on an issue with no type. The clear form, `delete: true` on `IssueFieldCreateOrUpdateInput`, exists in the schema but was not exercised: confirm it with one real call while building. Test against recorded responses.
- **`tests/memory-tickets.ts`:** a `fields` group, seeded with fields and values, with `plainText` settable, so tests exercise splitting, joining, and both checks.
- **`src/ticket-fields.mts` (new), naming no agent and no ticket system:**
  - `FACTORY_FIELDS`: the four keys with their headings and what each holds, in order.
  - `headingOf(key)` and `keyOf(heading)`: the key with hyphens as spaces, first letter capitalized; a heading matches a key ignoring capitals, spaces read as hyphens.
  - `split(body, mapping, labels)` and `join(description, values, mapping, labels)` for lines 13 to 15, skipping fenced code as `proseLines` in `src/lib/refined-check.mts` does. `join` ignores a trailing newline difference, since GitHub drops a value's final newline.
  - `prompt(fields)`, `schema(fields)` (each key a string from an `enum` of the text fields' names plus `__description__`), `check(answer, fields)` with line 11's reasons in order, `table(mapping)`, and `suggestFields(d, ...)` running lines 1 to 11 against `d.ask` and `d.out`, as `suggestColumns` in `src/columns-suggest.mts` does. Reuse its agent call, timeout, and failure wording; extract a shared helper only where the two would otherwise copy each other.
- **`src/tickets/index.mts`:** `openTickets` wraps the adapter in `withTicketFields(tickets, mapping)` when `tickets.fields` names a ticket field and the adapter has `fields`. The wrapper:
  - overrides `read` to join (lines 13, 14, and 16) and `writeBody` and `attachments.writeBody` to split (line 15), checking each named field with `list` first (lines 18 and 19);
  - passes a `follow-up`-labeled ticket through whole (line 17). `writeBody` doesn't receive labels, so it reads the ticket's labels first;
  - when the adapter lacks `fields` but the settings name a ticket field, still wraps it, and its `read` and `writeBody` throw `UnsupportedError("fields")` (line 25), so nothing falls back to the description without saying so;
  - leaves `readAll` as the adapter returns it, descriptions only: its callers (the views, the board sync, the poller) read comments, labels, and cards, never a refined ticket's sections. Check that still holds with `grep` over `readAll(` callers, and say so in the pull request.
- **`src/config.mts`:** `tickets.fields` keeps `session`, `runs-in`, and `cost` with their defaults and adds the ticket-side keys, each a name or `none`, default `none`, plus any other kebab-case key (line 22). Move the `needs tickets.board` check to the three board keys (line 21). Add line 20's clash check, comparing names ignoring capitals. `Settings.tickets.fields` becomes `{ board: Record<FieldKey, string | null>; ticket: Record<string, string | null> }`, or keep `fields` for the board's three and add a `ticketFields` member; `fieldNamesOf` keeps returning the board's three either way. `settings.schema.json` follows, and `tests/settings-schema.test.ts` keeps the two in step.
- **`src/explain.mts`:** line 30: print the ticket-side keys outside the `board === null` branch.
- **`src/init.mts`:**
  - Line 28: right after `Setting up the software factory for ...` and the blank line, `if (!agent.agent.installed(d.hasCommand))` print the three lines and return 1. Remove the `not installed` branch from `claudeCodeSetup.found` and the `ANTHROPIC_API_KEY`-only branch from its secret step that init used without the command; keep `doctor`'s own check that the command is installed. The column step's own not-installed branch (`src/columns-suggest.mts` line 283) becomes unreachable from init: remove it with its spec requirement, and its tests.
  - The field step: after the column step and before the plan, when lines 1's conditions hold. Write the result with `doc.setIn(["tickets", "fields", key], value)`. A stop returns 1 before `syncChanges` and the plan.
- **The checks of line 23:** beside the board check in `src/tickets/github-setup.mts`, which `doctor` and init both print, reading `fields.list()`.
- **`src/agent/claude-code.mts`:** no change to `answer`.
- **Checked while drafting:** `repository.issueFields` reads on this repository, which a user owns, with the `repo` scope. Line 28's stop goes right after the header, as the transcript shows; nothing in `init.mts` before that line prompts, so confirm it still holds when wiring it in.
- **Docs:** as Proposed docs give them: the new section of `docs/existing-repo.md`, and the lines in `docs/configuration.md`, `docs/github/setup.md`, `docs/quick-start.md`, `docs/skills.md`, `docs/design.md`, and `docs/developing.md`.

## Contracts

- Settings: `tickets.fields.<key>: <ticket field name> | none`, YAML, written through `doc.setIn`, keeping comments.
- The agent's answer: an object with the four keys, each a text field's name exactly as listed, or `__description__`. A token rather than the words "the description" keeps a field called "Description" usable.
- Timeout: 60 seconds, as the column step.
- What is sent to the agent: the text fields' names and descriptions, and each factory field's heading and meaning. Nothing from any ticket.

## States

The field step: suggest → (stop) or table → ask. `Yes` → write. `Change some` → pick factory fields → pick a ticket field for each (back to picking on a clash) → table → ask. `No` → write four `none`. Only `Yes` and `No` leave the loop.

## Edge cases

- A ticket field named like a factory field ("Decisions") is offered like any other; nothing is matched by name without the agent and you.
- A field called "Description" is a field like any other, told apart from the description by the `__description__` token.
- The owner's text with a level-two heading that matches a key, such as `## Decisions`, is read as that section, as `factory ticket refined` already reads it.
- Text before the first matched heading always stays in the description.
- A `## ` line inside a fenced block is not a heading, so a transcript showing `## Spec` stays where it is.
- An empty section clears its field; a field with no text adds no heading.
- A re-run with any of the four keys set never calls the agent, so a teammate's re-run asks nothing.
- A repository whose tickets gain a text field after init: nothing changes until the four lines are deleted and init runs again.

## Risks and rollback

- GitHub's issue fields API is new; a changed shape fails `list` and every `edit` on a repository that names a ticket field, with GitHub's error. Repositories that name none never call it. Rollback: revert the pull request; a repository whose settings name ticket fields then fails `config check` on the unknown keys until it deletes them, and its tickets' fields keep their text.
- Requiring the agent breaks setting up on a machine without Claude Code; that is the decision.

## Dependencies

None open. No owner-only steps: a repository that wants ticket fields creates them itself, as the docs say.
