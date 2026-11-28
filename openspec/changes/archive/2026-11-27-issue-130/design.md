# Design

## Where it goes

A rename across the package, done as one pull request so no release ships half of it.

- **The package and the command:** `package.json` (`name`, `bin`, `repository.url`), `bin/factory.js` becoming `bin/lunamill.js`, and `bin/launch.js` (the lock's path, `FACTORY_VERSION`, the cache folder, the package it downloads, its messages). The launcher's path is also written in `LAUNCHER` in `src/sync.mts`, in `src/doctor.mts`, `src/guard-commit.mts`, and `src/update.mts`.
- **Other shipped files:** `.claude-plugin/plugin.json` (its name), `settings.schema.json` (its title and descriptions, the key `tickets.labels.factory` and its default, and the file and agent names it quotes), `poller.Dockerfile` (the package, the launcher, the image's source label), and `.github/ISSUE_TEMPLATE/bug.yml` and `change.yml`.
- **Code that matches the prefix, not a string:** `src/remove.mts` (which skills and agents are lunamill's), `src/lib/output.mts` (how a skill's name is colored), `src/preset-commands.mts`, the built-in agent and skill ids in `src/config.mts` and `src/preset.mts`, and `tests/factory-columns.ts`. Each matches `lunamill-`. Temporary folders' prefixes such as `factory-ask-`, and `SESSION_FILE` in `src/lib/clock.mts`, become `lunamill-` too: nothing keeps them across a version.
- **Settings and files:** `src/config.mts` and every reader of `.claude/factory.yaml`, `.claude/factory.lock`, and `.claude/factory.choices.yaml`; `src/sync.mts` (`IMPORT_LINE`, the rules path, the not-installed message, the hooks); the source folders `skills/factory-*` and `agents/factory-*`, renamed to `lunamill-*`, and every reference to them; `review.md`'s copy path.
- **Workflows:** `src/workflow-files.mts` (file names, titles, job id, the `uses:` home from `FACTORY_REPOSITORY`, the `LUNAMILL_` secrets and variables, `POLLER_FILE`), and the workflows edited in place here: `run.yml`, the three `run-*.yml`, `review.yml`, `session.yml`, `poller.yml`, whose job names and `FACTORY_*` variables change. `run.yml`'s check for this repository's own package name changes to `@lunamill-ai/lunamill`.
- **Setup:** `src/init.mts` (`SET_UP`, `CHANGE`, `BRANCH`, `SIGNING_TITLE`, the first line), `src/setup.mts` (`RULE`), `src/init-org.mts` (`CONFIG`, `PROPERTY`, `BOARD_TITLE`, the description), `src/code-host/github-app.mts` and `appName` in `src/code-host/github.mts` (the App's name and slug, its page title), `src/preset.mts` (`PRESET_FILE`).
- **Folders:** `src/lib/cache.mts`, `src/lib/repositories.mts` (`WORK`), `src/lib/credentials.mts`, the path in `src/guard-credentials.mts` and in the hook `src/sync.mts` writes for it, and the `User-Agent` in `src/tickets/transport.mts` and `src/code-host/github.mts`.
- **Releases and updates:** `src/poller.mts` (`POLLER_IMAGE`), `src/update.mts` (`BRANCHES`, the titles, the lines it prints), `src/lib/docs-page.mts` (`FACTORY_REPOSITORY` becomes `lunamill-ai/lunamill`), `.github/workflows/release.yml` (the registry checks, the tarball address, the image tags) and `ci.yml`.
- **Prose:** every string a command prints, and the text of `skills/`, `agents/`, `rules.md`, `review.md`, `approval-policies/`, `README.md`, every page under `docs/` except the upgrade notes below "Moving to lunamill", `docs/developing.md`, this repository's `CLAUDE.md`, and `.claude/change-types.md`. The docs tests that read a command as `factory ...` read `lunamill ...`.
- **This repository's own setup:** tasks 2.2 and 7.3. The sync runs once, after every name it writes has changed, and the old import line and work folder are deleted by hand after it.

## Contracts

Every old and new name is in "The names, old and new" under Proposed docs, and Decisions add the preset file, the poller file, and the `User-Agent`. The environment variables are each `FACTORY_X` renamed `LUNAMILL_X`, for the secrets and variables a repository sets and for those the workflows set for themselves.

## States

n/a: no state is added. A repository is set up when `.claude/lunamill.yaml` exists, as it was with `.claude/factory.yaml`.

## Edge cases

- **A repository with both `.claude/factory.yaml` and `.claude/lunamill.yaml`** reads only `.claude/lunamill.yaml`.
- **Text quoting an old name on purpose:** the upgrade notes, a test fixture that is an old lock, and the `npm deprecate` message. The product-name test of Spec line 1 lists each file it allows, so a new old name elsewhere fails it.
- **Words that contain "factory" but are not the product,** and the marker comments and refs Decisions keep: the test of Spec line 1 matches the three phrases only, so `<!-- factory: ticket KEY -->` and `refs/factory/base` pass it. The old file and command names are each checked by the tests of their own Spec lines.
- **Version numbers in the transcripts,** such as 0.3.0, are examples, as in today's docs. The first release of `@lunamill-ai/lunamill` is 0.2.0, which the upgrade note's transcript shows.
- **`.claude/settings.json` here runs `node "$CLAUDE_PROJECT_DIR"/bin/factory.js`.** Task 2.2 renames the launcher and changes those paths in the same command, so the session's hooks never point at a missing file.

## Risks and rollback

- **A release with half the rename** would download a package that is not there. The rename is one pull request, and `npm run pack-check` installs the packed package in an empty repository and runs `lunamill` there.
- **Every pull request waits on `review / Factory files in step`** until the owner changes this repository's ruleset, at merge (Dependencies).
- **Rollback:** revert the pull request. `@davidbyoung/software-factory` is deprecated only after `@lunamill-ai/lunamill`'s first release works, so the old package keeps installing until then.

## Dependencies

- **Before the build,** the owner's, from "Moving the board": the repository moved to `lunamill-ai/lunamill` on 2026-11-27. The board's steps 2 to 7 do not block the build.
- **At merge,** the owner's: rename the label `factory` to `lunamill`; create `LUNAMILL_BOARD_TOKEN` and `LUNAMILL_BUILD_MODEL` from `FACTORY_BOARD_TOKEN` and `FACTORY_BUILD_MODEL`; change the ruleset's required check to `review / lunamill files in step`. The pull request lists them.
- **At the first release,** the owner's: `NPM_TOKEN`, then the trusted publisher, `npm deprecate`, and removing the token, as Q10 under Proposed docs says.
- **Build order:** none ("No build order" under Decisions).
