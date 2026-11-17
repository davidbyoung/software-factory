# Design

## Where it goes

- `src/poller.mts`: `run(argv)` takes `--once`, which runs one `tick` and exits 0, or 1 when the tick's read failed. The `poller` route in `src/cli.mts` (line 211) passes its arguments through. `tick` already never throws and counts failures in `state.failuresInARow`; `--once` exits 1 when that is above 0 after the tick. The settings are read with `loadSettings`, and `Deps` gains what `--once` needs from them; the hosted path keeps `readConfig(env)`. With no `tickets.board`, or the Ready column set to `none`, `--once` prints which and exits 1 before reading anything (line 3).
- `src/board.mts:266`: its note "The poller needs FACTORY_READY_COLUMN set" applies only to `own-server`; with `github-action` the poller reads the column from the settings.
- `src/lib/work-status.mts` or `src/poller.mts`: a pure function that counts start comments (`commentBody({ kind: "started" })`'s marker) in the snapshot newer than an hour, replacing `state.fired` in `capAllows`, plus the starts the current tick has made itself, since its own start comments are not in the snapshot it read: one tick never starts more than the cap allows. The snapshot holds every open ticket and the 30 closed ones most recently updated, which covers an hour's starts.
- `workflows/factory-poller.yml` (new), written by `factory sync` when `builds.trigger` is `github-action`: an entry in `NEEDS` in `src/sync.mts`. Its `cron` line is rewritten from `builds.poll-minutes` the way `withMinutes` rewrites minutes: `*/N * * * *`, or `0 * * * *` for 60. `on: schedule` and `workflow_dispatch`; `concurrency: { group: factory-poller, cancel-in-progress: false }`; `permissions: contents: read`; steps: checkout, set up Node 22, `npm ci`, then `npx --no-install factory poller --once` with `FACTORY_BOARD_TOKEN: ${{ secrets.FACTORY_BOARD_TOKEN }}`. `tests/fork-safety.test.ts` must still pass: a schedule runs the default branch's code.
- `src/config.mts`: drop the `github-action` refusal from #9; add `poll-minutes` to `builds` in `SETTINGS_KEYS`, `settings.schema.json`, and `Settings`.
- `src/parts.mts`: the `from-board` part's `gives` text (line 19).
- `src/init.mts`: the "Where does the poller run?" and "How often?" questions through the existing `Ask` interface, asked after the parts when `from-board` is newly chosen; `Ask.select` (line 70) gains a default, for 30 on a private repository. Lines 368 and 369 remove `builds.poll-minutes` alongside `builds.trigger` (line 18); the "Left to do" step at line 618 for own-server, with `manifest.version`.
- `src/code-host/types.mts` and `github.mts`: `isPrivate(): Promise<boolean>`, from `GET /repos/{owner}/{repo}`'s `private`.
- `src/runner/types.mts` and `github-actions.mts`: `workflowState(file): Promise<"active" | "disabled" | "missing">`, from `GET /repos/{owner}/{repo}/actions/workflows/{file}` (`state` starting `disabled`, and 404 as `missing`). The in-memory runner in the tests gets the same.
- The runner's setup in `src/tools.mts` (line 81, `{}` today) gains `checks`, with the check in lines 22 and 23 only when `c.settings.builds.trigger` is `github-action`, and `leftovers`, with "The poller you host" when it is `own-server` (line 24). `src/remove.mts:157` and `doctor` already call both on every tool.
- `src/lib/work-status.mts`: `isNotStarted` takes the minutes to wait; `src/status.mts` passes `poll-minutes + 15` or 5, and the flag's text by trigger.
- `poller.Dockerfile`: becomes the image's file, installing `@davidbyoung/software-factory@$VERSION` with `npm install --omit=dev` from a build argument, with `LABEL org.opencontainers.image.source=https://github.com/davidbyoung/software-factory` and `CMD ["node", "node_modules/@davidbyoung/software-factory/bin/factory.js", "poller"]`. The test that the image copies every file the poller imports goes, since nothing is copied. Outside a repository, `bin/factory.js` runs the installed `dist/` (`docs/developing.md`); task 6.3 shows it does.
- `.github/workflows/release.yml`: a job after `publish`, with `packages: write`, that logs in to `ghcr.io` with `GITHUB_TOKEN`, builds `poller.Dockerfile` with `VERSION` from the tag, and pushes both tags. It retries `npm view` until the new version is visible, for up to five minutes, before building.

## Contracts

- Setting: `builds.poll-minutes`, one of 5, 10, 15, 30, 60; default 5; only with `builds.trigger: github-action`.
- Workflow: `.github/workflows/factory-poller.yml`, secret `FACTORY_BOARD_TOKEN` (already set wherever there is a board, which `from-board` needs).
- Image: `ghcr.io/davidbyoung/software-factory-poller:VERSION` and `:latest`; environment as today's hosted poller.

## Edge cases

- A run that starts late or overlaps: the concurrency group, and the start comment that ends Ready.
- A Ready ticket with an open blocker: skipped, as today.
- A private repository on the Free plan: the cost line in `init` and `docs/builds.md`.
- A schedule switched off by GitHub: `doctor`'s check.
- `init` before the first commit: the workflow is missing, which is off, not failed.
- The package's first image is private on GitHub's registry: the release job sets nothing, so see Dependencies.

## Risks and rollback

- A broken scheduled run fails every few minutes and emails the owner. The first thing to change is `builds.trigger` back to `manual`, then `factory sync`.
- A bad image tag: hosts pin a version, so the previous tag keeps running.

## Dependencies

- **Owner, after merging:** release a version as usual. Then pull the image with no sign-in (`docker logout ghcr.io; docker pull ghcr.io/davidbyoung/software-factory-poller:VERSION`); if it is refused, set the package to Public on its GitHub page, once.
- No blocking issue.
