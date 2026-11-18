# Plugins

For someone who wants the factory to use a skill or an agent of their own:
a reviewer for one part of the code, a builder for one kind of ticket, or
their own way of refining a ticket. At the end, the factory calls it at a
set moment of every build, and `factory plugins` lists it.

The factory knows how to refine, build, and review a ticket. It does not
know your project. A plugin is one of your own skills or agents that the
factory calls at a set moment, so what only your project knows is part of
every build.

## The idea

You write a skill or an agent the way your coding agent expects one, in
the folder it reads them from
([on Claude Code](github/reference.md#skills-in-claude-code)). Then you add
a few lines to `.claude/factory.yaml` saying where the factory calls it:

```yaml
plugins:
  build:
    reviewers:
      - agent: migration-reviewer
        files:
          - db/migrations/**
```

That is the whole of it. The factory never copies over your files, and an
update never touches them.

## The roles

A role is a job in the work that your own skill or agent can take on, such
as reviewing a change or refining a ticket. There are
seven, grouped under [`plugins`](configuration.md#plugins) by the phase
each belongs to. Every role is optional, and leaving one out never turns a
step off: the last column says what does the work when you have none.

A role has two names. The settings key, in the second column, is what you
write in `.claude/factory.yaml`. The role's own name, in the first column,
is what `factory plugins` prints, and the headings below use it: `builder`
is the role you write as
[`plugins.build.builders`](configuration.md#pluginsbuild), and no key is
called `builder`.

| Role            | Settings key                                                       | What it does                                   | Without one                               |
| --------------- | ------------------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------- |
| `refiner`       | [`plugins.refine.refiner`](configuration.md#pluginsrefine)         | Refines a ticket, in place of `factory-refine` | `factory-refine`                          |
| `mockups`       | [`plugins.refine.mockups`](configuration.md#pluginsrefine)         | Makes pictures for a decision about the look   | `factory-design` on a website, else words |
| `builder`       | [`plugins.build.builders`](configuration.md#pluginsbuild)          | Builds a ticket that carries one of its labels | The built-in build                        |
| `reviewer`      | [`plugins.build.reviewers`](configuration.md#pluginsbuild)         | Reads a finished change that touches its files | No reviewers of your own                  |
| `prover`        | [`plugins.test.prover`](configuration.md#pluginstest)              | Proves a new test can fail                     | `factory-mutate`                          |
| `test-reviewer` | [`plugins.test.reviewers`](configuration.md#pluginstest)           | Reads new and changed tests                    | `factory-test-reviewer`                   |
| `resolver`      | [`plugins.conflicts.resolvers`](configuration.md#pluginsconflicts) | Rebuilds its files after a merge conflict      | A merge by hand                           |

[Configuration](configuration.md#plugins) has the shape of each key:
whether it takes a skill or an agent, one or a list, and `files` or
`labels`.

A reviewer is an agent: a session launches it, and it reads and changes
nothing. Every other role is a skill, which the session follows itself.

## Refining

### `refiner`

Refines a ticket your own way, in place of `factory-refine`.

```yaml
plugins:
  refine:
    refiner:
      skill: acme-refine
```

| Step        | What happens                                                                                                                                                                                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Called**  | When you ask a session to refine a ticket: `factory-refine` hands over to it before doing anything. By `factory-build`, on a ticket that has no criteria yet, or one you approved while its questions waited                                                                                                                                                        |
| **Handed**  | The ticket's number. From `factory-build`, for a round of questions you approved while it waited on your answers, also the words "approved while waiting: fold the owner's replies into the body, post no marker". They tell the refiner to write your replies into the ticket's body and to post no [marker](glossary.md), the hidden comment line the board reads |
| **Returns** | A ticket a build can start from: everything in the list below                                                                                                                                                                                                                                                                                                       |
| **Then**    | The ticket waits for your approval, and the build reads what the refiner left                                                                                                                                                                                                                                                                                       |

**What a refiner must deliver.** The board and the build read these, so a
refiner that leaves one out leaves a ticket that cannot be built.

- **The three markers,** each posted with a command, so the board shows
  where the ticket stands: `factory ticket refining N` when it starts,
  `factory ticket waiting N` when it has posted questions for you, and
  `factory ticket refined N` when the ticket is ready for your approval.
- **The `spec` label, decided.** With
  [`specs: openspec`](configuration.md#specs), a change your users will
  see that is not small gets the label, with
  `factory ticket label N --add spec`. A refiner never removes it, and
  never adds it back once you took it off.
- **Each ticket this one waits on,** recorded with
  `factory ticket block N --by M`. A build order written only in prose is
  one nothing reads.
- **The body,** written with `factory ticket edit`, with your text kept
  first and these sections after it:

  | The ticket            | Its body has                                                                                                                                                                                     |
  | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | Without `spec`        | `## Decisions`, and `## Acceptance criteria` with at least one list item                                                                                                                         |
  | With `spec`           | `## Decisions`; `## Spec`, with a `### NAME (new)` or `### NAME (modified)` heading for each capability and numbered lines under it; and `## For the builder`, with `### Design` and `### Tasks` |
  | The follow-ups ticket | Its checklist. The check passes it whatever else its body holds                                                                                                                                  |

  On a `spec` ticket the build copies these into an OpenSpec change, so
  they keep its shape: each numbered Spec line is one "When this, then
  that" sentence, which becomes one requirement, and Tasks are numbered
  groups of checkboxes, as OpenSpec's `tasks.md` has them.

**The check is a script's.** `factory ticket refined N` refuses to post
its marker on a body missing one of those sections, for the factory's own
refiner as for yours. It prints one line for each, such as
`missing: ### Tasks under ## For the builder`, and exits 1.
`factory ticket refined N --check` makes the same check and posts nothing:
it prints `sound` when the body passes. The check is that each section is
there, not that what it says is right. For that,
`factory-ticket-readiness`, the built-in agent that reads a refined ticket
cold, reads any refiner's result against this same list: have your refiner
launch it, as `factory-refine` does.

`factory-refine` stays in your repository beside your refiner, so ask a
session for yours by its own name. The surest way to write one is to start
from a copy of `factory-refine` under your own name.

**To add questions, not replace the refiner,** write them in your own
instructions for the agent, under a heading "Refining: this repository" in
`CLAUDE.md`. The refining session reads `CLAUDE.md`, and it wins over the
factory's rules, so no plugin is needed for that.

### `mockups`

Makes pictures to choose from when a decision changes how something looks.

A repository with [`site`](configuration.md#site) in its settings has one
already: the factory's own `factory-design` skill, which `factory sync`
writes, is its `mockups` plugin unless you name one of your own.

```yaml
plugins:
  refine:
    mockups:
      skill: design-mockups
```

| Step            | What happens                                                                   |
| --------------- | ------------------------------------------------------------------------------ |
| **Called**      | By the refiner, when one of the decisions it would bring you is about the look |
| **Handed**      | The ticket and the decision                                                    |
| **Returns**     | Pictures of each option, with one recommended                                  |
| **Then**        | You choose, and the choice goes into the ticket                                |
| **Without one** | The decision is described in words                                             |

## Building

### `builder`

Builds a kind of ticket the general build would do badly.

```yaml
plugins:
  build:
    builders:
      - skill: add-endpoint
        labels:
          - new-endpoint
```

| Step          | What happens                                                                                        |
| ------------- | --------------------------------------------------------------------------------------------------- |
| **Called**    | By `factory-build`, in place of its own build step                                                  |
| **Used when** | The ticket carries one of its `labels`. When two builders share a label, the first listed is used   |
| **Handed**    | The ticket, already claimed, on its branch                                                          |
| **Returns**   | The change, and a report for the pull request body                                                  |
| **Then**      | `factory-build` carries on as usual: the test reviewers, your reviewers, the gate, the pull request |

**Reviewers still run after a builder.** The test reviewers and your own
read what it built, and so does everything after them. A reviewer the
builder's report shows it already ran is not run twice: its line in the
pull request reads "already run by the builder".

Good candidates: work your project always does the same way, such as a new
API endpoint with its route, handler, schema, and docs, or a new
translation added to every locale file.

### `reviewer`

Reads a finished change and reports problems.

```yaml
plugins:
  build:
    reviewers:
      - agent: migration-reviewer
        files:
          - db/migrations/**
```

| Step                | What happens                                                                                 |
| ------------------- | -------------------------------------------------------------------------------------------- |
| **Called**          | By `factory-build`, after the change is built and before the pull request opens              |
| **Considered when** | The change touches a file matching one of its `files` patterns                               |
| **Handed**          | The branch, and which files changed                                                          |
| **Returns**         | Findings, each with where it is and why it matters. It changes nothing                       |
| **Then**            | The building session fixes what holds up, and the pull request says what each reviewer found |

Good candidates: database migrations, anything touching authentication or
payments, a public API that must stay backward compatible, accessibility
of your components, copy that has to follow a style guide.

## Testing

### `prover`

Proves a new test can fail, in place of `factory-mutate`. A test that
passes whether or not the code works locks nothing in.

```yaml
plugins:
  test:
    prover:
      skill: acme-mutation
```

| Step        | What happens                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------ |
| **Called**  | By `factory-build` and `factory-address-review`, for a new or changed test nobody saw fail before the change |
| **Handed**  | The new or changed tests                                                                                     |
| **Returns** | For each test, what made it fail, and the code put back as it was                                            |
| **Then**    | The pull request records each proof. A test that stays green is the one that needs work                      |

**What a prover must report.** For each new or changed test, one of two
things, as a line the pull request body takes:

- **its red run:** the test failing before the change was made; or
- **the one mutation that made it fail:** the edit to the code under test
  that turned the test red, for a test written after the code.

One proof for each test is the rule, and it stays a rule whichever prover
runs: the role cannot be set to nothing. No script checks a prover's
report. The pull request records it, where you read it.

### `test-reviewer`

Reads new and changed tests, the way `factory-test-reviewer` does.

```yaml
plugins:
  test:
    reviewers:
      - agent: factory-test-reviewer
      - agent: factory-e2e-reviewer
        files:
          - e2e/**
```

| Step                | What happens                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Called**          | By `factory-build`, once the tests are written and proved, and before your own reviewers                |
| **Considered when** | The change adds or changes tests. One listed with `files`, only when the change touches a matching file |
| **Handed**          | The new and changed tests                                                                               |
| **Returns**         | Findings, each with where it is and why it matters. It changes nothing                                  |
| **Then**            | The building session fixes what holds up, and the pull request says what each one found                 |

- **[`plugins.test.reviewers`](configuration.md#pluginstest), once
  written, is the whole list.** Left out, `factory-test-reviewer` reads
  the tests. Written, only the agents you list do, so list
  `factory-test-reviewer` to keep it, and leave it off to remove it.
- **A small change gets no test reviewer,** whichever are listed
  ([Workflow](workflow.md#sizing-the-work-to-the-change)), with two
  exceptions that run every one listed, one with `files` only when the
  change touches a matching file: a change to tests alone, and code that
  builds what is sent to an outside service.
- **`factory-e2e-reviewer`** ships with the factory and reads browser
  end-to-end tests. `factory sync` writes it once
  [`commands.end-to-end`](configuration.md#commandsend-to-end) is set, and
  it runs only where it is listed, as above.

## Conflicts

### `resolver`

Rebuilds a file after a merge conflict, in place of merging it by hand: a
generated API client, a compiled schema, a lock file of a package manager
other than npm.

```yaml
plugins:
  conflicts:
    resolvers:
      - skill: regenerate-api-client
        files:
          - src/generated/**
```

| Step          | What happens                                                                                                   |
| ------------- | -------------------------------------------------------------------------------------------------------------- |
| **Called**    | By `factory-resolve-conflicts` and `factory-deps`, during a merge of your default branch into a pull request   |
| **Used when** | A conflicted file matches one of its `files`. When two resolvers match one file, the first listed is used      |
| **Handed**    | The conflicted files that match, with the merge still in progress                                              |
| **Returns**   | Each file resolved and staged, or word that it cannot                                                          |
| **Then**      | The session runs the gate and pushes the merge. "It cannot" is a stop: nothing is pushed, and you are told why |

- **The conflict sweep reads a resolver from your default branch's
  copy,** both the list in the settings and the skill's text, never from
  the pull request's branch. The sweep runs with a token, and a pull
  request could otherwise change what runs with it. So a new or changed
  resolver is used once it has merged.
- **A contradiction is still a stop.** When the two sides of a conflict
  disagree about what the file should say, a resolver does not settle it:
  the session pushes nothing, comments why, and opens a ticket.
- **npm's lock file needs no resolver.**
  [`commands.relock`](configuration.md#commandsrelock) rebuilds it.

## `files` filters; the agent decides

`files` answers "could this reviewer matter here?" It cannot answer "does
it?" That judgment belongs in the agent's own description, the lines at the
top of its file that say when to use it:

```yaml
---
name: migration-reviewer
description: >-
  Use when a change adds or alters a database migration's SQL or schema
  operations. Not for a change to comments or formatting alone.
---
```

So a change that only fixes a typo in a migration's comment matches the
reviewer's files, and the building session, reading that description,
skips it. It says so in the pull request:

```text
migration-reviewer: skipped, only a comment changed.
```

Every matched reviewer ends up with either a run or a line like that. You
read the skips when you read the pull request.

**Write the description as a condition.** "Reviews database migrations"
says what the agent is. "Use when a change adds or alters a migration's
SQL" says when to call it, which is what the factory needs.

## A worked example

A team runs a web application with a large database. A migration can pass
every test and still take the site down: it locks a busy table, or drops a
column the code still running in production reads. No test catches that.
So the team has an agent, `migration-reviewer`, that reads a migration the
way their most careful database engineer would.

**1. The agent** is an ordinary agent file of the team's coding agent,
named `migration-reviewer`. Its description says when it applies. Its body says what to check: can it be rolled back, will it lock
a large table, and does it still work with the code that is live while it
runs.

**2. The settings** name it:

```yaml
plugins:
  build:
    reviewers:
      - agent: migration-reviewer
        files:
          - db/migrations/**
```

**3. A session builds a ticket** that removes an unused column.
`factory-build` sees the change touched `db/migrations/`, reads the
reviewer's description, finds it applies, and launches it. The agent
reports that the live code still selects that column, so the migration
would break requests during the deploy. The session splits the work: this
change stops reading the column, and a follow-up drops it.

**4. The pull request** says: "`migration-reviewer`: one finding, the
column is still read by the running code. Split into two changes."

A second ticket fixes a typo in a migration's comment. The files match
again, the description does not, and the pull request says:
"`migration-reviewer`: skipped, only a comment changed."

The team's rules for what makes a migration safe stay in their own
instructions for the agent and in the agent itself. The factory holds none of them.

## Adding one

1. Write the skill or agent, and try it by hand until it does its job.
2. Give it a description that states when it applies.
3. Add it under [`plugins`](configuration.md#plugins), in its role, with
   `files` or `labels` where the role takes them.
4. Run `factory config check`. It fails, naming the role, if the file is
   missing, or the role takes a skill and you named an agent.
5. Run `factory plugins` to see the list the factory will use, the
   built-in ones included:

   ```text
   skill factory-refine refiner
   agent migration-reviewer reviewer db/migrations/**
   skill factory-mutate prover
   agent factory-test-reviewer test-reviewer
   ```

**It worked when** your plugin is in that list, in its role.

No sync is needed. Plugins are read from your settings each time.

## What is not a plugin

- **A skill you call yourself.** If nothing in refining, building, or
  reviewing a ticket should call it, it needs no entry. It stays an
  ordinary skill.
- **A skill another of your skills calls.** A reviewer that only your own
  builder launches is that builder's business.
- **A rule.** "Migrations always wait for me" is
  [`auto-merge`](configuration.md#auto-merge). "Every migration needs a
  rollback" is a sentence in your project's instructions for the agent.
- **A question you want every refinement to ask.** That is a line under
  "Refining: this repository" in `CLAUDE.md`, as [`refiner`](#refiner)
  says.
- **A step in another order.** A plugin replaces a step where it stands.
  It cannot add a state or move one
  ([Why it works this way](design.md#the-order-of-the-workflow-is-fixed)).

## The UI reviewer

`factory-ui-reviewer` ships with the factory and is written to any repository
with `site` in its settings, but runs only where it is listed:

```yaml
plugins:
  build:
    reviewers:
      - agent: factory-ui-reviewer
        files:
          - src/**
          - public/**
```

It needs the `site` settings, which say how to start the website.
