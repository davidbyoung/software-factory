# Design

## Where it goes

- **`src/npmrc.mts` (new):** reads `.npmrc` text into `{ names: string[]; signIns: { name, key }[]; registries: string[] }`, with npm's rules for `${NAME}`, `${NAME?}`, and `\${` (`@npmcli/config`'s `env-replace.js`), comment lines (`#`, `;`), and CRLF. `addressOf(key, registries)` gives line 10's `ADDRESS`. Move `npmrcRegistry` here from `src/preset-commands.mts` and import it there. Also the name checks of lines 6 and 7, as errors with those messages.
- **`src/sync.mts`:** `plan()` reads `.npmrc` at `root` and, with names, passes each workflow it writes through `withNpmEnv(text, names, from)`, a text edit like `withDefaultBranch`: find each job (a two-space-indented key under `jobs:`) that has a step running `npm ci` or using `./.github/actions/factory-agent`, read with `js-yaml` to know which, and insert `    env:` and its entries after that job's `runs-on:` line; for `GITHUB_TOKEN`, insert `  packages: read` after the top-level `permissions:` line. A job that already has an `env:` would get its entries added under it, though none does today. Without names, the text is untouched (line 4). A workflow with no such job is left alone; a source whose installing job has no `runs-on:` throws, naming the file, as `withMinutes` does. `main` prints a name error and exits 1 before writing. `LockParts` gains `npmrcVariables`, written by `lockText` after `settings-hash` as a block list, or `npmrc-variables: []`.
- **`src/preset.mts`:** `Lock` gains `npmrcVariables` (missing reads as `[]`); `staleMessages.npmrc`; `staleReason` takes the current names (a new `StaleDeps.npmrcNames`) and compares them, in order, right after the hash. `src/config.mts`'s `staleOf` reads `.npmrc` at the root for it.
- **`src/runner/types.mts` and `github-actions.mts`:** `secretNames()` keeps its meaning and its callers. Add `dependabotSecretNames(): Promise<string[]>` (`GET /repos/{o}/{r}/dependabot/secrets`), `setDependabotSecret(name, value)` (`gh secret set NAME --app dependabot --repo ...`), `organizationSecretNames(): Promise<string[]>` (`GET /repos/{o}/{r}/actions/organization-secrets`), and `organizationDependabotSecretNames(isPrivate: boolean): Promise<string[] | null>` (`GET /orgs/{org}/dependabot/secrets`, then for `selected` visibility `.../{name}/repositories`, and `private` counting only when `isPrivate`; `null` when GitHub refuses the call). Neither is called on a person's repository. The code host gains `ownerIsOrganization(): Promise<boolean>` in `src/code-host/types.mts`, from `GET /users/{owner}`'s `type`, `Organization` or `User`, with `tests/memory-code-host.ts` and `tests/code-host-github.test.ts` to match; `doctor` and `init` ask it once, and `codeHost.isPrivate()` for the visibility. A refusal is never read as a person's repository. `tests/memory-runner.ts` gets the same, from options.
- **`src/setup.mts`:** `Check.state` gains `"unknown"`.
- **`src/doctor.mts`:** the Actions set the factory checks is the repository's names plus `organizationSecretNames()`, and `secretLine` says "set by the organization" for one found only there (line 22). New `npmChecks(root, runner, ...)` makes lines 16 to 20, inserted where line 21 says. `line()` prints `? ` for unknown; `main` fails only on `fail`.
- **`src/init.mts`:** the "Found" row; `isSet` also counts organization Actions secrets, and organization Dependabot secrets for the Dependabot copy, while `deletable` keeps the repository's own list; after the tools' secrets and before the signing key, a loop over the names other than `GITHUB_TOKEN` that asks per lines 9 to 14, through `d.ask.secret` and the runner's two setters. The plan's `Secrets` line lists each name with what it will store. `stillRead` and `deletable` leave these names alone.
- **Workflow sources** under `workflows/` and `actions/` do not change.
- **Docs:** `docs/github/setup.md`, `docs/presets.md`, `docs/limitations.md`, `docs/github/reference.md`, and `docs/github/by-hand.md`, as Proposed docs. `docs/cli.md` is unchanged: no new command.

## Contracts

- `.npmrc` at the repository's root, the repository's own; read, never written.
- `.claude/factory.lock`: `npmrc-variables`, a YAML list of names.
- Workflow `env` entries: `NAME: ${{ secrets.NAME }}`; for `GITHUB_TOKEN`, the same with `packages: read` in `permissions`.
- GitHub REST: `GET /repos/{o}/{r}/dependabot/secrets`, `GET /repos/{o}/{r}/actions/organization-secrets`, `GET /orgs/{org}/dependabot/secrets`, `GET /orgs/{org}/dependabot/secrets/{name}/repositories`; `gh secret set NAME --app dependabot --repo O/R`.

## States

A secret's state, for each of Actions and Dependabot: set on the repository, set by the organization, not set, or unknown (Dependabot on an organization's repository whose organization secrets cannot be listed). `doctor` maps them to pass, pass, fail, and unknown; `init` asks for not set and unknown.

## Edge cases

- The same name in two sign-in lines: taken once.
- `.npmrc` with CRLF line ends, comments, spaces around `=`, and a quoted value.
- A `registry=https://registry.npmjs.org/` line: no registry check (line 19).
- Several `package-ecosystem: npm` entries in `dependabot.yml`: each must list the registry.
- A Dependabot secret visible as `private` on a public repository: not shared.
- A workflow sync does not write for this repository's parts: unaffected, as it is not written.
- The `factory-check.yml` this repository runs on itself: it has no `.npmrc`, so line 4 holds and CI is unchanged.

## Risks and rollback

A wrong transform breaks every workflow at once in a repository with an `.npmrc` token line. Line 4 keeps every other repository unaffected. Rollback in a repository: remove the variable from `.npmrc` and sync, which writes today's workflows. The token reaches cloud sessions: the docs say to keep it read-only.

## Dependencies

None. No owner-only step. #33 changes `src/init.mts` too: a merge conflict at most.

**For the build to confirm**, each with one run on a scratch repository, or else named as unverified in the pull request body for the owner:

- A run that a Dependabot pull request starts can be given `packages: read` (line 5).
- On a public repository, `cache: npm` does not hand a fork's pull request the private packages the default branch cached. If it does, say so in the reference's Limits.
