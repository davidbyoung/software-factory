# Proposal

From [davidbyoung/software-factory#79](https://github.com/davidbyoung/software-factory/issues/79).

## Why

Most of what the factory prints is plain white text in aligned columns: the "Found" block and the plan of `factory init` and `factory init --org`, the column table, the "Left to do" and "After it merges" lists, and the closing lines. A developer has to read every line to find the one that matters. The owner said so on 2026-11-24, after running both setup commands for a real organization while building #74: "it's a wall of tabular white text, and it's hard to visually differentiate things. this should apply to ALL CLI data we show - sensible use of colors to help a dev quickly understand all the data being shown."

Some output is colored today, piece by piece: the marks in `factory doctor`, `factory board check`, and `init`'s checks, the changes in a preset's summary, `factory config explain`, and `factory status`. The rule for when color is on, and that color adds only codes, is in the `terminal-color` spec. What is missing is one scheme that every command follows.

This ticket gives the CLI one use of color, applied to everything a person reads in a terminal.

- **The scheme:** seven looks, each with one meaning, as Proposed docs' table has them. Approved by the owner on 2026-11-24, after a first round whose labels were dim: dim means skip it, and a label is not to be skipped.
- **A state's own color in `factory status`:** none. A group's heading looks like every other heading, so yellow marks only what waits on the person, and cyan only what is copied or opened.
- **The questions the prompt library draws:** they follow the scheme. An open one's `?` is yellow, and an answered one starts with the factory's `✓`.
- **Lines a skill or a workflow takes as they are:** never colored, at a terminal or not, and not with `FORCE_COLOR`: every command the usage does not list, and the six line 2 names. A person's command that a session also runs, such as `gate`, `sync --check`, or `site compare`, is plain there because its output is not a terminal, and colored with `FORCE_COLOR`, as today.
- **How the scheme is kept:** by the type check and tests that "How it is kept from drifting" lists, not by a rule in prose.
- **Standard error decides for itself:** today both streams take standard output's answer, so a command's errors sent to a file from a terminal hold color codes.
- **A reviewer still running in `factory status`** is dim, not yellow: nothing waits on the person. The `?` of one with no verdict is yellow, as `?` is everywhere.
- **One pull request.** Splitting it would leave two schemes in the terminal between merges, and each later part would convert lines the first already had.
- **Build order:** nothing blocks this ticket (#74 is closed), and it blocks nothing. #72, #75, and #81 add lines to the same commands, which is a merge conflict and not a blocker. Whichever is built second prints its lines the new way.

## What Changes

- Every command a person runs prints in one scheme of seven looks, in color.
- Each output stream decides for itself whether it is in color.
- What a skill or a workflow takes as it is never holds a color code.

## Capabilities

### Modified Capabilities

- `terminal-color`
- `cli-output`
