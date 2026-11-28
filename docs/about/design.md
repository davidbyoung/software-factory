# Why it works this way

The reasons behind the choices a user runs into. You do not need this page
to use the factory. Read it when something seems odd and you want to know
whether it is deliberate.

## Your agent writes the code; a person approves it

A cloud build's commits name your coding agent as their author, and as
their committer the account whose token pushes them. That account opens the
pull request too. Working alone, that is usually your own account. A team
can give it an agent account instead, one account on the code host that
every cloud build acts as, so the pull request's author is not one of the
people who must approve it. Nothing else changes between the two.

An organization that an owner has set up has that agent account without
making one: its builds act as the organization's own app on the code
host. The pull request is the app's, and the commits name the app as
their committer. The automated review posts as a different account, so a
build cannot pass its own review. A cloud build's commits are not signed
either way ([Limitations](limitations.md#what-it-does-not-do)).

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

## The agent and a sign-in are never on the same machine

A session in the cloud reads text that others wrote, such as tickets and
review comments, with nobody watching. Anything on its machine that it can
read, that text could talk it into giving away. So a cloud run is three
jobs, and the one with the agent has no sign-in to the code host: one job
hands it files, and another, with no AI, checks what it left and does it
([What a cloud run is](../security/cloud-runs.md#what-a-cloud-run-is)).

It costs something. A session can't push as it goes or wait for CI, so each
round of a review is a run of its own, which remembers nothing. It can't
change a workflow file, use Docker, or reach a host you did not list. In
return, the key of an organization's app, which acts on every repository
the app is installed on, is never where text could reach it.

The skills are the same in the cloud as on your machine. Their `factory`
commands read from what was handed over there, and keep what they would
write.

## Everything waits for you by default

No pull request merges itself until you list the files that may. A tool
that merges on its own has to earn that one file pattern at a time.

## The factory's files are copied into your repository

The skills, agents, and rules are written into your repository and
checked for drift, which is more machinery than loading them from the
package. A cloud build starts in a fresh copy of your default branch, and
what is committed there is what it reads, so the instructions a build
follows are ones a person merged, and a pull request that changes them
shows how. The choice is not
forced: loading them from the package would also work.

It has one real benefit. Every version of the instructions your sessions
followed is in your repository's history, beside the code they built, and
an update shows you exactly which instruction changed.

The package is still laid out as a plugin for today's coding agent, so
that route stays open.

## The workflows are not copied

The CI jobs are the one part that is not a copy. Your repository holds
two short workflow files, `.github/workflows/factory.yml` and
`.github/workflows/factory-review.yml`, and each has one job that calls
a workflow in the factory's own repository, at the exact version your
repository names. The skills, agents, and rules have to be committed
files, since those are what a session loads, in the cloud as on your
machine. A workflow does not: the code host can run one from another
repository at a version, so your repository need not carry about ten
files that change with every release. The two files hold only what is
your repository's own: its default branch, which parts are on, the
poller's schedule, and the names of its secrets.

There are two files and not one because the cloud runner runs a
`pull_request` workflow from the pull request's copy, and what decides a merge must run
from the default branch's copy, where a pull request cannot change how
it is judged. The one that runs from the pull request's copy is given no
secret.

The version in them is exact, never a moving one such as `v1`: the
copied files and the jobs have to be the same version, so a release
reaches your repository only as a pull request you merge
([Updating](../maintain/updating.md#what-happens)).

## The factory is installed once on a machine

Your repository holds no `package.json` entry for the factory and no
copy of its code. The `factory` command on a machine reads the version a
repository names in `.claude/factory.lock` and runs that one, which it
downloads the first time. So a repository in any language carries
nothing of Node's, everyone working in it runs the same version without
installing anything after an update, and two repositories on one machine
can be on different versions.

## Skill names start with `factory-`

The prefix is part of each skill's name. It shows which skill files an
update will overwrite and which are yours, and keeps the factory's names
from colliding with your own.
[The reference](../integrations/claude-code.md#skills-in-claude-code) says why the
name is not written with a colon.

## The settings hold only what a script computes

Every key in `.claude/factory.yaml` is something the tool calculates with:
a path pattern, a command, a number. Anything that needs judgment, such as
when a reviewer applies, stays as prose in your instructions for the agent
or in the agent's own description, where a session reads it.

A setting that a session would have to interpret is a setting that behaves
differently from one day to the next.

## The order of the workflow is fixed

You can turn parts off in [the settings](../reference/settings/README.md), such as
written specs or the automated review, and a [plugin](../customize/plugins.md) of yours can take a
step over: how a ticket is refined, how a ticket with one of your labels
is built, how a test is proved able to fail, which agents read the tests
and the change, and how a generated file is rebuilt after a conflict. You
cannot reorder the six states, add one, or leave one out.

A step can be replaced because what it hands to the next one can be
written down, and the part a build depends on is checked by a script: a
refined ticket is refused until its body has the sections a build reads,
whichever skill refined it. So whatever does a step, the next step reads
the same thing.

The order is another matter. Mapping names is cheap to support, which is
why a board's columns can be yours. Every extra shape of workflow is one
more path each skill has to handle correctly, and a skill is instructions,
which cannot be unit tested.

Your coding agent suggests which of your board's columns shows each
state once, when `factory init` sets up your board
([You already have a board](../features/board.md#you-already-have-a-board)).
After that it is an ordinary setting, read the same way every time.

A state can already take a list of column names.
[_Planned_](../developing.md#what-is-built): other ticket systems, which
name their states differently and fit the same setting.
[Jira](../integrations/jira.md) lets each kind of ticket, such
as a bug or a story, follow its own sequence of states; the factory
would move a ticket to the first listed name that its own sequence has.
Linear gives each team one sequence, which works as a board does. If a
name ever had to mean different states for different kinds of ticket,
an optional `columns-by-type` setting would hold only those exceptions,
and every settings file written before it would read the same.

Refinement writes each factory field into a ticket field of yours, or
into the description, by the ticket field's name, with no setting for
each kind of ticket. A ticket whose kind can't hold the ticket field
keeps that factory field in its description.
[_Planned_](../developing.md#what-is-built): on [Jira](../integrations/jira.md), where a kind of
ticket can leave a field out, a factory field could name a list of
ticket fields, `spec: [Acceptance criteria, AC]`, and go in the first
the ticket can hold, as a state does with columns. A `fields-by-type`
setting would hold only the exceptions, if one were ever needed.

## What a session noticed waits in its pull request

A session lists what else it noticed in its pull request, and opens no
ticket for it: you [decide there](../workflow/follow-ups.md). A ticket for each
cost a review and a merge for every one-line fix. One ticket for all of them
became a list of things that had nothing to do with each other. Deciding on
the pull request takes seconds, with the change in front of you, and three
at most keeps the list short.

## Three version numbers

The factory, the settings file, and the comment markers each have a
version.

| Number                                | Where it is                                  | Changes when                         |
| ------------------------------------- | -------------------------------------------- | ------------------------------------ |
| The factory's, the one the lock names | `factory.lock` and the two workflow files    | Every release                        |
| The settings file's                   | `version:` at the top of `factory.yaml`      | A key is renamed or moved            |
| The comment markers'                  | In the comments the factory posts on tickets | The format of those comments changes |

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
