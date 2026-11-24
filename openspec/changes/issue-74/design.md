# Design

## Where it goes

- **`factory init --org`** is a new `src/init-org.mts`, started from `run` in `src/init.mts` when `--org` is given, with its own `Deps` in the shape of `InitDeps`, and tested in `tests/init-org.test.ts`. It shares `Ask`, `askCredential`'s loop, and the board steps with `init`: move what both use into `src/init-shared.mts` instead of importing `main`.
- **An organization on the code host:** new members of `CodeHost` in `src/code-host/types.mts`, filled in `github.mts`, since a second code host fills them its own way: `ownerOf(address)` beside `repositoryOf`, and an `organization(name)` object with `kind`, `role`, `plan`, `createRepository`, `putFiles`, `setSecret`, `setVariable`, `secretNames`, `defineProperty`, `requireCheckWhere`, `registerApp`, `installation`, and `setProperty`. `requireCheck` gains the status's source. The runner's `organizationSecretNames` stays where it is, and gains `organizationVariableNames`.
- **The manifest flow** is `src/code-host/github-app.mts`: the manifest, a listener from `node:http` on `127.0.0.1` and a free port, the state check, the conversion, a token for the App signed with `node:crypto`, and the wait for an installation. Its `fetch`, clock, and listener are injected.
- **The run's token:** `.github/workflows/run.yml`, `review.yml`, and `session.yml` declare `app-key` with `required: false`, and gain a step after the factory's install, `actions/create-github-app-token`, at the newest major, skipped when the key is empty, which a step before it tells through `env`, as `FACTORY_BUILD_TOKEN_SET` does today, with `client-id: ${{ vars.FACTORY_APP_CLIENT_ID }}`, `owner`, and `repositories` from a new `factory session repositories`, which prints the repository and the lock's presets of the same owner, comma-separated. Each later step reads `steps.app.outputs.token || secrets.build-token`, and likewise for the board and auto-merge tokens. "Set git's name and email" takes the App's branch when the step ran: `app-slug`, and the bot's ID from `gh api "/users/SLUG[bot]"`.
- **`poller.yml`** is new and is source, as `run.yml` is: add it to "Changing the process: this repository" in `CLAUDE.md`. `src/poller.mts` gains `--preset`, and `tick` runs once for each repository a new `Tickets` board method returns, `readyRepositories(board, column)`.
- **`factory enroll`** is a new `src/enroll.mts`, registered in `src/cli.mts`, run by a new job of `run.yml` on `push`, and listed under "Workflows and hooks" in `docs/cli.md`.
- **`init` in a repository:** `src/init.mts`. `remote` in `InitDeps` becomes `remotes`, and `git`, `gate`, and `openPull` are added. Which repository, the presets, and the pull request are three functions beside `main`, each tested alone in `tests/init.test.ts`. `src/lib/default-branch.mts` takes the remote's name from a function that finds it by the `repository` line.
- **The tokens on the machine:** `src/lib/credentials.mts` as it is, with the tool `github` and the coding agent's name, and the site `HOST/OWNER`. `src/code-host/github-setup.mts` and `src/agent/claude-code.mts` mark their secret step as kept on the machine. `tokenReads` adds `FACTORY_APP_PRIVATE_KEY` to each `anyOf`, and `partsOn` leaves `signing` off under it.
- **The lock and the sync:** `pinLines` in `src/preset.mts` and `lockText` in `src/sync.mts` for line 55, and `poller` in `partsOn` in `src/sync.mts` for line 56. `watchOf` in `src/lib/work-status.mts` takes the repository to name.
- **The poller's file** is a new `pollerWorkflow` in `src/workflow-files.mts`, which `init --org` writes and whose `cron` line `factory preset check` compares. There is no `workflows/` folder since #73. `src/update.mts` gains line 18's branch before it reads the settings. `src/guard-credentials.mts` is unchanged: it already refuses the file.

## Contracts

- **The manifest:** `name`, `url` (the factory's repository), `hook_attributes: {url: URL, active: false}`, `redirect_url` (the listener), `public: false`, and `default_permissions`: `issues`, `pull_requests`, `contents`, `statuses`, `actions`, and `repository_custom_properties` as `write`, `workflows: write`, `checks: read`, and `organization_projects: write`. It is sent as the field `manifest` of a form posted to `https://github.com/organizations/ORG/settings/apps/new?state=STATE`. The code is traded at `POST /app-manifests/CODE/conversions`, which answers `id`, `slug`, `client_id`, and `pem`. The install page is `https://github.com/apps/SLUG/installations/new/permissions?suggested_target_id=ID`.
- **The rule:** `POST /orgs/ORG/rulesets`, with `conditions.ref_name.include: ["~DEFAULT_BRANCH"]`, `conditions.repository_property.include: [{name: "software-factory", property_values: ["on"]}]`, and one `required_status_checks` rule whose check has `context: "Review verdict"` and the `integration_id` of GitHub Actions, with `do_not_enforce_on_create: true`. The property: `PUT /orgs/ORG/properties/schema/software-factory`, a `single_select`. A repository's value: `PATCH /repos/OWNER/NAME/properties/values`, which an installation's token may call with `repository_custom_properties: write`.
- **`presets.yaml`:** a map from `HOST/OWNER` to the list of preset names last chosen there, written at mode 600 beside the credentials file.
- **Secrets' reach:** `visibility: all`. **The count** in line 10 is `total_count` of `GET /installation/repositories`, asked with a token of the installation's, which the first run makes from the key while it holds it. A later run finds the installation among `GET /orgs/ORG/installations` by its client ID.

## States

An organization's setup is a set of five things, each there or not: the board the preset names, `factory-config`, the App with an installation, the two secrets and the variable, and the rule. Each step reads GitHub to tell, and nothing is kept on the machine.

## Edge cases

- GitHub limits an App's name. Read the limit from its docs, and when `Software Factory for ORG` is over it, shorten ORG and say so in the plan's row.
- An App of that name already registered, with no installation: the form says the name is taken. The line printed before the browser opens says to delete the old one under the organization's Developer settings, or to type another name.
- The pasted address is checked for the same `state` as the redirect is.
- A repository set up before the organization: its own secrets still win where both are set, and `init` offers to delete them, as it does for a part turned off.
- `init` run in a session with no terminal stops as today, so the gate and the pull request never run unattended.
- A fork with no parent on the code host is treated as not a fork.

## Risks and rollback

The App's key reaches every repository the secrets do. A run that leaks it is stopped by deleting the key on the App's page and running `factory init --org` again after making a new one. A wrong organization rule blocks merges only where the property is `on`: deleting the rule "Software factory" in the organization's settings undoes it.

## Dependencies

Owner-only: none before the build, since `aphiria` exists and the owner is its owner. The build registers an App there, stores secrets, and creates public scratch repositories and `aphiria/factory-config`. It says so in the session before it starts, and when done it archives the repositories, disables their workflows, and lists what the owner deletes: the App, the secrets, and the variable. This ticket waits on nothing open. #72 waits on it.

## To test first

The draft's three, and these, each with its fallback:

1. GitHub Actions' `integration_id` pins "Review verdict" in a rule, and a status of that name from another token then does not count. Otherwise the rule names no source.
2. An installation's token sets a repository's `software-factory` value. Otherwise `factory enroll` prints the `?` line, and "Left to do" for an organization names the property.
3. A manifest with `hook_attributes.active: false` registers an App with no webhook. Otherwise leave `hook_attributes` out.
4. A pull request that adds `factory.yml` waits forever when the rule is already there. Otherwise line 49 goes, and `init` makes the rule as today.
