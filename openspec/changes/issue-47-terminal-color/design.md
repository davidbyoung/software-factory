# Design

## Where it goes

- **`src/lib/color.mts` (new).** `colorOn(stream = process.stdout): boolean` returns `styleText("red", "x", { stream }) !== "x"`, so Node's own check makes the decision (lines 1 to 3), and nothing here restates its rule. `type Paint = (format: StyleFormat, text: string) => string`, with `StyleFormat` as `Parameters<typeof styleText>[0]`. `painter(on: boolean): Paint` returns `(f, t) => styleText(f, t, { validateStream: false })` when on, and `(_, t) => t` when off. `validateStream: false` is what lets a test inject color on while its output is piped.
- **The decision is made once, in each command's production deps**, as `status` makes it today in `styleFor`, and handed down as a `Paint` (or `Style.color` for `status`). The pure functions take a `Paint` with the plain one as default, and each deps type gets an optional `paint?: Paint`, read as `d.paint ?? plain`, so every existing caller and test fixture is unchanged.
- **`src/doctor.mts`.** `line(c, paint = plain)` paints the mark only: `green` ✓, `red` ✗, `dim` -, `yellow` ?. `DoctorDeps` gets `paint`; `doctorDeps` sets `painter(colorOn())`.
- **`src/init.mts`.** `InitDeps` gets an optional `paint?: Paint`, set the same way in its production deps, and its `Checks` loop (`d.out(` ${line(c)}`)`) passes it.
- **`src/board.mts`.** `boardReport(number, board, cfg, settings, paint = plain)`. The `check` branch of `main` passes `deps.paint`. Color the field texts by what they start with (`written`, `missing`, `skipped:`, `never written`), the no-column texts `dim`, and the `Note:` and `Problem:` prefixes alone. `inspectBoard` stays plain: other code reads its lines and problems.
- **`src/preset-commands.mts`.** `PresetDeps` gets `paint`, set from `colorOn()` in `presetDeps`, independent of `terminal`, which still decides only whether to ask. Rows are built with it where `+`, `−`, and `→` rows are built today, in every group, `remove`'s `back to a value you chose against` included, though it asks a question: only the `disagrees with` and `replaced by your .claude/factory.yaml` rows stay plain (lines 9 and 10). `summary` paints each group title `bold`. Width is computed from the keys, so the padding is unaffected by codes.
- **`src/explain.mts` and `src/config.mts`.** `explainLines` stays plain: the lock's `settings` block is written from it, and codes must never reach the lock. Add `paintExplainLines(lines, paint)` in `explain.mts`, applied to the whole block at both print sites in `config.mts`'s `explain` branch, the lock's lines and the resolved ones (line 12), since the lock path has only text. Every mark starts at the same column, the one `explainLines` pads to (`l.text.padEnd(at)`). Find it as the column at which the most lines that are not comment lines have two spaces then `# `, ties going to the larger column, and treat only a `# ` at that column as a mark, so a quoted value containing ` #` elsewhere is never split (line 11). A line whose trimmed text starts with `#` is a comment line, all `dim`. A line whose mark is `default` is all `dim`; any other mark has only the part from its `# ` `dim`.
- **`src/status.mts`.** Replace `SGR`, `ESC`'s use in `paint`, and the hand-built codes with `styleText` through `validateStream: false`, mapping `brightWhite` to `whiteBright` and `brightBlue` to `blueBright`. Keep the OSC 8 links and the `--watch` screen codes as they are. `styleFor` takes the decision instead of `isTTY` and `NO_COLOR`: `styleFor(colorOn(process.stdout), process.stdout.columns)`. Links and width fitting stay gated on `color`, as today (line 13). `styleText` takes an array of formats for the combined ones, such as `["bold", group.color]`, and writes one code pair per format where the hand-built code wrote one combined code: the colors stay the same, the bytes do not.

## Contracts

- Environment: `FORCE_COLOR`, `NO_COLOR`, `NODE_DISABLE_COLORS`, and `TERM`, all read by Node. The factory sets none of them, in code or in a workflow.
- Codes: whatever `styleText` emits. Tests build their expected strings with `styleText(…, { validateStream: false })`, never by hand, so they do not pin Node's codes.
- `styleText` with its stream check throws `ERR_INVALID_ARG_TYPE` on a plain object, so a test's fake stream is a real `stream.Writable` with `isTTY` and `getColorDepth` set on it.

## States

Color is on or off for the whole run, decided once when the command's deps are built. `status --watch` decides once at start, as today.

## Edge cases

- `FORCE_COLOR` and `NO_COLOR` both set: `FORCE_COLOR` wins, and Node prints its own one-line warning to stderr. Leave it: it tells the user why `NO_COLOR` had no effect.
- Output redirected to a file, a pipe, or a session's Bash tool: no terminal, so plain (line 3).
- A preset value or a setting containing `#`: YAML quotes it, so `paintExplainLine`'s split is unaffected (above).
- A light terminal background: only marks, labels, and whole default lines are colored, and text keeps the terminal's own color. This is checked by the side-by-side comparison, not by a test.

## Risks and rollback

Codes reaching something that parses output, if an environment sets `FORCE_COLOR` where a skill runs a command. None of the colored commands is parsed by a skill, and the lock is written from plain lines. If it happens anyway, `painter` returning the plain function in every case turns all of it off in one line.

## Dependencies

None, and no owner-only step. #37 may touch `src/doctor.mts`: a merge conflict, not a blocker.
