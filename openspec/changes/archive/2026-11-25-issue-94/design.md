# Design

## Where it goes

- `src/ticket-fields.mts`. `suggestFields` is the only code that changes behavior. `chooseColumns` in `src/columns-suggest.mts` is the pattern: ask each in turn, then the table, then confirm.
- Add `chooseFields`, private to the module: it prints line 2, asks line 3 with the loop of line 4, and returns a `Suggestion`. A small shared `whereDoes(d, key, fields, current)` holds the `select` that `changeSome` has today, so the two ask one question; `holding` is what finds a clash, reading only the keys already chosen, so it takes a `Partial<Suggestion>`.
- `suggestFields` then runs its present table loop for both ways. The `No` choice is left out of the list when the suggestion was chosen by hand.
- Its return type loses `| 1`, and `src/init.mts` loses the `if (got === 1) return 1;` after it. No `byHand` option: `init` is the only caller.
- Line 2's table uses `say.heads` and `say.row` with the widths `table` uses (22, `gap: 0`), and `FACTORY_FIELDS`' `holds`, so the prompt and the table can't differ.
- `docs/existing-repo.md`: the passage alone. The other lines that mention the step stay true, and `docs-reader` does not apply: one passage changes, not a section.

## Contracts

No setting, file, or environment variable is new. The four `tickets.fields` lines are written by the code in `src/init.mts` that writes a suggestion's today.

## States

The agent's answer is usable, or not, as `check` and the three failures say today. Not usable: choosing, then confirming, then done. `Change some` goes back to confirming.

## Edge cases

- One text field: four questions with two choices each.
- A ticket field called `Description`: its value is `field:Description`, as in `changeSome`, so it is not read as the description.
- Every answer the description: the table shows it four times, and `none` is written four times.
- Ctrl-C: `ExitPromptError`, handled in `init.mts` as today.
- A ticket system that renders Markdown in a field prints no "as typed" line, as today.

## Risks and rollback

init now reaches the plan where it stopped. Nothing is written before `Go ahead?`. Reverting the commit puts the stop back.

## Dependencies

None.
