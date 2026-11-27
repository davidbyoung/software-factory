# `commands`

The commands that are your project's own: how a session checks a change,
runs one test, and so on. The factory's skills never name a test runner or
a linter. They run `factory gate`, `factory test-one`, and the like, which
run what you write here.

```yaml
commands:
  build-setup:
    - npx playwright install --with-deps chromium
  before-commit:
    - npm run -s format:check
    - npx tsc --noEmit
  gate:
    - npm run check
  test-one: npx vitest run $FILE -t "$NAME"
  end-to-end: npx playwright test $FILE
  coverage:
    run: npm run coverage
    report: coverage/lcov.info
  relock: npm install
```

| Setting         | When it runs                                                     | Started by            | Default                    |
| --------------- | ---------------------------------------------------------------- | --------------------- | -------------------------- |
| `build-setup`   | Before a session in the cloud starts work                        | `factory build-setup` | none                       |
| `before-commit` | Before every commit a session on your machine makes              | The commit hook       | none                       |
| `gate`          | Before a session calls a task done                               | `factory gate`        | none, and a build needs it |
| `test-one`      | When a session runs one test alone                               | `factory test-one`    | none                       |
| `end-to-end`    | When a session runs one end-to-end test file alone               | `factory end-to-end`  | none                       |
| `coverage`      | When a session checks that a pull request's new lines are tested | `factory coverage`    | none                       |
| `relock`        | After a conflict in your lock file                               | `factory relock`      | `npm install`              |

