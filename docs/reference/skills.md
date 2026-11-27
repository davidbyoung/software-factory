# Skills and agents

A skill is a set of instructions an agent session follows when you ask for
it. An agent, in this page's sense, is a separate reviewer a session
launches, which reads and reports and changes nothing. This page covers
every skill and agent the factory brings.

You call a skill by typing its name as a slash command in a session, with
the ticket or pull request number after it: `/factory-refine 12`. Slash
commands are how Claude Code, the one coding agent the factory supports
today, calls a skill. Asking in
plain words, such as "refine ticket 12", usually calls the same skill, but
the session decides which one fits, so the command is the sure way.

## Which ones a repository gets

The factory's core is what its own steps call, and every repository gets
it. Everything else is written only when a setting or a file turns it on,
and `factory sync` removes it again when that is undone.

| Skill or agent              | Written                                                                                |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `factory-refine`            | Always                                                                                 |
| `factory-build`             | Always                                                                                 |
| `factory-address-review`    | Always                                                                                 |
| `factory-resolve-conflicts` | Always                                                                                 |
| `factory-diagnose`          | Always                                                                                 |
| `factory-mutate`            | Always                                                                                 |
| `factory-trace`             | Always                                                                                 |
| `factory-ticket-readiness`  | Always                                                                                 |
| `factory-test-reviewer`     | Always                                                                                 |
| `factory-design`            | With [`site`](settings/site.md#site) in your settings                                  |
| `factory-ui-reviewer`       | With `site` in your settings                                                           |
| `factory-e2e-reviewer`      | With [`commands.end-to-end`](settings/commands.md#commandsend-to-end) in your settings |
| `factory-deps`              | With a `.github/dependabot.yml` file                                                   |

No skill names a test runner, a linter, or a branch. Each runs what your
settings list under [`commands`](settings/commands.md#commands), through
commands such as `factory gate` and `factory test-one`
([Commands](cli.md#your-repositorys-commands)), and asks
`factory default-branch` for your default branch's name.

Where a step below names a built-in skill or agent, a
[plugin](../customize/plugins.md#the-roles) of yours can stand in for it: your own
refiner, builder, prover, test reviewers, and conflict resolvers.

## At a glance

| Slash command                    | Plain words that also work         | What it does                                                             |
| -------------------------------- | ---------------------------------- | ------------------------------------------------------------------------ |
| `/factory-refine 12`             | "refine ticket 12"                 | Turns a ticket into a spec a builder can start from                      |
| `/factory-build 12`              | "build ticket 12"                  | Builds a ticket to a reviewed pull request                               |
| `/factory-address-review 280`    | "address the review on 280"        | Works a pull request's review until it can merge                         |
| `/factory-resolve-conflicts 280` | "resolve the conflicts on 280"     | Merges your default branch into a pull request and settles the conflicts |
| `/factory-diagnose`              | "diagnose this failing test"       | Finds a bug's cause before any code changes                              |
| `/factory-mutate`                | "mutate this test"                 | Proves a test can fail                                                   |
| `/factory-deps`                  | "fix the dependency pull requests" | Moves dependency pull requests toward merged                             |
| `/factory-design`                | "mock up a new about page"         | Designs a visible change to a website, with mockups                      |
| `/factory-trace`                 | "trace this rule change"           | Traces a change to the rules through every kind of change                |

Typing `/factory` in a session lists them, which is also how to check that
a session picked the factory up.

## `factory-diagnose`

**What it does.** Finds the cause of a bug, a failing or flaky test, or a
slowdown, before changing any code. It starts by building one command that
fails on the exact symptom, shrinks it, ranks the possible causes, and
tests them one change at a time. It runs one test or one end-to-end spec
alone with `factory test-one` and `factory end-to-end`.

**When to use it.** When something is broken, failing, flaky, or slow, and
the cause is not already known.

**What it never does.** Change code before it can make the failure happen
on demand. Fix two things at once.

## `factory-mutate`

**What it does.** Proves a test can fail. It breaks the code under test one
way at a time and watches the test go red, then puts the code back and
confirms the working tree is clean.

**When to use it.** For a test written after the code it tests, or one
never seen failing for the right reason. A test that passes either way
locks nothing in.

**What it never does.** Leave a mutation in place.

It is the [prover](../customize/plugins.md#prover) a build calls, unless your settings
name one of your own.

## The built-in agents

### `factory-ticket-readiness`

Reads a refined ticket cold, as the session that will build it, and lists
every question it would still have to ask. `factory-refine` runs it, and
a refiner of your own can: it reads any refiner's ticket against the same
list. Read-only.

### `factory-ui-reviewer`

Reads a change to how a website looks or responds. It runs
`factory site compare`, reads the before and after pictures of the pages
that changed, drives the states the change is about, and judges them
against built-in rules, your `design-guide` when you wrote one, and what
your `checks` printed. It is listed under
[`plugins.build.reviewers`](settings/plugins.md#pluginsbuild) like a reviewer
of your own, with the `files` that should trigger it, and is written only
to a repository with `site` in its settings. Read-only, and slow.

### `factory-test-reviewer`

Reads new or changed tests, whatever their kind, the way a test engineer
reviews a pull request: one behavior per test, each able to fail and
earning its place, with no waits on a timer. `factory-build` runs it,
unless your settings list other
[test reviewers](../customize/plugins.md#test-reviewer). Read-only, and it does not run
the suite.

It takes its specifics from your project's instructions beside your tests. Without one,
it applies only those general rules.

### `factory-e2e-reviewer`

Reads new or changed browser end-to-end and smoke tests for what only such
a test can get wrong: specs that go around their page objects, elements
not found the way a user finds them, waits on a timer, and a check that
needs no real browser. It is written only to a repository with
`commands.end-to-end` in its settings, and runs where it is listed under
[`plugins.test.reviewers`](settings/plugins.md#pluginstest), beside
`factory-test-reviewer`, since that list, once written, is the whole list.
Read-only, and it does not run the suite.
