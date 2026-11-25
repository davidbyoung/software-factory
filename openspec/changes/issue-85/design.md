# Design

## Where it goes

- `src/init-shared.mts` gains `askBranchName` and `BRANCH_QUESTION`, moved from `src/init.mts` unchanged but for the dependencies it takes, `Pick<Terminal, "ask" | "out">`. `src/init.mts` imports it. It moves because `src/init.mts` already imports `src/init-org.mts`, so the other direction would be a cycle. `branchPatternFault` stays in `src/config.mts`.
- `src/init-org.mts`: the two lines and the question go in the `if (needsPreset)` part of the questions, after the `if (typeof board === "number" && tickets?.board)` block that settles the columns. `presetText` takes `codeHost` and `branchName`. `readme` changes its preset line.
- `docs/github/setup.md`, `docs/configuration.md`, and `docs/updating.md`, as "The docs" shows. In `setup.md` the new paragraph goes between the one that ends "names on the `board` row." and the one that starts "It then asks what pays for".
- No source of a factory file changes, so `factory sync` has nothing to write. No fresh-agent trace: nothing changes about what triggers a step, who runs, or when.

## Contracts

- The two lines, each one `say.text`, plain, as the line before the poller's interval is:
  - `Every repository that follows the preset names its branches this way, unless its own settings say otherwise.`
  - `{user} is the developer's account in a build on their machine, and the app's name in a build in the cloud.`
- The preset's `type` is `chosen.codeHost`, which `init-org.mts` already has. `branch-name` is a `Scalar` of type `QUOTE_DOUBLE` put through `stringify` from `yaml`, as `src/init.mts` writes it, so a `"` or a `\` in an answer is escaped. A pattern with a `\` is refused, and one with a `"` is not.
- `{ticket}` is the `fallback` given to `ask.input`, which shows `Press Enter for {ticket}`.

## States

- No preset, or no `factory-config`: asked.
- Preset there: not asked.
- A run that stopped after `factory-config` was made and before its files were written: the preset is missing, so it is asked again, as the board is.

## Edge cases

- An empty answer cannot come back, since Enter gives `{ticket}`. One of spaces alone is trimmed to nothing and refused with `needs {ticket}, or every build gets the same branch`.
- A board whose columns cannot be read stops the command before this question, as today.
- GitHub Free: asked the same. `factory-config` is public there, and a pattern is not a secret.
- Declining "Go ahead?" writes nothing, as today.
- `factory init` in a repository that follows the preset already skips the question and prints the `Branch names` row. `tests/init-organization.test.ts` has a test of that, which stays as it is.

## Risks and rollback

A wrong answer is one line in `factory-preset.yaml`, which the owner edits. Reverting the commit asks nothing again, and presets already written stay valid.

## Dependencies

None. #86 is about a preset edited by hand, and neither waits on the other. #72 changes how `{ticket}` expands for another repository's ticket, and reads the pattern as it is written.
