# Why it works this way

The reasons behind the choices a user runs into. You do not need this page
to use the factory. Read it when something seems odd and you want to know
whether it is deliberate.

## Your agent writes the code; a person approves it

A cloud build's commits name your coding agent as their author, and as
their committer the account whose token the build is given, which is the
account that signs them. The build pushes and opens its pull request as
that account too. Working alone, that is usually your own account. A team
can give it an agent account instead, one account on the code host that
every cloud build acts as, so the pull request's author is not one of the
people who must approve it. Nothing else changes between the two.

A session on your machine commits as you, since you are the one steering
it. `factory sync` turns the coding agent's attribution
lines off, unless your agent's settings already said otherwise, so a
session's commits carry your name alone.

Either way, a person is accountable for every change that merges: the one
who merges it. The factory's job is to make that person's read of a pull
request easy, and to hold anything risky for it. When builds act as your
own account, the guard against a session approving its own work is a
tripwire that catches accidents, not a wall against the account's owner.
Your read is the control.

## Everything waits for you by default

No pull request merges itself until you list the files that may. A tool
that merges on its own has to earn that one file pattern at a time.

## The factory's files are copied into your repository

The skills, agents, rules, and CI workflows are written into your
repository and checked for drift, which is more machinery than loading
them from the package. A cloud build starts from a fresh checkout, and what
is committed to the repository is what it reads, so the instructions a
build follows are the ones the pull request shows. The choice is not
forced: loading them from the package would also work, and would mean
one version for every repository.

It has one real benefit. Every version of the instructions your sessions
followed is in your repository's history, beside the code they built, and
an update shows you exactly which instruction changed.

The package is still laid out as a plugin for today's coding agent, so
that route stays open.

## Skill names start with `factory-`

The prefix is part of each skill's name. It shows which skill files an
update will overwrite and which are yours, and keeps the factory's names
from colliding with your own.
[The reference](github/reference.md#skills-in-claude-code) says why the
name is not written with a colon.

## The settings hold only what a script computes

Every key in `.claude/factory.yaml` is something the tool calculates with:
a path pattern, a command, a number. Anything that needs judgment, such as
when a reviewer applies, stays as prose in your instructions for the agent
or in the agent's own description, where a session reads it.

A setting that a session would have to interpret is a setting that behaves
differently from one day to the next.

## The order of the workflow is fixed

You can turn parts off and add reviewers. You cannot reorder the states or
add one. Mapping names is cheap to support. Every extra shape of workflow
is one more path each skill has to handle correctly, and a skill is
instructions, which cannot be unit tested.

## Small problems go on one checklist

A session that notices a small problem adds a line to one follow-ups
ticket instead of opening a ticket for it. Every ticket costs the same
steps whatever its size, so twenty small fixes as twenty tickets cost
twenty approvals and twenty pull requests. On one checklist they cost one
of each.

## Three version numbers

They are separate on purpose.

| Number              | Where it is                                  | Changes when                         |
| ------------------- | -------------------------------------------- | ------------------------------------ |
| The factory's       | The installed package and `factory.lock`     | Every release                        |
| The settings file's | `version:` at the top of `factory.yaml`      | A key is renamed or moved            |
| The markers'        | In the comments the factory posts on tickets | The format of those comments changes |

- **Below `1.0.0`, a release may change anything**, and its notes say what.
  `1.0.0` comes when a second repository has run on the factory for a while
  and the settings have stopped moving.
- **The settings file has its own version** so that a release which does not
  touch its shape never asks you to change it.
- **The markers have a version** because those comments stay in your
  tickets' history for good, and an old one has to stay readable.

## Secrets are named for what they do

Everything the factory owns starts with `FACTORY_` and says its purpose:
`FACTORY_BOARD_TOKEN`, not a name another tool might already use. You can
tell which secrets it needs and which are safe to delete.