- **`$FILE` and `$NAME`** are set for you when a command runs one test.
  [`commands.test-one`](#commandstest-one) says how.
- **Only `gate` is needed for a build.** Each of the others turns
  something on, and its entry below says what happens without it.
- **A list runs in order and stops at the first command that fails.**
- **In a monorepo,** a command can run in each package's folder, and
  only when that package changes:
  [Commands for some folders](#commands-for-some-folders). With those,
  [`commands.ignore`](#commandsignore) lists the files no check needs.

## Commands for some folders

In a repository of several packages, any command under `commands` can be
written as an item that says where it runs and which changed files set it
off, in place of plain text:

```yaml
commands:
  gate:
    - npm run -s format:check
    - run: npm test
      in: packages/*
      files: [./**, packages/shared/**, package.json, package-lock.json]
    - run: poetry run pytest -q
      in: services/*
```

| You write             | Where it runs | What sets it off                    |
| --------------------- | ------------- | ----------------------------------- |
| Plain text            | The root      | Every change                        |
| `in` only             | That folder   | A change to a file inside it        |
| `files` only          | The root      | A change to a file matching `files` |
| Both `in` and `files` | That folder   | A change to a file matching `files` |

- **`run`** is the command. Every item needs one.
- **`in`** is the folder it runs in, from the root, or a list of
  folders. A `*` stands for one folder name: `packages/*` is each folder
  directly under `packages/`, including a new one not committed yet, and
  the item becomes one command for each, run in name order.
  `factory config check` fails on a `**` here, and on a `*` anywhere but
  a whole last folder name.
- **`files`** lists the changed files that set it off, as patterns such
  as `src/**/*.ts`. Without `files`, a change to any file in its folder
  does. Writing `files` replaces that, so keep `./**` in it when the
  folder's own changes should still run it.
- **`./` is the item's own folder,** in `files` and in any other path an
  item holds, such as a coverage `report`. A path without `./` starts at
  the root. So with `in: packages/*`, `./**` runs a package's command for
  a change in that package, and `packages/shared/**` runs every package's
  command for a change in the shared one.
- **A path the command is given,** such as `$FILE`, starts at the
  command's folder.
- **`$BASE`** is set for every command: the commit your branch started
  from on your default branch, or the last commit for `before-commit`,
  for a tool that finds what changed itself, such as Nx.
- **When the factory can't find that commit,** such as in a shallow
  clone, `$BASE` is empty and every command runs. `factory gate` says so
  first, with the command that fetches it, such as
  `Fetch it with: git fetch origin main`. A tool given an empty `$BASE`
  may check nothing, so run that command, then the gate again.
- **What changed** is every file that differs between that commit and
  your working folder now, committed or not, including new files git
  doesn't ignore. `before-commit` reads only what differs from the last
  commit, and `relock` what differs from your default branch.
- **A changed file is covered** when a gate command's `files` match it,
  or its folder does when it has no `files`, or
  [`commands.ignore`](#commandsignore) lists it.
- **When the gate has an item, a changed file nothing covers runs every
  command,** since nothing says what it could break. `factory gate`
  names the file on its first line.
- **A change to the settings runs every command,** gate or not:
  `.claude/factory.yaml`, `.claude/factory.lock`, or
  `.claude/factory.choices.yaml`. So a command you add is tried in the
  pull request that adds it.
- **Both rules hold for `gate`, `before-commit`, `relock`, and the sites
  under [`site`](site.md#site).** Not for `coverage`, since a file nothing
  covers has no lines in a coverage report; not for `test-one` and
  `end-to-end`, which run for one test file, not a change; and not for
  `build-setup`, which runs every command anyway.
- **A failure in one folder** doesn't stop the item's other folders: each
  runs, and every failure is listed. The commands after it in the list
  don't run.
- **`factory config check`** fails on a folder that doesn't exist, a key
  it doesn't know, an empty `files`, and a path that leaves the
  repository. It warns on a `*` that matches no folder, a pattern that
  matches no file, and every file in the repository nothing covers.

[A monorepo](../../customize/monorepo.md) walks through setting one up.

## `commands.ignore`

Use it when your gate has
[commands for some folders](#commands-for-some-folders): it lists the
files no check needs, such as documentation, as patterns from the root,
like `files`. A change to one runs only your plain text commands, in
`gate`, `before-commit`, `relock`, and `site` alike.

```yaml
commands:
  ignore:
    - .github/**
    - docs/**
```

- **Default:** none. Until you list a file here, or in the `files` of a
  gate command, a change to it runs every command.
- **It wins over `files`.** A file listed here runs no item, even one
  whose `./**` matches it.
- **`factory config check`** lists the files nothing covers, so you can
  settle them once.

## `commands.build-setup`

Commands that run before a session in the cloud starts work, in your default
branch's copy, to install what the session will need. When your repository's
root has a `package-lock.json`, your npm dependencies are already installed
by then, with `npm ci`. Nothing else is.

```yaml
commands:
  build-setup:
    - npx playwright install --with-deps chromium # a browser for end-to-end tests
```

Install here what the machine lacks, such as a language or a tool. Your
project's own dependencies are another matter: what is installed here is
for your default branch's copy, and the session works in a copy of its
own branch, beside it. It installs that copy's dependencies itself, as
your `CLAUDE.md` or the project's files say, so list the registry they
come from under [`builds.hosts`](builds.md#builds), such as `pypi.org` and
`files.pythonhosted.org` for pip.

A package that GitHub itself serves, as it does most of Composer's, can't
be downloaded by a session, since GitHub is never reachable there. Run
`composer install` here, and have your `CLAUDE.md` say to copy what it
installed into the branch's copy, with `cp -R vendor ../work/`.

- **Default:** none.
- **If one fails,** the run stops before the session starts, and its log
  shows that command's output.
- **It runs as your default branch has it,** so a pull request that changes
  it is built with the old commands until it merges.
- **An item with `in`** runs in each of its folders, such as
  `composer install` in each PHP service. Every command runs, since
  setup happens before there is a change, so `factory config check` fails
  on `files` here. `factory build-setup` runs them, as the cloud build
  does.

  ```yaml
  commands:
    build-setup:
      - run: composer install
        in: services/*
  ```

## `commands.before-commit`

Quick checks that run before every commit a session on your machine makes.
If one fails, the commit is blocked and the session sees why. No hook runs
in a [session in the cloud](../../features/cloud-builds.md#what-a-session-can-use), so these do
not either: put a check a build has to pass in
[`commands.gate`](#commandsgate) too.

```yaml
commands:
  before-commit:
    - npm run -s format:check
    - npx tsc --noEmit
    - npm run -s lint
```

- **Default:** none.
- **Keep them to a few seconds.** They run on every commit. Your tests
  belong in [`commands.gate`](#commandsgate), which runs once per task.
- **They only apply to a session's commits,** not to commits you make
  yourself.

## `commands.gate`

The checks a change has to pass before a session calls it done or opens a
pull request. Think of it as what your CI runs on a pull request, minus
anything too slow for a session to sit and wait for. `factory gate` runs
them in order and stops at the first failure, so put the fastest first.

If you already have one command that runs every check, such as
`npm run check` or `make check`, the gate can be just that:

```yaml
commands:
  gate:
    - npm run check
```

Otherwise, list each check. What that looks like in a few languages:

```yaml
# JavaScript or TypeScript
gate:
  - npm run format:check
  - npm run lint
  - npx tsc --noEmit
  - npm test
```

```yaml
# Python
gate:
  - ruff format --check .
  - ruff check .
  - mypy src
  - pytest -q
```

```yaml
# Go
gate:
  - test -z "$(gofmt -l .)"
  - go vet ./...
  - go test ./...
```

```yaml
# PHP
gate:
  - composer validate --strict
  - vendor/bin/php-cs-fixer fix --dry-run --diff
  - vendor/bin/phpstan analyse
  - vendor/bin/phpunit
```

```yaml
# Rust
gate:
  - cargo fmt --check
  - cargo clippy -- -D warnings
  - cargo test
```

Leave out:

- **Anything that changes files,** such as `prettier --write`. The gate
  checks a change; it doesn't fix it.
- **A test suite that takes many minutes,** such as a full browser suite.
  CI still runs it on the pull request.
- **Anything that needs production secrets, or deploys.**

There is no default. Without a gate, `factory gate` fails with
`commands.gate is not set`, and a build stops there, because an empty gate
would pass every change. `factory init` asks for one gate command, and
lists the gate under "Left to do" when you leave that question empty.

When a command fails, `factory gate` prints `✗ The gate failed on:` and
the command, and runs none after it. The session fixes the cause and runs the
gate again.

With [commands for some folders](#commands-for-some-folders),
`factory gate` first prints which commands run and why, and counts the
ones it leaves out. `factory gate --dry-run` lists every command and why
it would run or not, and runs nothing.

**Check your gate yourself** before a session relies on it: run
`factory gate --all` on a clean checkout. It runs every command,
whatever changed, each in its folder, and should end with
`✓ Every gate command passed.` and exit 0. `factory config check` checks
the file, and lists the files no gate command covers, but doesn't run
your commands.

## `commands.test-one`

Runs one test file alone, or one test in it. A session uses it to watch a
new test fail before the change, and to narrow down a bug.
`factory test-one FILE NAME` runs your command with `$FILE` and `$NAME`
set. When only a file is given, `$NAME` is empty, so the command should
run the whole file then:

```yaml
commands:
  test-one: npx vitest run $FILE -t "$NAME" # an empty -t runs every test
```

```yaml
commands:
  test-one: vendor/bin/phpunit $FILE ${NAME:+--filter "$NAME"} # --filter only with a name
```

- **Default:** none. `factory test-one` then fails with
  `commands.test-one is not set`, and a session finds its own way to run
  one test.
- **In a monorepo,** write a list of items. `factory test-one FILE` runs
  the first item whose folder holds FILE, in that folder, with `$FILE`
  starting there. Plain text in the list runs for any file, so put it
  last. When no item holds FILE and there is no plain text, it fails
  with `No commands.test-one command covers FILE`, and the session runs
  the test its own way.

  ```yaml
  commands:
    test-one:
      - run: npx vitest run $FILE -t "$NAME"
        in: packages/*
      - run: poetry run pytest $FILE -k "$NAME"
        in: services/*
  ```

## `commands.end-to-end`

Runs one end-to-end test file alone, with `$FILE` set.
`factory end-to-end FILE --times 10` runs it ten times and stops at the
first failure, as `failed on run 3 of 10`. A build does that with each new
end-to-end test, since one that fails one run in ten will fail someone's
pull request.

```yaml
commands:
  end-to-end: npx playwright test $FILE
```

- **Default:** none. Leave it out if you have no end-to-end tests.
- **Setting it makes `factory-e2e-reviewer` available,** the factory's
  reviewer for browser tests. To use it, run `factory sync`, then list it
  under [`plugins.test.reviewers`](plugins.md#pluginstest). That list replaces the
  default, so list `factory-test-reviewer` there too.
- **In a monorepo,** a list of items, chosen as for
  [`commands.test-one`](#commandstest-one).

## `commands.coverage`

The command that measures test coverage, and where it writes its lcov
report. `factory coverage` runs it and prints the lines your branch
changed that no test covers.

```yaml
commands:
  coverage:
    run: npm run coverage
    report: coverage/lcov.info
```

- **Default:** none, and a session doesn't check coverage.
- **Write both `run` and `report`,** or neither.
- **In a monorepo,** a list of them, each with `in` and a `report` in its
  own folder. `factory coverage` runs the ones a change sets off, as the
  gate does:

  ```yaml
  commands:
    coverage:
      - run: npm run coverage
        in: packages/*
        report: ./coverage/lcov.info
  ```

## `commands.relock`

The command that rebuilds your package manager's lock file. When the lock
file conflicts with the default branch, a session takes the default
branch's copy and runs `factory relock`, which runs this, instead of
merging the file by hand.

```yaml
commands:
  relock: composer update --lock
```

- **Default:** `npm install`.
- **Another generated file that conflicts,** such as a generated API
  client, needs a [resolver](plugins.md#pluginsconflicts).
- **In a monorepo with a lock file in each package,** write an item for
  them, set off by each package's lock file and the manifest it is built
  from:

  ```yaml
  commands:
    relock:
      - run: poetry lock --no-update
        in: services/*
        files: [./pyproject.toml, ./poetry.lock]
  ```

  npm, pnpm, and Yarn workspaces keep one lock file at the root, so the
  default, `npm install`, still works for them.
