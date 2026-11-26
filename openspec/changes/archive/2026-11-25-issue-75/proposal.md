# Proposal

From [davidbyoung/software-factory#75](https://github.com/davidbyoung/software-factory/issues/75). The approved draft and docs are in [the ticket's comment](https://github.com/davidbyoung/software-factory/issues/75#issuecomment-7181101158).

## Why

A monorepo gets one `factory init` at its root, with one `.claude/factory.yaml` and one lock. A reviewer already applies by path, through its `files`. But `commands.gate` is one list, run from the root, so a monorepo with no tool of its own that checks only what changed runs every package's checks for every change.

The owner asked on 2026-11-23 for this to be ready before monorepos are supported: "when we get to the point of supporting monorepos, we should ensure we have ticket(s) teed up to support things like paths for gate commands."

It is not on the path of #73, #74, and #72, and waits on none of them. The docs say nothing about monorepos today.

## Done when

- A repository can say which commands run for a change under which paths. A change that touches none of a command's paths does not run it, unless it changes a file no gate command covers or the settings, which run every command.
- `factory gate` lists the commands it runs and why, and counts those it leaves out; `factory gate --dry-run` lists each with why.
- The docs say how to set the factory up in a monorepo.

## Decisions

- **Shape (Q1, Q2):** a command is plain text, as today, or an item: `run`, with optional `in` (the folder it runs in, or a list; a `*` only as a whole last name, as in `packages/*`) and `files` (the whole list of patterns that set it off; default `./**`). `./` is the item's folder; any other path starts at the root. Coverage's item also takes `report`, so today's `coverage: {run, report}` is an item already. The same in every key under `commands`; `site` takes a list of sites with the same `in` and `files`; a preset takes `in`.
- **The change decides what runs, not a path passed to a command (Q15):** no `factory gate --in`. Comparable tools all decide from the change.
- **Covered:** a changed file is covered when it matches a gate item's `files`, as written or as the `./**` an item with no `files` gets, or matches `commands.ignore`. A text command covers nothing, and an item that writes `files` covers only what they match, not the rest of its folder.
- **The run-everything rule applies only when the gate has an item** (owner, 2026-11-25). With an all-text gate, such as one Nx command, each other setting runs just its commands that match, and `factory config check` lists no uncovered files.
- **`commands.ignore` (Q16):** starts empty, and nothing ships in it (owner, 2026-11-25). It wins over `files`: an ignored file sets off no item, only text commands.
- **With a gate item, a file nothing covers, or a change to the settings files, runs every command** of gate, before-commit, relock, and site; coverage runs only what matches (Q17).
- **Only ignored files changed, or nothing changed:** the gate passes (Q3).
- **The gate counts left-out commands, and `--dry-run` lists each with why (Q9).** The "Done when" lines were reworded to match when the draft was saved.
- **`$FILE` starts at the item's folder (Q5).** `$BASE` is the merge base, or `HEAD` for before-commit, and empty when not found.
- **New commands `factory coverage` (Q13), `factory relock`, and `factory build-setup`,** so a script, not a session, picks which of a list runs. The skills stop reading those settings with `factory config get`.
- **An item that fails in one folder still runs in its others,** in every setting that runs a list, so each broken package shows in one run.
- **No package manager's files are read (Q14, Q8, owner):** dependencies are written by hand in `files`, and `factory init` is unchanged.
- **Presets for some folders are kept, with the rules in draft §14 (owner, 2026-11-25).** A repository can't take out one command a folder preset adds (Q12).
- **A ticket does not name its packages.** **One settings file, at the root;** notes for one package go in its folder's `CLAUDE.md`.
- **No blocker:** none of the open tickets has to be built first, and none waits on this one.
- **Existing settings stay valid,** so `docs/updating.md` needs no by-hand step.
