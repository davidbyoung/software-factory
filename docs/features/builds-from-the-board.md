# Builds that start from the board

For someone who wants a ticket built when they move it to Ready. At the
end you know which of the three triggers fits you, and what the poller
reads. The trigger is
[`builds.trigger`](../reference/settings/builds.md#builds), one of:

- **`own-server`:** a poller you host starts a build within a minute
  ([Host the poller](hosting-the-poller.md)).
- **`github-action`:** a poller on a schedule in the cloud starts one at
  its next pass ([A scheduled poller](#a-scheduled-poller-github-action)).
- **`manual`:** nothing starts a build from the board
  ([No trigger](#no-trigger-manual)).

## What you get

A ticket you move to Ready is built without anyone typing a command, by
a poller you host or one on a schedule in the cloud.

## What it needs

A [board](board.md) with a Ready column, and
[builds in the cloud](cloud-builds.md), since each build the poller
starts runs there.

## Turn it on

Choose the trigger when `factory init` asks "Where does the poller
run?", or set
[`builds.trigger`](../reference/settings/builds.md#builds) yourself. A
poller you host has a page of its own:
[Host the poller](hosting-the-poller.md).

### A scheduled poller: `github-action`

For a repository with nowhere to run a container. Where the schedule
is depends on who runs the poller:

- **A repository that does not follow an organization's preset,** as on
  your own account, runs its own. `factory sync` writes the poller's schedule into
  `.github/workflows/factory.yml`, whose poller job runs one pass of the
  poller on that schedule, and by hand:

  ```bash
  factory poller --once
  ```

  It reads your board and the Ready column from your settings, and the
  board's token from the secret the board sync already uses.

- **A repository that follows its organization's preset** shares the
  organization's one. The schedule is one file,
  `.github/workflows/factory-poller.yml`, in the organization's
  `factory-config` repository. Nobody runs its command by hand: on each
  schedule, the file's job runs one pass for every repository, as:

  ```bash
  factory poller --once --preset factory-preset.yaml
  ```

  It reads the board, the Ready column, and
  [`builds.max-per-hour`](../reference/settings/builds.md#builds) from the preset
  beside it, and acts with a token made from the organization's app. A
  repository that follows a preset from that repository gets no schedule
  in its own `factory.yml`, and its `factory doctor` checks the
  organization's file too:

  ```text
  ✓ factory.yml is enabled
  ✓ factory-poller.yml is enabled in acme/factory-config
  ```

  The `cron` line of that file and `builds.poll-minutes` in the preset
  say the same interval twice. Change both together:
  [`factory preset check`](../customize/writing-a-preset.md#checking-and-releasing) fails when
  they differ. A ticket in Ready in a repository the app is not
  installed on gets no comment: the pass shows a warning that names the
  repository in its run's log, and goes on to the next.

Each build a pass starts is a run of its own, so several build at once,
as with the poller you host. Two passes never overlap: a late one waits
for the one before.

It is slower and can cost more than the poller you host, so know how
before choosing it:

- **It starts a build at its next pass.** The schedule runs every
  `builds.poll-minutes` minutes, 5 at the fastest, and the cloud runner
  starts scheduled runs late when it is busy: at 5, a build starts 5 to 15
  minutes after the card moves, and longer at a longer interval.
- **It costs Actions minutes on a private repository.** Each pass is billed
  as at least a minute, whether or not a card was Ready. A public
  repository pays nothing.

  | `poll-minutes` | Passes a month |
  | -------------- | -------------- |
  | 5, the default | 8,640          |
  | 10             | 4,320          |
  | 15             | 2,880          |
  | 30             | 1,440          |
  | 60             | 720            |

  `factory init` asks the interval on a private repository, suggesting 30.

- **The code host can switch a schedule off** in a public repository that
  goes quiet. `factory doctor` fails when it has, and says how to switch it
  back on.

A ticket that waits well past its next pass is flagged by
`factory status` ([When the schedule fails](#when-the-schedule-fails)).

**Moving from a poller you host to the schedule,** set
`builds.trigger: github-action` and merge it. From its next pass, the
poller you host starts nothing, and logs
`not polling: builds.trigger is github-action on main, not own-server`.
Then stop it.

[GitHub Actions](../integrations/github-actions.md#limits-that-come-from-github) has the cloud
runner's own numbers.

### No trigger: `manual`

Nothing watches the board. Moving a ticket to Ready records your approval
and starts nothing. In a session, type:

```text
/factory-build 12
```

The session claims the ticket, which moves it to "building" on the board,
and builds it where you are.

## How it works

### The poller

The poller is a small program of the factory's. It runs on a server you
host, reading your board once a minute and never exiting, or as one pass
at a time on a schedule in the cloud. Each time it reads the board, for
each ticket in Ready with the factory label and no open blocker, in the
order the ready column shows them, top first, it:

1. records a start note on the ticket, saying a build is starting;
2. starts a build of that ticket in the cloud, from your default branch.

```bash
factory poller
```

The board shows the ticket as starting until the build claims it, and a
nightly pass releases a start nothing claimed in 24 hours. Only someone
who can write to the repository can start a build, so the build itself
does no further check.

**An organization has one poller for all its repositories.** It is a
schedule in the organization's `factory-config` repository, which
`factory init --org` sets up
([Set an organization up, once](../setup/organization.md#set-an-organization-up-once)).
Each pass reads the organization's board once, and for each repository
with a ticket in Ready it does what the list above says, in that
repository: the same tickets, in the same order, with that repository's
own count toward the builds an hour that [Its limits](#its-limits)
allows. A repository that follows the
organization's [preset](../customize/presets.md) runs no poller of its own.

The poller skips a repository whose settings in effect set
[`builds.trigger`](../reference/settings/builds.md#builds) to anything but `github-action`: its own
`.claude/factory.yaml` first, then the presets it follows, then the
default, `manual`. So to keep a repository's tickets from the
organization's poller, set `builds.trigger: manual` in its own
`.claude/factory.yaml`. A repository that doesn't follow the
organization's preset is skipped too, since its default is `manual`:
[add the preset](../customize/presets.md#adding-a-preset) for the poller to build it.
A repository with no `.claude/factory.yaml` is not skipped, and its
ticket gets a comment saying why its build can't start.
[A scheduled poller](#a-scheduled-poller-github-action) says what
differs there.

#### What it reads

On a server you host, the poller has no copy of your repository. Its
environment tells it which repository, and gives it a token. Both are
required:

| Variable              | What it is                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `FACTORY_REPOSITORY`  | The repository, as `owner/name`                                                                                                        |
| `FACTORY_BOARD_TOKEN` | An access token that can read the board, comment, and start a build: [Secrets](../security/credentials.md#secrets) has the one to make |

Without `FACTORY_REPOSITORY` it logs
`ready-poller not started: FACTORY_REPOSITORY is not set` and exits.
Without the token, it logs `not polling: FACTORY_BOARD_TOKEN not set`
and starts no build.

Everything else it reads from your settings on your default branch, at
every pass: [`tickets.board`](../reference/settings/tickets.md#tickets), the ready
column in [`tickets.columns`](../reference/settings/tickets.md#ticketscolumns), the
factory label in [`tickets.labels`](../reference/settings/tickets.md#ticketslabels),
and [`builds.max-per-hour` and `builds.trigger`](../reference/settings/builds.md#builds).
It reads them from `.claude/factory.lock`, the file `factory sync`
writes with your settings as they apply, your presets' values included.
So a change to your settings reaches the poller within a minute of
merging, and there is nothing to restart. Its log says what it read,
when it first reads the settings and again whenever they change. It
names your default branch, `main` here:

```text
settings from .claude/factory.lock on main: board 1, ready column "Ready", label "factory", 20 builds an hour
```

The board must belong to the account that owns the repository, a person
or an organization. A board owned by another account is not supported
yet.

**It polls nothing while your settings say not to,** and its log says
why: once when it stops, again if the reason changes, and in the
heartbeat it logs each hour. It checks at every pass, so it starts again within a minute
of the fix merging. [When its log says `not polling:`](#when-its-log-says-not-polling)
has each line and what to do.

**A poller set up before it read your settings** had five more
variables: `FACTORY_BOARD_OWNER`, `FACTORY_BOARD_NUMBER`,
`FACTORY_READY_COLUMN`, `FACTORY_LABEL`, and `FACTORY_MAX_PER_HOUR`. It
no longer reads them, and keeps working with them set. When it starts,
it names each one that is still set, for you to take out
([The poller reads your settings](../maintain/upgrade-notes.md#the-poller-reads-your-settings)):

```text
FACTORY_BOARD_OWNER, FACTORY_BOARD_NUMBER, FACTORY_READY_COLUMN are no longer read: the settings on main are. Take them out of the poller's environment.
```

#### When the poller and the factory differ

The [poller's image](hosting-the-poller.md#hosting-the-poller-own-server) and the factory in
your repository update separately, each by a pull request of its own,
so for a while one can be a release ahead of the other. The
poller reads only the settings it uses, and leaves any other alone, so
a newer factory in your repository doesn't stop it. If a setting it uses
has changed in a way it can't read, it polls nothing and names both
versions:

```text
not polling: .claude/factory.lock on main: tickets.columns.ready: must be one column, or none: only a ticket you approved goes there (written by factory 0.3.0, and this poller is 0.2.0: run ghcr.io/davidbyoung/software-factory-poller:0.3.0)
```

Run the image it names.

#### Its limits

- **It builds only tickets with the factory label**
  ([Which tickets are the factory's](../workflow/tickets.md#which-tickets-are-the-factorys)).
  A ticket without it sits in Ready and nothing starts it.
- **It starts at most 20 builds an hour,** or what
  [`builds.max-per-hour`](../reference/settings/builds.md#builds) says, counted from the start notes
  it recorded, so a restart or a scheduled pass still knows them. A ticket
  past that waits, and the poller's log says so. Each build may run as long as
  [`session-minutes`](../reference/settings/session-minutes.md#session-minutes) allows, so several
  can run at once: each pays for its own minutes, and the cloud runner
  limits how many run at the same time.
- **It backs off** when it cannot read the board, and logs each failure.
- **It logs a heartbeat each hour** with the number of Ready tickets it saw.
- **It never retries a build.** A build that failed to start leaves a
  comment on the ticket, with the code host's reason, and the ticket in
  "building", waiting on you.

## Its settings

[`builds.trigger`, `builds.max-per-hour`, and `builds.poll-minutes`](../reference/settings/builds.md#builds)
say which trigger runs, how many builds it starts an hour, and how often a
scheduled poller passes.
[What it reads](#what-it-reads) names the rest.

## When something goes wrong

A poller you host has a table of its own:
[When something fails](hosting-the-poller.md#when-something-fails).

### When its log says `not polling:`

A poller you host names the reason it starts nothing in its log, in one
of these lines:

| What its log says                                                                                                                     | What to do                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `not polling: no .claude/factory.lock on main yet. Merge the pull request that sets the factory up.`                                  | Merge the pull request `factory init` opened                                                                                                                      |
| `not polling: builds.trigger is manual on main, not own-server`                                                                       | Set `builds.trigger: own-server`, as [Hosting the poller](hosting-the-poller.md#hosting-the-poller-own-server) shows, and merge it                                |
| `not polling: builds.trigger is github-action on main, not own-server`                                                                | Stop the poller you host: the schedule starts your builds now                                                                                                     |
| `not polling: tickets.board is not set on main`                                                                                       | Set [`tickets.board`](../reference/settings/tickets.md#tickets)                                                                                                   |
| `not polling: .claude/factory.lock on main: builds.max-per-hour: must be a whole number, 1 or more`, or another setting and its fault | Fix that setting. If the line ends by naming two versions, run the newer image: [When the poller and the factory differ](#when-the-poller-and-the-factory-differ) |

### When the schedule fails

`factory status` flags a Ready ticket as not started once it has waited
the schedule's interval and 15 minutes more. The flag names where the
poller runs: the poller's job in `factory.yml`, or, for an organization's
poller, the repository that holds it, such as `acme/factory-config`.

| What you see                                                                                       | What happened                                                                              | What to do                                                                                                                                         |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `factory status` flags a Ready ticket "not started, is the poller's job in factory.yml running?"   | The job failed, or the code host switched the workflow off                                 | Run `factory doctor`, and read the poller job's last run                                                                                           |
| `factory doctor` says `factory.yml is disabled`                                                    | The code host switched the workflow off in a quiet repository                              | Do what `doctor` says to switch it back on                                                                                                         |
| A failed run of the poller's job saying `not polling: FACTORY_BOARD_TOKEN not set`                 | The board's token is not a secret here                                                     | Run `factory init` to add it                                                                                                                       |
| `factory status` flags a Ready ticket "not started, is the poller in acme/factory-config running?" | The organization's poller failed, is switched off, or cannot reach the ticket's repository | Run `factory doctor`, and read the last run of "Factory poller" in that repository. A warning there names a repository the app is not installed on |

## On your tools

- [GitHub Projects](../integrations/github-projects.md)
- [GitHub Actions](../integrations/github-actions.md)
- [GitHub organizations](../integrations/github-organizations.md)
