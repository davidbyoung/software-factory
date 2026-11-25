# Design

## Where it goes

- `.github/workflows/review.yml`: `actions: read` beside `contents: read` in the top-level `permissions`, and one last step, "Check that factory.yml is enabled", in the `check` job. It is a script in the workflow, as `run.yml`'s own `gh api` steps are: `review.yml` is GitHub Actions' own, which "Adding a runner" in `docs/developing.md` says no interface covers. No `factory` command is added. Keep the header comment's claim true: it is given no secret and may only read.
- `src/workflow-files.mts`, `reviewWorkflow`: `actions: read` above `contents: read`. Then `node bin/factory.js sync` rewrites `.github/workflows/factory-review.yml`.
- `src/runner/setup.mts`: the check runs whatever `builds.trigger` and `builds.pollerIn` are. Rewrite its header comment and drop the `POLLER` alias, since the file is no longer only the poller's. `leftovers` is unchanged.
- `src/runner/types.mts`, `src/runner/github-actions.mts`, and `pollerCheck` in `src/doctor.mts` need no change. Lines 15 and 16 are its behavior today, and its tests stay. The organization's line already prints after the runner's checks. `workflowState` still folds every state but `active` into `disabled`: the check on a pull request reads GitHub's state itself, so it can tell them apart.
- The docs lines under "Proposed docs".

## Contracts

- The step: `if: ${{ !cancelled() }}`, `env: GH_TOKEN: ${{ github.token }}`, and `gh api "repos/$GITHUB_REPOSITORY/actions/workflows/factory.yml" --jq .state`.
- On a failed request `gh` prints GitHub's JSON on stdout, and `gh: Not Found (HTTP 404)` as the last line on stderr, and exits 1. So stdout is a state only when it exits 0, and 404 is told by `(HTTP 404)` at the end of that line.
- The errors and warnings are `::error::` and `::warning::` lines. The others are plain lines.
- GitHub's states are `active`, `deleted`, `disabled_fork`, `disabled_inactivity`, and `disabled_manually`.
- In `setup.mts`, REASON is `reasonOf(e)`. It and the `message` it calls are private to `src/doctor.mts`, which imports the tools, so move both to a new `src/lib/reason.mts` and import them in both files. `pollerCheck` keeps the `message(e)` it prints today.

## States

`active`, missing (404), off by GitHub, off by hand, off in a fork, and unreadable, as the Spec's lines give them. Nothing stores one.

## Edge cases

- The pull request `factory init` opens: `factory.yml` is not on the default branch, so GitHub answers 404.
- A pull request from a fork to the repository: `GITHUB_REPOSITORY` is the repository it is opened on, and a fork's token keeps its read permissions.
- An update's pull request: GitHub runs the pull request's own `factory-review.yml`, which grants `actions: read` and calls the `review.yml` of the version it names, so the two always agree.
- GitHub refuses a called workflow whose permissions its caller does not grant, so a repository must never call a new `review.yml` from an old `factory-review.yml`. Both come from one `factory sync`, and "Factory files in step" fails on a difference.

## Risks and rollback

- The job runs the pull request's own code in this repository (`npm ci`, `npm link`) before the new step, so that code could read the step's token. It may only read the code and Actions, as anyone who can open that pull request can. Keep `GH_TOKEN` on that step alone, so the "Compare the copies" step still runs the factory with no sign-in.
- If the step fails pull requests wrongly, take the step out. The permission can stay.

## Dependencies

None.
