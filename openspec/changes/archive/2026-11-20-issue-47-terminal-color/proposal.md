# Proposal

From [davidbyoung/software-factory#47](https://github.com/davidbyoung/software-factory/issues/47).

## Why

Color the marks and values in the commands a person reads, so a pass, a failure, and what changed stand out at a glance.

`factory status` already colors its reviewer runs, a green ✓ and a red ✗, but `factory doctor` prints its ✓, ✗, -, and ? plain, and so do the other commands a person reads to decide something.

## What Changes

**`factory doctor`**

- ✓ green, ✗ red, - dim, and ? yellow: a ? means doctor could not tell, which is worth a look, while a - is a part turned off on purpose.
- Only the mark is colored; the line's text, and the fix after a ✗, stay the terminal's normal color.

**`factory preset add` and `factory preset remove`**

- In the `old → new` lines they show before asking, the old value is dimmed and the new one stands out, since that is the moment the reader decides.

**`factory config explain`**

- A setting left at its default is dimmed, its whole line with its `# default` annotation, so the settings the repository or a preset set stand out.

**`factory board check`**

- The words it prints for each field's state, and its `Note:` and `Problem:` labels, are colored as `doctor`'s marks are. It prints no marks, and gets none.

**Everywhere**

- The marks still carry the meaning without color, for colorblind readers and for `NO_COLOR`.
- Color only in a terminal: piped output, which the skills, hooks, and CI read, stays plain, and `NO_COLOR` turns it off.
- One way of coloring for every command. Node's built-in `util.styleText` checks for a terminal, `NO_COLOR`, and `FORCE_COLOR` itself, so it could replace the color codes `status` builds by hand; `status` keeps its own code for clickable links.

## Decisions

- Which rule decides when to color: Node's own, the one `util.styleText` applies to a stream. `FORCE_COLOR` set to the empty string, `1`, `2`, `3`, or `true` turns color on even when piped, and any other value turns it off, even in a terminal. Without it, color needs a terminal, with `NO_COLOR` and `NODE_DISABLE_COLORS` unset and `TERM` not `dumb`. `NO_COLOR` set to an empty string now turns `status`'s colors off, where today it leaves them on: every command then follows the same rule as Node itself.
- Whether `status`'s links follow the color rule, so `FORCE_COLOR` turns them on when piped: yes (the owner, in the draft).
- How `config explain` dims a default: the whole line, key, value, and `# default`, along with each comment line such as `# board: none (default)` and `# pr-review: off`. A preset's own mark is dimmed as a comment, with its line left bright (the owner, in the draft).
- Whether `board check` gets marks: no. It colors the words it already prints (the draft, correcting the ticket's text).
- Whether `init`'s closing checks change: yes, since they print through `doctor`'s own line code. Its numbered steps above `Checks` stay plain.
- Build order: none. #37 may change a `doctor` check, which is at most a merge conflict in `src/doctor.mts`, not a blocker.
