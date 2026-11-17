# Design

From the issue's "Design".

## Where it goes

- **`src/config.mts`:** add `rules` to `SETTINGS_KEYS[""]` and `SETTINGS_KEYS.rules = ["small-change-lines", "review-rounds"]`, and to `settings.schema.json` (`tests/settings-schema.test.ts` keeps them equal). `Settings.rules: { smallChangeLines: number; reviewRounds: number }`, parsed with the existing `wholeNumber(v, key, fallback)`, whose message is line 2's. Remove the "refuses this key until it is built" sentence from `docs/configuration.md`.
- **`src/sync.mts`:** a `withRules(text, rules, from)` beside `withMinutes`, applied in `plan()` to `rules.md` (written to `.claude/factory/rules.md`) and `skills/factory-address-review/SKILL.md`. Like `withMinutes`, each replacement asserts its phrase matches exactly once and throws naming the file otherwise, so a rule edit that drops a phrase fails the tests rather than silently keeping the default. The phrases, matched across line breaks with `\s+`:
  - `rules.md`: "under about 30 lines", and "After two rounds, whatever is still in dispute".
  - `factory-address-review`: the heading "## 6. Two rounds, then escalate", and "at most two rounds**. When the third review arrives".

  A count prints as a word from one to ten ("two", "Two" at a heading's start) and in digits above; "the third review" becomes the ordinal of rounds + 1, as a word up to "eleventh" and as digits with its suffix above. With the defaults, the text is unchanged.

- **`config explain`:** a new `command === "explain"` branch in `config.mts`'s `main`, and a `["config", "explain"]` entry in `src/cli.mts`, so `tests/cli.test.ts`'s "a command the docs list and this version does not build" loses its example: no other command in `docs/cli.md` is both Planned and unrouted (`factory poller --once` routes to the poller). Change that test to an unknown word, such as `factory nonesuch`, renamed for what it then checks. In `tests/docs.test.ts`, "take their planned commands from docs/cli.md" drops `factory config explain` from its expected list and keeps `factory poller --once`. Build the output with the `yaml` package's `Document`: start from the parsed settings, mapped back to the file's key names, and set `node.comment = " default"` on each scalar or empty collection whose path is absent from the raw file. Key order is `SETTINGS_KEYS[""]`'s. `code-host` prints in its one-word form (`code-host: github`). A ticket system's declared keys (`tickets.options`) print under `tickets`. Lists the settings leave empty print as `[]`. A null value is never printed as a key (`none` is refused for `site.pages` and `site.design-guide`), so it prints as line 9's comment line. Import `yaml` lazily, as `read()` imports `js-yaml`, so a checkout without dependencies prints the same `NO_DEPENDENCIES` line as `config check`.
- **`skills/factory-trace/SKILL.md` (new):** frontmatter `name: factory-trace`, and a description that says when: "Use before a pull request that changes the rules, a skill, an agent, or a workflow is marked ready, and when asked to trace a rule change." Its body: check `.claude/change-types.md` (line 17), start one fresh `general-purpose` agent with the brief of lines 14 and 15, then post or print the report (line 16) with `npx --no-install factory pr comment N --body-file`. Match the other skills' voice and length. `sync` copies every folder under `skills/` unless `NEEDS` gates it, so it needs no `NEEDS` entry.
- **`rules.md`:** in "Changing the process", replace "gets a read from a fresh agent … Fix what holds up." with a sentence saying to run the `factory-trace` skill before it is marked ready, and fix what holds up. Keep the list of what counts as a process change.
- **Docs:** the marks under "Checked by review". `docs/skills.md`'s `factory-trace` section gains "What it writes" (the report, on the pull request) and "When it stops" (no `change-types.md`). The "What is built" row "`factory migrate`, `factory board sync --dry-run`, and the `/factory-trace` skill" is split so `factory-trace` says Working; leave the others as they stand.

## Contracts

New settings keys `rules.small-change-lines` and `rules.review-rounds`, defaults 30 and 2. New command `factory config explain`, exit 0 or 1. New skill `factory-trace`. No secret, workflow, or label changes.

## States

n/a.

## Edge cases

- `rules: {}` is accepted and means the defaults.
- A `rules` value of `0`, `2.5`, `"3"`, or a negative number fails line 2.
- `explain` on a file with comments of its own drops them; it prints the settings, not the file.
- `explain` with `site` set prints its keys with defaults filled in, as `siteLines` lists them.

## Risks and rollback

A phrase match that silently misses would leave a repository on the default number while its settings say otherwise; the exactly-once assertion turns that into a failing test and a failing sync. Rollback is reverting the pull request: no setting existing repositories have changes meaning.

## Dependencies

None. No owner-only step.

## Where the build departs from this design

- **`withRules` replaces a phrase only when its number differs from the
  default,** and must then match it exactly once. Replacing at the
  defaults would require every test package to carry the real phrases; a
  test on the real package with both numbers set catches a rule edit that
  drops one.
- **`config explain` writes its own YAML lines** rather than building a
  `yaml` Document, using `yaml`'s `stringify` for each value's quoting: the
  comment lines for parts that are off, and the aligned `# default` marks,
  are simpler to write than to attach to nodes. A test checks it prints
  every key `SETTINGS_KEYS` lists, so a new key cannot be left out.
- **`explain` lives in `src/explain.mts`,** loaded only by that command.
- **The trace's brief also asks the agent to do what the repository's
  `CLAUDE.md` adds to the trace,** and a missing `change-types.md` leaves
  the pull request a draft, from the trace of this branch.
