# Updating

**When a new version is released, a pull request appears in your
repository. You read it and merge it.** That is all you have to do.

One release asks more of you, because it changes the shape of your
settings file: [Moving to settings version 2](#moving-to-settings-version-2).

## What happens

1. Dependabot's weekly run finds the new version and opens one pull
   request for it, as it does for any package. Its group for the factory
   ([on GitHub](github/reference.md#dependency-bots)) keeps the pull
   request to the factory alone.
2. `factory-deps`, which already looks after Dependabot's pull requests,
   runs `factory sync` on its branch and adds what it wrote as a second
   commit. Until it has, CI's `factory sync --check` fails.
3. You read it and merge it. It never merges itself, whatever your
   [`auto-merge`](configuration.md#auto-merge) settings allow.
4. Everyone working on the repository, you included, pulls and runs
   `npm ci`, as after any dependency change.

## What the pull request holds

- **The new version**, in `package.json`, the lockfile, and
  `.claude/factory.lock`.
- **The factory's files, rewritten.** Its skills, agents, rules, and CI
  workflows live in your repository, so the diff shows exactly which
  instruction changed.
- **A comment from `factory-deps`** listing the files the sync changed,
  and anything the release notes say to do by hand, first.

An update changes the instructions your sessions follow and the code that
runs with your tokens. Read it as carefully as you would read code.

## Doing it yourself

To update now instead of waiting for Dependabot:

```bash
npm install --save-dev @davidbyoung/software-factory@latest
factory sync
```

Commit both on a branch and open a pull request. To see whether you are
behind without changing anything:

```bash
factory doctor
```

## Staying on a version, or going back

- **To stay where you are,** close the update pull request. Dependabot
  opens a new one for the next release.
- **To go back,** revert the update's pull request. The version and the
  files go back together.

## Without Dependabot

Update by hand as above. `factory-deps` and its workflows are written only
once `.github/dependabot.yml` exists.

## Moving to settings version 2

One release changes the shape of `.claude/factory.yaml`, from version 1 to
version 2, and no command converts the file: you move it by hand, once.
Until you do, every command that reads the settings stops with:

```text
.claude/factory.yaml: version: must be 2: this file is version 1, see "Moving to settings version 2" in docs/updating.md
```

So `factory-deps` cannot run `factory sync` on that release's pull request,
and its checks fail until the file is moved. On the pull request's branch:

1. Edit `.claude/factory.yaml` as the table and the example below show.
   A row applies only when your file has that key.
2. Add [`commands.gate`](configuration.md#commandsgate), which is new and
   which a build cannot finish without. Put in it the commands your
   `CLAUDE.md` names as the check before a task is done, usually what CI
   runs, such as `npm run check`.
3. Once `commands.gate` holds the gate, change the gate's prose in your
   `CLAUDE.md` to point at `npx --no-install factory gate`, so the two
   cannot differ.
4. Run `factory config check`, then `factory sync`, and commit what
   changed.

**It worked when** `factory config check` prints nothing, and
`factory sync --check` passes.

### Each key that moved or changed shape

| Version 1                                                                | Version 2                                                                                      |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `version: 1`                                                             | `version: 2`                                                                                   |
| `before-commit`, at the top of the file                                  | [`commands.before-commit`](configuration.md#commandsbefore-commit)                             |
| `build-setup`, at the top of the file                                    | [`commands.build-setup`](configuration.md#commandsbuild-setup)                                 |
| [`plugins`](configuration.md#plugins), one list, each item with a `role` | `plugins`, grouped by phase, each plugin listed under its role's key instead of a `role` field |
| A plugin with `role: mockups`                                            | The one block [`plugins.refine.mockups`](configuration.md#pluginsrefine)                       |
| A plugin with `role: builder`                                            | An item of the list [`plugins.build.builders`](configuration.md#pluginsbuild)                  |
| A plugin with `role: reviewer`                                           | An item of the list `plugins.build.reviewers`                                                  |
| `ci-review`                                                              | [`pr-review`](configuration.md#pr-review), the same block under a new name                     |
| [`specs`](configuration.md#specs), one word                              | Still one word. It is now also a block, with `type` and [`check`](configuration.md#specscheck) |

Every other key keeps its name, its place, and its meaning.

`factory-test-reviewer` still runs by default, with nothing to write. Once
you write [`plugins.test.reviewers`](configuration.md#pluginstest), that
list is the whole list, so `factory-test-reviewer` runs only when you list
it there.

Before:

```yaml
version: 1
repository: your-name/your-repo

specs: openspec

before-commit:
  - npm run -s format:check
  - npx tsc --noEmit

build-setup:
  - npx playwright install --with-deps chromium

plugins:
  - skill: design-mockups
    role: mockups
  - skill: add-endpoint
    role: builder
    labels:
      - new-endpoint
  - agent: migration-reviewer
    role: reviewer
    files:
      - db/migrations/**
```

After:

```yaml
version: 2
repository: your-name/your-repo

specs: openspec

commands:
  before-commit:
    - npm run -s format:check
    - npx tsc --noEmit
  build-setup:
    - npx playwright install --with-deps chromium
  # New, and needed: what a build runs to check its change.
  gate:
    - npm run check

plugins:
  refine:
    mockups:
      skill: design-mockups
  build:
    builders:
      - skill: add-endpoint
        labels:
          - new-endpoint
    reviewers:
      - agent: migration-reviewer
        files:
          - db/migrations/**
```

A file moved only partway says which key is left:
`before-commit: moved to commands.before-commit`, or
`plugins: must be grouped by phase: refine, build, test, conflicts`.

### What version 2 adds

Nothing here was in a version 1 file, so nothing moves. The first is
needed, and the rest are worth a look while the file is open.

- **The gate.** A build used to check its change with the commands your
  agent's instructions named. It now runs `factory gate`, which runs
  `commands.gate`. Copy those commands there, or a build stops with
  `commands.gate is not set`.
- **One test alone, and one end-to-end spec alone:**
  [`commands.test-one`](configuration.md#commandstest-one) and
  [`commands.end-to-end`](configuration.md#commandsend-to-end), which the
  skills run in place of naming a test runner.
- **The checks for browser end-to-end tests moved** out of
  `factory-test-reviewer` into a second built-in agent,
  `factory-e2e-reviewer`. A repository with such tests keeps them by
  setting `commands.end-to-end` and listing both agents under
  [`plugins.test.reviewers`](configuration.md#pluginstest).
- **Coverage, and the lock file:**
  [`commands.coverage`](configuration.md#commandscoverage) and
  [`commands.relock`](configuration.md#commandsrelock).
- **Four more roles for plugins:** your own refiner, prover, test
  reviewers, and conflict resolvers ([Plugins](plugins.md#the-roles)).
- **The default branch is read, not assumed.** A repository whose default
  branch is not `main` needs no setting: `factory sync` writes the
  branch's name where the workflows need it.

## The commands

| Command          | When                                                       |
| ---------------- | ---------------------------------------------------------- |
| `factory sync`   | After you edit `.claude/factory.yaml`, to apply the change |
| `factory doctor` | To see whether you are behind, or why something is off     |

`factory sync` rewrites the factory's files to match your
settings and the installed version.

## On a team

Decide who merges updates, and tell them these pull requests are theirs.
An update changes how everyone's sessions behave, so one person should
read each one. After it merges, everyone pulls and runs `npm ci`. Until
they do, `factory doctor` and the start of each session
tell them their installed version is behind the repository's; the
session's start also says so, naming `npm ci`, when `node_modules` does
not match `package-lock.json`.

## When something goes wrong

| What you see                                                                | What happened                                                         | What to do                                                                 |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| CI fails with "the factory's files are out of sync"                         | A factory file was edited by hand, or settings changed without a sync | Run `factory sync` and commit the result                                   |
| `factory doctor` says your installed version is older than the repository's | You pulled an update and have not installed it                        | Run `npm ci`                                                               |
| A command stops with `version: must be 2`                                   | The update changed the shape of the settings file                     | [Move the file](#moving-to-settings-version-2)                             |
| The update pull request conflicts with your default branch                  | Something else changed the same file                                  | `factory-deps` resolves it on its next run, or close it and update by hand |

## Never edit a factory file

Every file named `factory-...`, and the factory's rules, are written by
the factory. An edit made to one would be lost on the next update, so CI
fails when one differs from what the installed version would write.

To change what the factory does:

- **For your repository only:** say so in your own instructions for the
  agent, which win over the factory's rules, change a number under
  [`rules`](configuration.md#rules) in your settings, or put a skill or
  an agent of your own in a [plugin role](plugins.md).
- **For everyone:** change it in the factory, and it reaches you as an
  update.

[Why it works this way](design.md) explains why the files are copied in
and what the three version numbers are.
