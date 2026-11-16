# Builds in the cloud

A build is one session taking one approved ticket to a pull request. You
can always build a ticket by asking a session on your machine. A build in
the cloud does the same with nobody at the keyboard: it runs on your code
host's cloud runner, and you read its log or its pull request afterward.

On GitHub, the cloud runner is GitHub Actions.
[Setting up on GitHub](github/setup.md#builds-in-the-cloud) has the steps,
and the [reference](github/reference.md#workflows) has what runs there.

## Three ways a build starts

| You                                 | The build runs                          | You need                                                          |
| ----------------------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| Ask a session: "build ticket 12"    | In that session, wherever you opened it | Nothing                                                           |
| Run `factory build 12`              | In the cloud                            | Builds in the cloud set up                                        |
| Move the ticket to Ready on a board | In the cloud, within a minute           | Builds in the cloud set up, and [the poller](#the-poller) running |

Which of the last two you use is `builds.trigger` in your
[settings](configuration.md#builds):

| `trigger`       | Moving a ticket to Ready                                                                                 |
| --------------- | -------------------------------------------------------------------------------------------------------- |
| `manual`        | Records your approval and starts nothing. The default                                                    |
| `own-server`    | Starts a build within a minute, through the poller you host                                              |
| `github-action` | _[Planned](developing.md#what-is-built)_: starts one within minutes, from a schedule on the cloud runner |

`manual` is a fine place to stay. Asking a session and running
`factory build` work whatever the trigger.

## What a build in the cloud does

```text
$ factory build 12
Started a build of ticket 12 in the cloud:
https://your-code-host/your-name/your-repo/runs/123456789
```

Anyone who can write to the repository can start one, and the claim
comment on the ticket names who did. The run's log shows each thing the
session says and each command it runs, as it happens, then the session's
turns and cost. The board shows the ticket In progress, with where it runs
and the run's link.

It ends as any build does: a pull request marked ready, its review worked,
and a report posted on the ticket. Nothing watches the pull request once
the run ends.

**How long it may run.** A build's session may run for 230 minutes, which
[`session-minutes`](configuration.md#session-minutes) changes. A build that
ends without opening a pull request releases its claim in its last step,
so a failed run does not hold its ticket.

**What it needs.** Two credentials, stored as secrets on the code host:
the agent's token, which pays for the session, and an access token for the
code host, which the build acts as. [Setting up on
GitHub](github/setup.md#secrets) says how to make and store each.

**Who it acts as.** The build acts as whoever owns that access token. Its
commits name your coding agent as their author and that account as their
committer, and its pull request and comments are that account's. When the token is yours, that is you. A team that wants an
agent account makes one on the code host, gives it write access, and stores
its token instead. Nothing else changes.

**Signed commits.** With a signing key stored as a secret, the build signs
each commit, and the code host shows it as verified when the key belongs to
the account the build acts as. Without one, its commits are unsigned.
`factory pr ready` refuses to mark a pull request ready while one of its
commits is not shown as verified, when your own git signs commits.

**Before the session starts,** the commands under
[`build-setup`](configuration.md#build-setup) in your settings run, after
your npm dependencies are installed.

## The other jobs that run in the cloud

Three more jobs run on the cloud runner. Each checks first whether there is
anything to do and starts a session only when there is, so a run with
nothing to do costs about a minute of the runner and no use of the agent. A
run that works costs about what a build does.

| Job                      | Starts on                                       | What the session does                                                                                            |
| ------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Answering your review    | A review you submit on a pull request           | Works your comments with `factory-address-review`                                                                |
| The conflict sweep       | A push to your main branch, nightly, or by hand | Merges your main branch into each pull request that conflicts with it, with `factory-resolve-conflicts`          |
| Dependency pull requests | Three times a day, or by hand                   | Moves each dependency update toward merged, with `factory-deps`, in a repository with a `.github/dependabot.yml` |

Each acts as the same account a build does. The review job answers your
reviews only: the factory's own replies start runs that find nothing of
yours in them and stop.

## The poller

The poller is a small program of the factory's that never exits. Once a
minute it reads your board, and for each ticket in Ready with no open
blocker it:

1. posts a comment on the ticket saying a build is starting, carrying a
   marker;
2. starts a build of that ticket in the cloud, from your main branch.

```bash
factory poller
```

The board shows the ticket as starting until the build claims it, and a
nightly pass releases a start nothing claimed in 24 hours. Only someone
who can write to the repository can start a build, so the build itself
does no further check.

### What it reads from its environment

The poller runs with no copy of your repository, so it takes everything
from environment variables. All four are required; it exits at startup
naming any that is missing.

| Variable               | What it is                                                          |
| ---------------------- | ------------------------------------------------------------------- |
| `FACTORY_REPOSITORY`   | The repository, as `owner/name`                                     |
| `FACTORY_BOARD_OWNER`  | The account the board belongs to                                    |
| `FACTORY_BOARD_NUMBER` | Which board                                                         |
| `FACTORY_BOARD_TOKEN`  | An access token that can read the board, comment, and start a build |

One more is optional. `FACTORY_READY_COLUMN` is the name of the column that
approves a build, and defaults to Ready. The poller has no settings file,
so a repository whose `tickets.columns.ready` names another column sets it
where the poller runs. `factory board check` reminds you
when it applies.

The repository and the board's number repeat what your settings file says,
because the poller cannot read it. The factory takes the board's owner to
be the repository's owner everywhere else, a person or an organization, so
a board owned by another account is not supported yet.

### Its limits

- **It starts at most 20 builds an hour.** A ticket past that waits, and
  the poller's log says so. Each build may run as long as
  [`session-minutes`](configuration.md#session-minutes) allows, so several
  can run at once: each pays for its own minutes, and the cloud runner
  limits how many run at the same time.
- **It backs off** when it cannot read the board, and logs each failure.
- **It logs a heartbeat each hour** with the number of Ready tickets it saw.
- **It never retries a build.** A build that failed to start leaves a
  comment on the ticket, with the code host's reason, and the ticket in
  "building", waiting on you.

## Hosting the poller: `own-server`

The poller needs one always-on container with outbound network access and
half a gigabyte of memory. It serves no traffic.

The factory ships a Dockerfile for it, `poller.Dockerfile`. It installs
nothing but Node and the poller, and runs as an unprivileged user. To try it
on your machine, from the root of the factory's own repository:

```bash
docker build -f poller.Dockerfile -t factory-poller .
docker run \
  -e FACTORY_REPOSITORY=your-name/your-repo \
  -e FACTORY_BOARD_OWNER=your-name \
  -e FACTORY_BOARD_NUMBER=1 \
  -e FACTORY_BOARD_TOKEN \
  factory-poller
```

_[Planned](developing.md#what-is-built)_: building it from an installed
package, whose files are under `node_modules/`. Until then, the Dockerfile
builds only from the factory's own repository, and a repository that uses
the factory writes its own: a Node image that runs `npm ci` and then
`npx --no-install factory poller`.

As an example, one setup runs it as a worker on DigitalOcean's App
Platform, in the same app as the site it builds, for about $5 a month. Its
app spec declares the worker, points it at the Dockerfile, redeploys it on
every merge, and sets the variables above, with the board's token as a
secret. Any host that runs a container works the same way.

That hosting is yours. Nothing about it goes in `.claude/factory.yaml`, and
the factory never deploys it.

### When something fails

| What you see                                                                | What happened                           | What to do                                                                                   |
| --------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------- |
| `factory status` flags a Ready ticket "not started"                         | The poller is down or stuck             | Read its log                                                                                 |
| A comment saying a build could not start, with a refusal from the code host | The token cannot start a build          | Give it what [the setup](github/setup.md#secrets) names, then move the ticket to Ready again |
| The board stops updating                                                    | The board's token is missing or expired | Replace it. The poller uses the same token                                                   |
| A ticket in Ready is skipped                                                | It is blocked by an open ticket         | It starts within a minute of the blocker closing                                             |

## A scheduled poller: `github-action` _[Planned](developing.md#what-is-built)_

Until it is built, use the poller above, or `manual`.

For a repository with nowhere to run a container. Setup would add a
scheduled job on the cloud runner that runs the poller for one pass:

```bash
factory poller --once
```

It is a weaker poller, and you should know how before choosing it:

- **It is slower.** The shortest schedule is every few minutes, and
  scheduled runs can start late.
- **It can cost money on a private repository.** A run every five minutes
  is roughly 8,600 runs a month, each billed as at least a minute. That is
  an estimate, not a measurement.
- **A scheduled job can be switched off** by the code host in a repository
  that goes quiet.
- **The hourly cap needs a new home.** The poller keeps its count of recent
  builds in memory, which a run that exits loses.

[The reference](github/reference.md#limits) has GitHub's own numbers.

## No trigger: `manual`

Nothing watches the board. Moving a ticket to Ready records your approval
and starts nothing. Ask a session:

```text
build ticket 12
```

The session claims the ticket, which moves it to "building" on the board,
and builds it where you are.
