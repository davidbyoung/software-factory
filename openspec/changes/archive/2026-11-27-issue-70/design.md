# Design

## Where it goes

- `src/poller.mts`. Today `tick` reads everything from `d.env`, and `onceEnv` turns a scheduled pass's settings back into those variables. Make `tick` take the resolved values instead (owner, board number, token, columns, label, cap, ticket system), so the hosted poller and `once`/`onceEach` hand it the same thing; `once` keeps `not polling: FACTORY_BOARD_TOKEN not set` for its own missing token. The hosted path, in `main` and a function it calls each pass:
  1. `readConfig` requires only `FACTORY_BOARD_TOKEN` (Spec 13); `FACTORY_REPOSITORY` stays checked in `main`.
  2. Open the transport, the code host, and the `file` reader without a board (today `sources` needs `Config.number`; split it). Read the default branch once with `codeHost.defaultBranch()`, as `tick` does now, before reading the lock, since every log line names it.
  3. `file(repository, LOCK_FILE)` (`LOCK_FILE` in `src/preset.mts`); `null` is Spec 5. Parse with `readLock` and js-yaml's `load`, as `triggerInEffect` does.
  4. From `lock.settings`, build a new object of only the keys Spec 1 names, and nothing else: `version`, `repository`, `tickets.type` (with the option keys its ticket system declares in `BUILT.tickets`, none for GitHub), `tickets.board`, `tickets.columns.ready` (no other column), `tickets.labels.factory`, `builds.trigger`, and `builds.max-per-hour`. Every other key and value is dropped before parsing, known or not, so a newer value of `builds.runner`, `builds.poll-minutes`, or `tickets.fields` can't stop it (Spec 9). Parse that object with `parseSettings(raw, () => true, BUILT, { partial: true })`. A `SettingsError` is Spec 8: its message is `FILE: KEY: WORDS`; keep `KEY: WORDS`. Then `onceSettings` gives board, ready, label, cap, and ticket system. Check, in this order: Spec 8 (the parse), Spec 6 (`builds.trigger`), Spec 7 (`board === null`), then a `ready` of null, which is Spec 8 with `tickets.columns.ready: no column shows ready, so nothing would start a build: name one, or set builds.trigger to manual`, the words `parseSettings` uses, in case `partial` let it through.
  5. The version suffix of Spec 8 compares `lock.version` with the package's own `version` (read the manifest as `src/init.mts` does for `packageVersion`), and the image name is `ghcr.io/davidbyoung/software-factory-poller`, now in `src/init.mts` as `POLLER_IMAGE`: move it where both can import it.
- `State` gains the last `settings from` line logged, the current `not polling` reason (null while polling), and whether the old variables were named. The heartbeat reads `heartbeat: not polling: REASON` while a reason holds, and is otherwise today's line. A pass that read the lock sets `failuresInARow` to 0 before anything else, whether it then polls or logs a reason (Spec 10); Spec 12 and Spec 13 increment it, as a failed read and a missing variable do today.
- The header comment of `src/poller.mts` (lines 1 to 25) and the doc comments on `columnsFrom`, `readConfig`, and `run` describe the hosted environment; rewrite them for what the code then does. `columnsFrom` goes if nothing reads it.
- `src/board.mts`: in `boardRows`, the `own-server` branch of the ready row goes; in `boardReport`, the `hosted` label and builds blocks go, and `MAX_PER_HOUR` and `TICKET_LABELS` imports go if unused.
- `src/init.mts` ("Left to do", near line 2799): drop the `owner` variable if nothing else reads it. The step loses `FACTORY_BOARD_OWNER`, `FACTORY_BOARD_NUMBER`, and `FACTORY_READY_COLUMN`, and gains Spec 14's line, chosen by whether `pull?.state === "opened"`. It is a `say.step`'s first piece split on `\n`; the new line is plain text, not a copied value, so it goes in as `say.asIs`, not `say.copy`.
- Docs: `docs/builds.md`, `docs/configuration.md`, and `docs/updating.md` as Proposed docs shows them, then `npm run format` (Prettier pads the tables).
- Specs: `factory specs new 70` and `factory specs finish 70`, with the requirements Spec names in `board-poller`, `cli-output`, `poller-image`, and `docs`.

## Contracts

- Environment of the hosted poller: `FACTORY_REPOSITORY` (owner/name) and `FACTORY_BOARD_TOKEN`. The five others are read only to name them (Spec 4), and never for a value.
- The file read: `.claude/factory.lock` on the default branch, through the GitHub contents API the organization's poller already uses (`githubOrganization(...).file`).
- Log lines: exactly as Spec 2 to 13 word them, each after the ISO time `stamped` puts first.

## States

The hosted poller, per pass: **reading** → **polling** (settings read, `own-server`, a board) or **not polling** (Spec 5 to 8, with a reason) or **read failed** (Spec 12). Polling is today's pass. Not polling moves back to polling at the first pass whose read clears the reason, logging the `settings from` line if it differs from the last logged.

## Edge cases

- The lock's `version:` matches the poller's and a setting still fails: no suffix. This repository's package and lock both say `0.0.0-development`, so the tests inject the poller's own version to reach the suffix.
- A lock from a release before `settings:` was recorded: `readLock` gives `settings: null`; that is Spec 8 with the reason `.claude/factory.lock on BRANCH: ` and `staleMessages.earlier`'s words after `.claude/factory.lock ` (`is from an earlier version of the factory. Run: factory sync`), plus the version suffix when it differs.
- A lock that is not YAML: Spec 8, with js-yaml's first line as the fault.
- The default branch can't be read: today's `default branch not read: ERROR`, counted as a failure.
- A variable set to spaces counts as not set, for Spec 4 and 13 alike.
- The settings' `repository` differs from `FACTORY_REPOSITORY` (a renamed repository): poll `FACTORY_REPOSITORY`, as today.

## Risks and rollback

A poller that can't read the lock starts no builds; its log says why. Rollback is running the previous image, which still reads today's variables, with them set again.

## Dependencies

None. No open ticket blocks this one or waits on it (Decision 13). The owner releases it; `docs/updating.md`'s new section is the release's note for a host.
