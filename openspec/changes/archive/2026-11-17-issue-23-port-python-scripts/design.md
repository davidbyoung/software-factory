# Design

## Where it goes

- **`src/patch-coverage.mts` (new):** three pure functions with no I/O, so each is tested with strings.
  - `parseLcov(text, cwd)`: the report's `SF:`, `DA:`, and `BRDA:` lines to a map of path to `{ miss, part }` sets of line numbers. `SF:` paths are made relative to `cwd` with `node:path`'s `relative(cwd, resolve(cwd, path))`. `DA:N,HITS[,CHECKSUM]` with HITS `0` is a miss. `BRDA:N,BLOCK,BRANCH,TAKEN` with TAKEN `0` or `-` is a part. Every other line is skipped.
  - `changedLines(diff)`: the output of `git diff -U0` to a map of path to the set of line numbers on the `+` side. A file starts at `+++ b/PATH`; `+++ /dev/null`, a deleted file, starts none. A hunk `@@ -a,b +START,COUNT @@` adds START to START+COUNT-1, COUNT defaulting to 1, so `+12,0`, a pure deletion, adds nothing.
  - `uncovered(coverage, changed, source)`: the lines to print, in the order and form of Spec lines 1 to 6 and 14. `source(path)` returns the file's text or null.
- **`src/pr.mts`:** a `case "uncovered"` in `run`, beside `case "unverified"` (line 610). It takes up to two positional arguments, which are not numbers, so it reads them from `rest`, not `numbers`. It uses `d.git`, `d.readFile`, `d.out`, and `p.defaultBranch()` as line 566 does. `d.readFile` throws when a file is missing: catch that for the report (Spec line 12) and for a source file (line 14). `USAGE` (line 287) gains `| uncovered [BASE] [LCOV]`.
- **`src/cli.mts`:** `"uncovered"` in `PR_STEPS`, and its arguments, `[BASE] [LCOV]`, where the other `pr` steps' arguments are given, so Spec line 15 holds and `tests/cli.test.ts`'s "routes every command docs/cli.md does not mark Planned" passes.
- **`skills/factory-address-review/SKILL.md`, section 1b:** the `python3 .claude/skills/factory-address-review/patch-coverage.py [base] [lcov]` line becomes `npx --no-install factory pr uncovered [BASE] [LCOV]`, and the sentence after it says the defaults are the default branch on `origin` and `coverage/lcov.info`. If #24 has merged and that line passes other arguments, keep them. Delete `skills/factory-address-review/patch-coverage.py`.
- **`skills/factory-mutate/SKILL.md`, section 2:** the fenced `python` example becomes a fenced `js` one, a Node script the session saves as `mutate.mjs` in the scratchpad and runs with `node`. It does what the Python does, line for line: the same `MUTATIONS` rows; the file's text read once; a stop, naming the file and the text, unless the text occurs exactly once; the edit written; `npx vitest run TEST` run with `spawnSync` and its output kept off the terminal; the original written back in a `finally`; and `RED  ` or `GREEN` printed with the path and the text. If #24 has merged and the example already runs `factory test-one`, keep that command.
- **`node bin/factory.js sync`** after the skill edits. It rewrites both skills' copies under `.claude/skills/`, deletes `.claude/skills/factory-address-review/patch-coverage.py`, and takes it out of `.claude/factory.lock`. Commit the source and the copies together.
- **`tests/docs.test.ts`:** the link check, as three exported functions beside `unlinkedSettings`, reusing `pages()` and `read()`. Delete `tests/check-links.py`.
  - `headingSlug(text)`: as `slug` in the Python. Backticks and asterisks are dropped; an underscore is dropped unless a word character is on both sides of it; the text is trimmed and lowercased; `[words](target)` becomes `words`; every character that is not a word character, a hyphen, or a space is dropped; each space becomes a hyphen.
  - `anchorsOf(text)`: the slug of every heading line (`#` to `######`, then a space) outside a fenced code block, where the second heading with a slug gets `-1`, the third `-2`.
  - `brokenLinks(page, text, exists, anchorsFor)`: for every `](TARGET)` in the text, code blocks included, as the Python reads it, where TARGET has no space: skip one that starts `http:`, `https:`, or `mailto:`; resolve the part before `#` against the page's folder, or take the page itself when that part is empty; report `PAGE: TARGET: no such file` when it does not exist; and report `PAGE: TARGET: no such heading` when there is a part after `#`, the file ends in `.md`, and that part is not among its anchors.
- **`tests/boundary.test.ts`:** one test that no file under the folders `package.json` lists in `files`, nor under `tests/` or `src/`, ends in `.py`, and one that no `.md` file under `skills/` or `agents/`, nor `rules.md` or `review.md`, holds `python3` or a fence that opens with `python`. Use the walker that file already has for reading every file of the package.
- **`docs/cli.md`:** one row in the "Pull requests" table, after `factory pr unverified N`.

## The OpenSpec delta

Every line is an addition. `pr-uncovered` is a new capability, lines 1 to 15. `docs` has no requirement about `docs/cli.md`'s pull request commands, so line 16 is added there, not written as a change to "The CLI page and what is built".

## Contracts

- **Usage:** `factory pr uncovered [BASE] [LCOV]`. Both are positional and optional; `LCOV` cannot be given without `BASE`.
- **Output:** exactly the Python's. A file's header is `=== ` and the path. A line is `MISS ` or `PART `, the number, `: `, and the text. Nothing is printed between files, and nothing when there is nothing to report.
- **The error for a missing report:** `No coverage report at PATH. Run the project's coverage command first.`
- **Exit:** 0 when it ran, with or without lines; 1 for a missing report or a failed `git diff`. A wrong argument count throws `USAGE`, as the other steps do.
- **How each error leaves:** for a missing report, catch `d.readFile`'s throw, print the message with `d.out`, and `return 1`, as the steps at lines 461 and 496 do. For a failed `git diff`, let `d.git`'s throw pass: `main`'s `catch` (line 651) prints the error's message and returns 1. The test for line 13 fakes `git` to throw and checks `main` resolves to 1.

## States

None: one read, one print.

## Edge cases

- A changed file in the report with nothing uncovered among its changed lines prints no header.
- A file whose only change is deleted lines has an empty set and prints nothing.
- A report with a `BRDA:` line for a file with no `DA:` lines still counts its branches.
- A source line longer than 110 characters is cut after trimming, not before.
- A renamed file appears in the diff under its new path only, so it matches the report by that path.
- `SF:` paths with `..` or `./` resolve before they are compared.
- "Word character" in `headingSlug` is Python's: any letter or digit, and the underscore. JavaScript's `\w` is ASCII only, so write it as `[\p{L}\p{N}_]` with the `u` flag.
- The link check reads `README.md` and every `.md` under `docs/`, the pages `pages()` already lists. A link from `README.md` resolves against the repository's root, and one from `docs/github/` against that folder.

## Risks and rollback

- **The output drifting from the Python's.** A session reading section 1b expects `MISS` and `PART` lines. Task 1.5 runs both on one fixture before the Python is deleted.
- **A slug that differs from GitHub's,** so a working link fails the gate. The docs pass the Python check today, so the port must pass on the same pages (task 3.5). If a real link fails, fix the slug function, never the link.
- **Rollback** is reverting the pull request: nothing outside the repository changes.

## Dependencies

- No owner-only step.
- No open issue waits on this one, and this one waits on none. #24 touches the same two skill passages, which is a conflict for `factory-resolve-conflicts`, not an order.
- The line on the follow-ups issue, #4, that begins `tests/check-links.py:` is settled by this ticket: see task 5.3.
