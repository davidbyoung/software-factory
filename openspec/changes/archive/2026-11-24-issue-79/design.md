# Design

## Where it goes

- **`src/lib/output.mts`** (new) is the only file under `src/` that writes to the terminal, and with `src/lib/prompts.mts` the only one that imports `styleText` or loads `@inquirer/prompts`. It takes in `src/lib/color.mts`, which goes away: `colorOn` keeps its rule, and `tests/color.test.ts` follows it.
- **`src/lib/prompts.mts`** (new) holds what draws a question: `terminalAsk` and `readSecret` with its escape sequences, from `src/init-shared.mts`, the `confirm` that `src/remove.mts` loads, and the typed question of `src/preset-commands.mts` (`presetDeps().ask`). `src/status.mts`'s screen control for `--watch` (`ENTER`, `LEAVE`, `frame`) and its OSC 8 links move to `output.mts`.
- **Every module that prints for a person** changes its `out: (line: string) => void` to `out: (line: Line) => void`, and each call says what its line is. `grep -rnE "\b(d|o|io|deps)\.(out|err)\(" src` counted 452 calls on `e7373a8`, the machine commands' included.
- **A machine's command** keeps printing strings, through `output.mts`'s `plainPrinter`.
- **The launcher** (`bin/factory.js`) is plain JavaScript that loads nothing of `src/`, so lines 20 and 26 use `styleText` there, with `{ stream: process.stderr }`. It is the one exemption in the boundary test.
- **Adapters' strings** (a step's `intro`, `skipped`, and `refused`, a check's `text` and `fix`, `leftovers`, a thrown error's message) stay strings: the caller wraps each one, as `text(...)` or `step(...)`, and what they hold colors itself.

## Contracts

```ts
// src/lib/output.mts
/** What each look means. The one table of colors. */
const ROLES = {
  heading: ["bold", "underline"],
  name: ["bold"],
  skip: ["dim"],
  copy: ["cyan"],
  yourTurn: ["yellow"],
  good: ["green"],
  bad: ["red"],
} as const;
export type Role = keyof typeof ROLES;
/** Words with a role, or plain, and linked when `url` is given. */
export type Piece = string | { role: Role; text: string; url?: string };
/** One line, made only by the functions below: an opaque type. */
export type Line = { readonly [brand]: true };

heading(text, { indent? }); // line 5
table(heads: string[], rows) / row(label, value: Piece[] | string, { indent?, width?, mark? }); // line 6
step(number, text, { indent? }); // line 15's number
action(text, rest?); // line 15's and 16's heading line, and what follows its colon
mark("ok" | "fail" | "look" | "off" | "flag", pieces, { indent? }); // line 17
note(text); // line 20
text(...pieces: Piece[]); // everything else
verbatim(text, { skipFrom?: number }); // line 25, and config explain's dim part
name(text) / command(text) / role pieces; // for use inside the others

printer(stream): (line: Line) => void; // color by that stream
plainPrinter(stream): (line: string) => void; // a machine's command
render(line, color: boolean): string; // for the printer and the tests' stand-in
```

- **A piece given a role keeps it.** Automatic coloring (lines 10 to 12, 17, 18, and `Run: ` of 13) applies only to the plain pieces of `text`, `row`, `step`, `mark`, and `action`. The order is: the mark at the line's start, `Could not`, addresses, then commands and skills.
- **A `factory` command** is `factory`, then the longest words an entry of `COMMANDS` in `src/cli.mts` has, then each next token that is a flag, the value of a flag whose entry's `args` shows one (`--org ADDRESS`), or a positional argument. A positional argument is a token with a character that is not a lowercase letter, such as `12`, `N`, or `acme/factory-config`, for as many as the entry's `args` has. The punctuation that ends a token `.,:;)` is left out. Words that match no entry, such as `factory for`, color nothing. `COMMANDS` moves to a module with no side effect, `src/commands-list.mts`, since importing `cli.mts` runs it.
- **Each `COMMANDS` entry gets a required `reads: "person" | "machine"`.** The usage's entries are `person`, except the six of line 2. `cli.mts` picks nothing from it at run time: `output.mts` exports `printersFor(command)`, which each module's `run` calls with its own words, and which gives `plainPrinter`s for a machine's command. `status --hook` is `session-start`'s, so a machine's.
- **The prompts' theme** is one object given to `checkbox`, `select`, `confirm`, and `input`: `prefix.idle` `?` in `yourTurn`, `prefix.done` `✓` in `good`, `style.answer` and `style.highlight` in `copy`, `style.message` in `name`, and `style.defaultAnswer` and `style.help` in `skip`. Each is painted by standard output's answer. `style.key` and `style.error` follow: `copy`, and `bad`. `readSecret` draws the same `?` and message, and rewrites its line with `✓` when it settles with a value.

## States

- A stream is in color or plain, decided once, when its printer is made. `status --watch` decides on each draw, as today.
- `status` fits to the window and links only in color, as today (`styleFor`).

## Edge cases

- **Padding.** A label is padded by the row, outside its bold, so an underline or a bold never runs over spaces. The plain text is byte for byte today's: the existing transcripts in `tests/` are the check, and none of their expected text changes.
- **`config explain`'s YAML** has lines that start with `- `, which line 17 would dim: it prints with `verbatim`.
- **A preset's summary** prints in `init` too, through `presets.add`'s `io.out`, so `add` hands over lines, not strings.
- **An error thrown and printed** (`said(e, paint)`, `StepFailed`, `CredentialError` in `cli.mts`) starts with `✗` or not. `text(e.message)` colors it either way.
- **`printChecks`** gives lines, for `doctor` and for `init`'s `Checks`.
- **A long name** is never cut by a role: `fit` in `status` works on pieces, as its `Seg` does.
- **`init`'s `d.out`** compares a line with `NOTHING` and keeps the last one to decide a gap. It compares the plain text.

## Risks and rollback

- The text of a line changing while it is converted. The existing transcripts catch it wherever they cover the line. Before starting, list the lines no test prints, and add a transcript for each that a person's command can print.
- Reverting the one commit restores the old output: nothing is stored.

## Dependencies

- No owner-only step, and no new package.
- Build order: under Decisions.
