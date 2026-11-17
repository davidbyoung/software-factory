# Proposal

From [davidbyoung/software-factory#12](https://github.com/davidbyoung/software-factory/issues/12).

## Why

A repository with nowhere to run a container cannot start builds from the
board: the only poller is one you host. And a repository that does host
it writes its own Dockerfile, since `poller.Dockerfile` builds only from
the factory's own repository.

## What Changes

- `builds.trigger: github-action` is built: a workflow `factory sync`
  writes runs `factory poller --once` on a schedule, every
  `builds.poll-minutes` minutes, 5 by default.
- The hourly cap on builds counts the start comments on the tickets, so it
  holds across scheduled runs and across a restart of the hosted poller.
- `factory init` asks where the poller runs, the schedule first, and on a
  private repository how often. `doctor` checks the workflow is enabled,
  and `remove` names a hosted poller as left by hand.
- Each release publishes the poller's image to GitHub's container registry.
- `factory status` waits for the schedule before flagging a Ready ticket as
  not started.

Decisions carried from the issue:

- **Build the scheduled poller.** It is the only way to start builds from the board with nothing to host: a board owned by a person sends no event a workflow can listen to. (Owner, in session, 2026-11-16.)
- **Every 5 minutes by default, the fastest GitHub allows,** changeable with `builds.poll-minutes` (5, 10, 15, 30, or 60). A card realistically starts 5 to 15 minutes after it moves to Ready, since GitHub starts scheduled runs late when it is busy. On a private repository, where each run bills at least one Actions minute, `init` shows the monthly minutes and asks the interval, suggesting 30. Public repositories pay nothing. (Owner, in session, 2026-11-16.)
- **The image is published, not written into the repository.** Each release pushes `ghcr.io/davidbyoung/software-factory-poller:VERSION`, built from that version on npm, as self-hosted tools such as Renovate do. `init` prints the image and its settings. For a host that builds from the repository, the docs give a one-line Dockerfile the user adds themselves, which Dependabot's `docker` updates keep current. GitHub's registry over Docker Hub: the release workflow pushes with the token it already has, and pulling needs no account. (Owner, in session, 2026-11-16.)
- **`init` offers the schedule first,** then a server you host. (Owner, in session, 2026-11-16.)
- **The hourly cap counts start comments,** not a count in memory, so it holds across scheduled runs and across a restart of the hosted poller. Both kinds of poller use it.
- **Poller runs never overlap; builds do.** The poller's workflow runs one check at a time, and a ticket with a start comment is no longer Ready, so a late check cannot start a ticket twice. Each build it starts is its own run of `factory-build.yml`, as with the hosted poller, so several build at once, up to the 20-an-hour cap and GitHub's limit on jobs an account runs at the same time.
- **`--once` reads the settings,** since its workflow has a checkout: the repository, the board, and the Ready column. The board's owner is the repository's owner, as `factory board` reads it. The hosted poller keeps its environment variables, since it has no checkout.
- **A re-run asks neither poller question when its value is set,** as `init` already does for every value ("A value already set" in `openspec/specs/tool-setup/spec.md`). To change the interval or where the poller runs, edit `.claude/factory.yaml` and run `factory sync`.
- **`builds.poll-minutes` goes when the schedule goes:** `init` removes it when the part is turned off or the server is chosen, so `config check` never fails on a value `init` left behind.
- **The image is checked after the first release.** Releases are the owner's (`CLAUDE.md`), and the release workflow runs only on a pushed tag, so the pull request proves the image with a local build from the latest published version, and the owner pulls the first published one.
- **`doctor` checks the workflow is enabled,** since GitHub switches off a public repository's schedules after 60 days with no activity, and the board would then stop starting builds without a sound.
- **Build order:** nothing blocks this, and nothing waits on it. #14 touches the settings and the poller's start check, which is a merge conflict, not a blocker. #13 has merged.

**Not doing:** a poller faster than GitHub's schedule allows; Docker Hub; writing a Dockerfile into a user's repository.

**Checked by review, not by a test:** `init`'s new lines, by the builder's side-by-side comparison in the pull request of its output for each choice on a public and a private repository; and the image, by a local build and run from the latest published version. Lines 29 and 30, the anonymous pull and the label Dependabot reads, need a published image, so the owner confirms them after the first release.

## Impact

`src/poller.mts`, `src/cli.mts`, `src/config.mts`, `settings.schema.json`,
`src/sync.mts`, `workflows/factory-poller.yml`, `src/init.mts`,
`src/parts.mts`, `src/tools.mts`, the code host and runner interfaces,
`src/lib/work-status.mts`, `src/status.mts`, `src/board.mts`,
`poller.Dockerfile`, `.github/workflows/release.yml`, and the docs.
