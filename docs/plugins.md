# Plug-ins

The factory knows how to refine, build, and review a ticket. It does not
know your project. A plug-in is one of your own skills or agents that the
factory calls at a set moment, so what only your project knows is part of
every build.

## The idea

You write a skill or an agent the way your coding agent expects one, in
the folder it reads them from
([on Claude Code](github/reference.md#skills-in-claude-code)). Then you add
a few lines to `.claude/factory.yaml` saying what job it does:

```yaml
plugins:
  - agent: migration-reviewer
    role: reviewer
    files:
      - db/migrations/**
```

That is the whole of it. The factory never copies over your files, and an
update never touches them.

## The three roles

A role is a moment in the workflow where the factory hands off. There are
three. A repository can have several plug-ins in one role, or none.

### `reviewer`

Reads a finished change and reports problems.

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

### `mockups`

Makes pictures to choose from when a decision changes how something looks.

A repository with `site` in its settings has one already: the factory's
own `factory-design` skill, which `factory sync` writes, is its `mockups`
plug-in unless you list one of your own with this role.

| Step            | What happens                                                                        |
| --------------- | ----------------------------------------------------------------------------------- |
| **Called**      | By `factory-refine`, when one of the decisions it would bring you is about the look |
| **Handed**      | The ticket and the decision                                                         |
| **Returns**     | Screenshots of each option, with one recommended                                    |
| **Then**        | You choose, and the choice goes into the ticket                                     |
| **Without one** | The decision is described in words                                                  |

### `builder`

Builds a kind of ticket the general build would do badly.

| Step          | What happens                                                               |
| ------------- | -------------------------------------------------------------------------- |
| **Called**    | By `factory-build`, in place of its own build step                         |
| **Used when** | The ticket carries one of its `labels`                                     |
| **Handed**    | The ticket, already claimed, on its branch                                 |
| **Returns**   | The change, and a report for the pull request body                         |
| **Then**      | `factory-build` carries on as usual: reviewers, the gate, the pull request |

Good candidates: work your project always does the same way, such as a new
API endpoint with its route, handler, schema, and docs, or a new
translation added to every locale file.

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
  - agent: migration-reviewer
    role: reviewer
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
3. Add it under `plugins` with its `role`, and `files` or `labels`.
4. Run `factory config check`. It fails if the file is missing or the
   role is not one of the three.
5. Run `factory plugins` to see the list the factory will use.

No sync is needed. Plug-ins are read from your settings each time.

## What is not a plug-in

- **A skill you call yourself.** If nothing in refining, building, or
  reviewing a ticket should call it, it needs no entry. It stays an
  ordinary skill.
- **A skill another of your skills calls.** A reviewer that only your own
  `builder` launches is that builder's business.
- **A rule.** "Migrations always wait for me" is `auto-merge`. "Every
  migration needs a rollback" is a sentence in your project's instructions
  for the agent.

## The UI reviewer

`factory-ui-reviewer` ships with the factory and is written to any repository
with `site` in its settings, but runs only where it is listed:

```yaml
plugins:
  - agent: factory-ui-reviewer
    role: reviewer
    files:
      - src/**
      - public/**
```

It needs the `site` settings, which say how to start the website.
