# Design

## Where it goes

- **The launcher,** `bin/launch.js` and `bin/factory.js`, tested by `tests/launch.test.ts`. `chooseEntry` keeps rule 1, the factory's own source, and rule 4, itself. Rules 2 and 3 become: read `version:` from `.claude/factory.lock` at the repository's root with a regular expression, since the launcher loads no package; run a cached copy's `dist/cli.mjs`; download a missing one with `npm install --prefix DIR --no-save --no-audit --no-fund NAME@VERSION`. `FACTORY_VERSION`, when set, names the version in place of the lock: it is how `update` hands the sync to the newest release.
- **The cache,** a new `src/lib/cache.mts`: `$XDG_CACHE_HOME/software-factory`, or `~/.cache/software-factory`, with `versions/VERSION/` and `presets/HOST/OWNER/NAME/COMMIT/`.
- **Presets,** `src/preset.mts`, `src/preset-commands.mts`, `resolveFiles` and `staleOf` in `src/config.mts`, and `src/sync.mts` (`lockText`, `plan`, `--check`). `findPreset` reads the cache, not `node_modules`. Fetching goes through the code host's adapter (`src/code-host/types.mts`, `github.mts`): the URL to clone, the newest commit (`git ls-remote URL HEAD`), and one commit (`git init`, `git fetch --depth 1 URL COMMIT`). A preset of the repository's own owner uses the machine's git credentials, or `GH_TOKEN` in a run, and any other is fetched with credentials off. Delete the npm half: `findPackage`, `splitName`'s package form, `installError`, `registryOf`, `nextLines`, `hasOwnGroup`, `inPackageJson`, `withPresetPackages`, `syncedPackages`' presets, and `npmrcRegistry`.
- **The workflows.** `.github/workflows/run.yml` and `review.yml` are new and are source, not copies: they are edited where they are, as `CLAUDE.md`'s "Changing the process: this repository" will say. `workflows/` keeps two templates, `factory.yml` and `factory-review.yml`. The other ten and `actions/factory-agent/` go, their steps moving into the two reusable workflows. `src/sync.mts` loses `NEEDS`' workflow rows and the `with...` rewriters, and gains one function that fills the two templates. `src/runner/github-actions.mts` starts and finds runs by `factory.yml`, with `job` and `ticket` inputs.
- **Parts off:** `reviewExpected` in `src/pr.mts`, `reviewIsOver` in `src/pr-watch.mts`, and `decide` in `src/review-verdict.mts` each take whether `pr-review` is set, read where their caller already loads the settings.
- **Updates,** a new `src/update.mts`, registered in `src/cli.mts`. `src/deps.mts` and `skills/factory-deps` lose the factory's and presets' step 4.
- **The policy,** in `src/code-host/github.mts` beside `requireCheck`, with its line in `types.mts`, and a check in `src/doctor.mts`.
- **Text:** replace `npx --no-install factory` with `factory` in `skills/`, `agents/`, `rules.md`, `src/` messages, `tests/`, `docs/developing.md`, `CLAUDE.md`, and `.claude/skills/dx-first` and `ticket-order`. `SYNC` in `src/preset.mts` and `src/npmrc.mts` becomes `factory sync`. `rules.md`, "Branching, pushing, and review": a push gets a review only where the review is on. `tests/docs.test.ts` stops allowing the `npx` form anywhere. `CLAUDE.md` also changes where it names `factory-check.yml`, and under "Changing the process: this repository", which names `run.yml` and `review.yml` as source. `settings.schema.json` describes `presets` as repositories.
- **Everything else that names the install:** `src/init.mts` (`hasPackage`, the `package.json` write, `.gitignore`), `src/remove.mts`, `src/doctor.mts` (`versions`, the poller's lines), `launcherPath` and `factoryHooks` in `src/sync.mts`, `tests/pack-check.mts`, which installs the tarball with `npm install -g --prefix TEMP` into a scratch repository with no `package.json`, and `docs/`.

## Contracts

- **The lock:** as line 44 and the draft's example. Keep `settings-hash`, `npmrc-variables`, `settings`, `overridden`, and `files`.
- **`run.yml` inputs:** `parts`, `job`, `ticket`, `pr`, `review`, the sessions' minutes, and the override label. **Secrets,** each `required: false`: `build-token`, `board-token`, `automerge-token`, `signing-key`, `claude-token`, `claude-api-key`, and `extra`, one JSON object of the secrets `.npmrc` and the ticket system name, which sync writes with `format()` and `toJSON()`. A job masks each value with `::add-mask::` before it exports it. `vars.FACTORY_BUILD_MODEL` is the caller's.
- **Check names** become `factory / NAME` and `review / NAME`, so the two calling jobs keep different ids. "Review verdict" is a commit status and keeps its name.
- **Each job's first steps:** check out, set up Node, and install the factory: `npm install -g NAME@VERSION` with the version from the checkout's lock, or `npm ci && npm link` where `package.json` names the factory itself.
- **A job a part turns off** has `if: contains(inputs.parts, 'NAME')`. A session job's first step decides from the event, `factory pr conflicts` and its like run with `github.token`, and whether the token secrets are empty.
- **Which job an event starts,** by a fixed `if` on each job. `pull_request_target`: the verdict (`opened`, `reopened`, `synchronize`, `ready_for_review`, and a label event for the override), who merges (the first four), and the board sync (`opened`, `closed`, `reopened`, `ready_for_review`, `converted_to_draft`). `workflow_run`: the verdict. `pull_request_review`: answering your review. `push`: the check and the conflict sweep. `schedule`, by `github.event.schedule`: `0 1,13,19 * * *` is Dependabot's pull requests and Updates, `0 7 * * *` the board sync, `0 9 * * *` the conflict sweep, and any other the poller, whose line sync adds last, as `- cron: "*/5 * * * *" # the poller`. `workflow_dispatch`: the job `job` names, where `review` is answering your review, or a build when only `ticket` is given. Any other value fails one job that says `Unknown job NAME`.
- **The automated review's identity:** its check is `review / Claude review`, which `REVIEW_CHECK` in `src/pr-watch.mts` names. `reviewRuns` and `REVIEW_WORKFLOW` read the runs of `factory-review.yml`. The verdict and `pr watch` read that job's conclusion from the run's jobs, not the run's, so a failed "Factory files in step" changes no verdict.
- **A hook's command** is `command -v factory >/dev/null 2>&1 || { echo "LINE" >&2; exit 2; }; factory guard`, with `echo "LINE"; exit 0` for the session-start hook, since a session shows that hook's stdout, and `factory ... 2>/dev/null || true` for the permission and reviewer hooks. `isFactory` matches `factory (session-start|guard|reviewers)` as a command, and still `/bin/factory.js`, so an old entry is replaced.
- **`--against COMMIT`** reads the base lock with `git show COMMIT:.claude/factory.lock`. The check's job fetches that commit.
- **The newest release** is `releases/latest` of `davidbyoung/software-factory` through the adapter, less its `v`, which leaves out drafts and prereleases.
- **One update at a time:** for each, `git switch -c BRANCH origin/DEFAULT`, make the change, commit it as its title, push, open the pull request through the adapter, and switch back, so no change rides on another.
- **The policy:** as GitHub's REST page "Actions policies" read on 2026-11-23, to be checked first. `GET /repos/OWNER/REPO/actions/policies` lists those that apply. The event is allowed when an `active` one has a `restrict_action_events` rule with `pull_request_target` in `allowed_events`, and no path condition or one that includes the file. `init` cannot add it when either call fails. To add: `POST /repos/OWNER/REPO/actions/policies` with `enforcement: active`, `conditions.workflow_path.include: [".github/workflows/factory.yml"]`, and a `restrict_action_events` rule whose `allowed_events` are that file's triggers. Never write one without the path condition: it would block the repository's other workflows.

## States

A preset is unpinned (named, not in the lock), pinned, or behind. An update's pull request is absent, open, or closed or merged, by its branch's name.

## Edge cases

- Two presets from one repository can be pinned to different commits. Hash each preset's own files, including one that loses to another preset or to the repository's own file.
- A lock with conflict markers still yields `files`, as today.
- A pull request from a fork or Dependabot gets empty secrets: the check passes without them unless it has to read a private preset, and the review job is skipped as today.
- `sync --check` in the gate has no base branch, so it compares copies with hashes and reads no network. The pull request's check passes the base commit.
- `factory update` in a repository whose lock an older factory wrote: read only `version` and `files` from it.

## Risks and rollback

Every repository's CI now depends on the factory's repository and npm at run time, where it depended on npm at install. A broken `run.yml` breaks each repository only once it merges that release's pull request, and reverting that pull request restores it. After a release, the owner tries it first from his other repository, which is outside the build.

## Dependencies

Nothing blocks this ticket. #74 and #72 wait on it. Owner-only, outside the build: the policy on `davidbyoung/software-factory` before December 2, 2026.

## To test first

Beyond the draft's two, each with its fallback. Nothing here uses `$/` or `job.workflow_sha`: every step is a `factory` command from the installed package.

1. `workflow_run` on the name `Factory review` fires when that calling workflow completes. Otherwise the verdict's trigger is a third file.
2. A reusable workflow's `run-name` and `concurrency`: the calling file's `run-name` names a build `Build #12`, and an empty one falls back to GitHub's default. Otherwise write every run's name out.
3. `extra` built with `format()` and `toJSON()` reaches a job, and its values are masked. Otherwise sync writes one fixed secret for each of up to five names.
4. A repository policy scoped to one workflow path lets `pull_request_target` run there once GitHub enforces its default, on a personal account, and the API accepts the build's and `gh`'s tokens. Otherwise lines 21 and 22's `?` are all there is, and `docs/github/by-hand.md` gives the steps.

The draft's two, from "To test first when building" under the ticket's "Proposed docs":

1. One workflow file can hold every trigger that must run from the default branch's copy. Otherwise there are three files and not two.
2. A run can download one commit of another owner's public repository with git and no sign-in. Otherwise it reads the files through the code host's API. GitHub says of that endpoint: "This endpoint can be used without authentication or the aforementioned permissions if only public resources are requested." GitHub limits requests made with no sign-in, which is one reason a run reads a preset's repository only on a pull request that changes the preset.
