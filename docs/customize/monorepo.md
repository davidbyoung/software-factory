# A monorepo

This is for a repository that holds several packages, such as Node
packages under `packages/` and Python services under `services/`. At the
end, a [session](../reference/glossary.md#the-words) that changes one package runs
that package's checks, its [gate](../reference/glossary.md#the-words), not every
package's, and a change to a file nobody accounted for still runs them
all.

Set Lunamill up first, at the repository's root, with the
[quick start](../get-started/quick-start.md): one `lunamill init`, one
`.claude/lunamill.yaml`, and one board, as for any repository. This
page changes the commands under [`commands`](../reference/settings/commands.md#commands) in that file, on the
branch the quick start leaves you on.

**If your monorepo already has Nx, Turborepo, or Pants,** it already
knows which packages a change affects, and you skip steps 1 and 2. Make
your gate one command that asks it, and pass it
[`$BASE`](../reference/settings/commands.md#commands-for-some-folders), the commit your
branch started from on your default branch:

```yaml
commands:
  gate:
    - npx nx affected -t lint test --base=$BASE
    # Turborepo: npx turbo run lint test --filter="...[$BASE]"
    # Pants: pants --changed-since=$BASE --changed-dependents=transitive test
```

**It worked when** `lunamill gate` prints `$ npx nx affected ...` with no
line before it, and ends with `✓ Every gate command passed.` When it
starts with `? Can't tell what changed`, `$BASE` is empty: run the fetch
command that line prints, and run the gate again. Read on only to split
up your other commands, such as
[`commands.test-one`](../reference/settings/commands.md#commandstest-one), by package
([The other settings](#the-other-settings)).

## 1. Write each package's commands

Write [`commands.gate`](../reference/settings/commands.md#commandsgate) in
`.claude/lunamill.yaml`, replacing the one
command `lunamill init` asked you for, if you gave one, with a command for
each kind of package:

```yaml
commands:
  gate:
    - npm run -s format:check # from the root, for every change
    - run: npm test
      in: packages/* # in each package, when that package changes
      files: [./**, packages/shared/**, package.json, package-lock.json]
    - run: poetry run pytest -q
      in: services/* # in each service, when that service changes
```

- **`in: packages/*`** makes one command for each folder under
  `packages/`, and runs each inside its own folder.
- **`files`** lists the changed files that run it, as patterns such as
  `src/**/*.ts`. `./` means the command's own folder, so `./**` is every
  file in that package. A pattern without `./` starts at the root.
- **Without `files`,** a change to any file in its folder runs it, as
  with `pytest` above. **Writing `files` replaces that,** so keep `./**`
  in the list, or the package's own changes stop running it.
- **List what a package's checks read outside its folder,** such as a
  shared library or the root's lock file, as `npm test` does above. Then
  a change to that file runs every package's tests. Lunamill looks at
  which files changed, not at what your code imports, so a file you leave
  out runs nothing of that package's when it changes.
- **A plain text command,** such as the format check, runs from the root
  for every change, as in any repository.

A changed file is **covered** when a gate command's `files` match it, or
its folder does when it has no `files`. A changed file that nothing
covers runs every gate command, since Lunamill can't tell what it
might break. That is what keeps an edit to a root file such as
`tsconfig.base.json` from passing with no type check.

**It worked when** `lunamill gate --dry-run` lists each command as it
will run, such as `cd packages/api && npm test`, each marked `runs` or
`left out` for the change on your branch.

## 2. Settle what nothing covers

Your repository has files outside every package: CI workflows, scripts,
and root settings. `lunamill config check` lists the ones nothing covers.
A folder with nothing covered in it is one line, with how many files it
holds:

```console
$ lunamill config check
? 4 paths are in no gate command's files and not in commands.ignore, so a change to one runs every command:
    .github/             6 files
    scripts/             11 files
    docs/                9 files
    tsconfig.base.json
  Add each to commands.ignore, or to the files of the gate commands it affects.
✓ The settings are valid.
```

For each, decide what a change to it could break:

- **Some of your checks:** add it to those commands' `files`.
  `tsconfig.base.json` goes in `npm test`'s, since every Node package
  reads it, and `scripts/**` goes in the `files` of the commands that run
  those scripts.
- **None of them:** add it to
  [`commands.ignore`](../reference/settings/commands.md#commandsignore). Your CI
  workflows, `.github/**`, are checked by your CI itself, and `docs/**`
  holds no code:

  ```yaml
  commands:
    ignore:
      - .github/**
      - docs/**
  ```

  A change to an ignored file runs only the plain text commands, such as
  the format check, even where a command's `./**` would match it.

- **You're not sure:** leave it. A change to it runs every command, which
  is slow but never misses anything.

Then run every command once, whatever changed, to check that each works
in its folder:

```bash
lunamill gate --all
```

**It worked when** `lunamill config check` prints only
`✓ The settings are valid.`, or lists only files you chose to leave, and
`lunamill gate --all` ends with `✓ Every gate command passed.` Commit
`.claude/lunamill.yaml` on that branch.

## What runs from then on

A session's `lunamill gate` compares its branch with the commit the branch
started from on your default branch, which it reads from `origin/` and
the default branch's name, and runs each command a changed file sets
off. With fifty packages and twenty services, and `main` as the default
branch:

```console
$ lunamill gate
commands.gate: 2 of 71 run, for the 3 files changed since origin/main
  npm run -s format:check          every change
  cd packages/api && npm test      packages/api/src/orders.ts, and 1 more
- 69 left out, since this change touches none of their files: lunamill gate --dry-run lists each
```

A change to `.claude/lunamill.yaml` runs every command, so a command you
add is tried in the pull request that adds it. A changed file nothing
covers also runs every command, and the first line names it, so you know
what to add. [Commands for some folders](../reference/settings/commands.md#commands-for-some-folders)
has every rule.

## The other settings

Each of these is optional. Split one only when your packages need
different commands for it.

- **[`commands.test-one`](../reference/settings/commands.md#commandstest-one) and
  [`commands.end-to-end`](../reference/settings/commands.md#commandsend-to-end),** which a
  session uses to run one test file, if your packages run their tests
  with different tools: give a command for each kind of package, and Lunamill runs the one whose folder holds the test file.
- **[`commands.coverage`](../reference/settings/commands.md#commandscoverage),** if each
  package measures its own coverage: give each its command and report,
  and `lunamill coverage` runs the ones a change needs.
- **[`commands.relock`](../reference/settings/commands.md#commandsrelock),** if your
  packages keep their own lock files, such as one in each Python
  service: `lunamill relock` rebuilds the ones a change needs after a
  conflict.
- **[`site`](../reference/settings/site.md#site),** if the repository holds more than
  one web app: list a site for each, and `lunamill site compare` takes
  screenshots of the ones a change touches.
- **A [preset](presets.md),** a shared set of settings, if your company
  has one written for one package, such as a Python preset: apply it to
  each of your services with `lunamill preset add NAME --in 'services/*'`.
- **Notes for a session about one package** go in the coding agent's
  instructions file in that package's folder, a `CLAUDE.md` on
  [Claude Code](../integrations/claude-code.md), which it reads when it
  works there.
