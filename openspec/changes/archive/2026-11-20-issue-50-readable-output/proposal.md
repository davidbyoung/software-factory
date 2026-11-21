# Proposal

From [davidbyoung/software-factory#50](https://github.com/davidbyoung/software-factory/issues/50).

## Why

Make what each command a person runs prints explain itself, so a reader who has not read the code knows what every word means.

`factory board check` is the clearest case. It prints two blocks of words with no heading, and "written" next to a field doesn't say who writes it or what goes in it:

```text
Board 1, "Acme work"

  backlog    Backlog
  refining   In refinement
  ready      Ready
  building   In progress
  review     In review
  done       Done

  Status     written
  Session    written
  Runs in    written
  Cost       written
```

## What Changes

- **Every command a person runs gets its wording reviewed,** from a mockup of its whole output, before anything is built: the commands under "Setting up", "Every day", "Now and then", and "Presets" in `docs/cli.md`, those under "Your repository's commands" that a person also runs, and `factory` with no command.
- **`factory board check`** groups its columns and its fields under headings that say what each block is and which setting it comes from, and says in words what each field's state means, such as who fills it in.
- **`factory plugins`** prints four unlabeled columns, kind, name, role, and files. Skills read its lines, so its line format stays; `docs/cli.md` already names each column, under "Now and then".

## Decisions

- How `board check` reads: option C of the draft, `doctor`'s marks with one row per item and each fault on its own row, headed by the setting it shows (the owner, over a table and over short words alone). Round 1's prose version was rejected as verbose.
- What doctor's headings are: each tool's own name, so GitHub, GitHub Actions, GitHub Issues, and Claude Code here (the owner, in the session). The draft's sample said "GitHub Actions secrets" and "Board"; the poller workflow's check and the ticket fields' check belong to those tools too.
- Whether a command that succeeds says so: yes, in one line, for `sync`, `sync --check`, `config check`, `gate`, `site stop`, `specs check`, `test-one`, and `end-to-end`.
- Whether `factory` alone lists the commands skills run: no; it links to `docs/cli.md#run-for-you`.
- Whether one secret is one line in `doctor`: yes, naming every part that reads it.
- How a printed fix names a command: `factory X`, as the docs write it, in `doctor`, `init`, `config check`'s warning, and `sync --check`. The skills keep `npx --no-install`.
- Whether `plugins` changes: no. Skills read its lines, and `docs/cli.md` already names its columns.
- Whether the factory recolors another tool's output: no. It adds a line of its own after it.
- How npm's notices are hidden: each settings command runs with `npm_config_loglevel=warn` in its environment, unless the environment already sets it.
- Where the rules for command output live: a new section, "A command's output", in `docs/developing.md`, a line in this repository's own `dx-first` skill pointing to it, and the words "how a command's output reads" in `CLAUDE.md`'s "Rules by area" line for `docs/developing.md` (the owner, in the session). The Claude review reads every guide that list names, so it checks new output against the section; the words tell a session changing a command to read it.
- Whether `sync`'s "already match" sentence prints inside `init` and the preset commands, which run the sync: no, only for `factory sync` itself, so those commands read as approved.
- Which messages name a command as `factory X`: those of the commands only a person runs or reads, `doctor`'s and `init`'s fixes and messages, `sync --check`'s last line, `config check`'s design-skill warning, and the preset commands' missing-settings error. The stale-lock messages and `.npmrc`'s sync errors keep `npx --no-install`: every settings-reading command prints them, the session-start hook and workflows included, where no global install can be assumed.
- Whether `init`'s table of suggested columns follows board check's new words: yes. `column-suggestion` says it shows what board check prints.
- Whether `doctor`'s failing board line and the board sync's own log change: no. Only `board check`'s report is redesigned; the words the sync and `doctor` build from the same inspection stay.
- Whether this needs the `factory-trace` of "Changing the process": no. It changes what commands print and npm's log level for settings commands, not what triggers a step, who runs, or when.
- Build order: none. #37 may add lines to `doctor` and `config explain`; whichever lands second follows the other's wording, which is a merge conflict, not a blocker.
