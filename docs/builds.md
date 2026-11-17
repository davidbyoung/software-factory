# Builds in the cloud

A build is one session taking one approved ticket to a pull request. You
can always build a ticket by asking a session on your machine. A build in
the cloud does the same with nobody at the keyboard: it runs on your code
host's cloud runner, and you read its log or its pull request afterward.

On GitHub, the cloud runner is GitHub Actions.
[Setting up on GitHub](github/setup.md) has the steps,
and the [reference](github/reference.md#workflows) has what runs there.

## Three ways a build starts

| You                                 | The build runs                          | You need                                                          |
| ----------------------------------- | --------------------------------------- | ----------------------------------------------------------------- |
| Ask a session: "build ticket 12"    | In that session, wherever you opened it | Nothing                                                           |
| Run `factory build 12`              | In the cloud                            | Builds in the cloud set up                                        |
| Move the ticket to Ready on a board | In the cloud, at the poller's next pass | Builds in the cloud set up, and [the poller](#the-poller) running |

Which of the last two you use is
[`builds.trigger`](configuration.md#builds) in your
[settings](configuration.md#builds):

| `trigger`       | Moving a ticket to Ready                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `manual`        | Records your approval and starts nothing. The default                                                             |
| `own-server`    | Starts a build within a minute, through the poller you host                                                       |
| `github-action` | Starts one at the next pass of a schedule on the cloud runner, every `poll-minutes` minutes, with nothing to host |

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
code host, which the build acts as.
[`factory init`](github/setup.md#run-factory-init) asks for each and
stores it.

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

The poller is a small program of the factory's. It runs on a server you
host, reading your board once a minute and never exiting, or as one pass
at a time on a schedule in the cloud. Each time it reads the board, for
each ticket in Ready with no open blocker it:

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

On a server you host, the poller runs with no copy of your repository, so
it takes everything from environment variables. All four are required; it
exits at startup naming any that is missing. On a schedule it has a
checkout, and needs only the token.

| Variable               | What it is                                                          |
| ---------------------- | ------------------------------------------------------------------- |
| `FACTORY_REPOSITORY`   | The repository, as `owner/name`                                     |
| `FACTORY_BOARD_OWNER`  | The account the board belongs to                                    |
| `FACTORY_BOARD_NUMBER` | Which board                                                         |
| `FACTORY_BOARD_TOKEN`  | An access token that can read the board, comment, and start a build |

One more is optional. `FACTORY_READY_COLUMN` is the name of the column
that approves a build, and defaults to Ready. The poller has no settings
file, so a repository whose
[`tickets.columns.ready`](configuration.md#ticketscolumns) names another
column sets it where the poller runs. `factory board check` reminds you
when it applies.

The repository and the board's number repeat what your settings file says,
because the poller cannot read it. The factory takes the board's owner to
be the repository's owner everywhere else, a person or an organization, so
a board owned by another account is not supported yet.

### Its limits

- **It starts at most 20 builds an hour,** counted from the start comments
  it posted, so a restart or a scheduled pass still knows them. A ticket
  past that waits, and the poller's log says so. Each build may run as long as
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

Each release of the factory publishes the poller as a container image,
`ghcr.io/davidbyoung/software-factory-poller`, tagged with its version and
`latest`. It holds nothing but Node and that version of the factory, runs
as an unprivileged user, and needs no sign-in to pull. Run the version your
repository installs, with the variables above; `factory init` prints the
exact line. To try it on your machine:

```bash
docker run \
  -e FACTORY_REPOSITORY=your-name/your-repo \
  -e FACTORY_BOARD_OWNER=your-name \
  -e FACTORY_BOARD_NUMBER=1 \
  -e FACTORY_BOARD_TOKEN \
  ghcr.io/davidbyoung/software-factory-poller:0.2.0
```

**A host that builds from your repository,** rather than running an image,
needs a Dockerfile there. Add one of a single line, such as
`poller/Dockerfile`:

```dockerfile
FROM ghcr.io/davidbyoung/software-factory-poller:0.2.0
```

and this entry in `.github/dependabot.yml`, so each new version of the
factory updates it, alongside the factory's own update:

```yaml
- package-ecosystem: docker
  directory: /poller
  schedule:
    interval: weekly
```

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
| `factory status` flags a Ready ticket "not started, is the poller running?" | The poller is down or stuck             | Read its log                                                                                 |
| A comment saying a build could not start, with a refusal from the code host | The token cannot start a build          | Give it what [Secrets](github/by-hand.md#secrets) names, then move the ticket to Ready again |
| The board stops updating                                                    | The board's token is missing or expired | Replace it. The poller uses the same token                                                   |
| A ticket in Ready is skipped                                                | It is blocked by an open ticket         | It starts at the poller's first pass after the blocker closes                                |

## A scheduled poller: `github-action`

For a repository with nowhere to run a container. `factory sync` writes a
workflow, `factory-poller.yml`, that runs one pass of the poller on a
schedule, and by hand:

```bash
factory poller --once
```

It reads your board and the Ready column from your settings, and the
board's token from the secret the board sync already uses. Each build it
starts is a run of its own, so several build at once, as with the poller
you host. Two passes never overlap: a late one waits for the one before.

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

`factory status` flags a Ready card "not started, is the factory-poller
workflow running?" once it has waited the interval and 15 minutes more.

**Moving from a poller you host to the schedule,** stop the one you host:
both would start builds, and each start comment counts toward the 20 an
hour.

### When the schedule fails

| What you see                                                                                 | What happened                                                 | What to do                                             |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------ |
| `factory status` flags a Ready ticket "not started, is the factory-poller workflow running?" | The workflow failed, or the code host switched it off         | Run `factory doctor`, and read the workflow's last run |
| `factory doctor` says `factory-poller.yml is disabled`                                       | The code host switched the schedule off in a quiet repository | Do what `doctor` says to switch it back on             |
| A failed run of the workflow saying `not polling: FACTORY_BOARD_TOKEN not set`               | The board's token is not a secret here                        | Run `factory init` to add it                           |

[The reference](github/reference.md#limits) has GitHub's own numbers.

## No trigger: `manual`

Nothing watches the board. Moving a ticket to Ready records your approval
and starts nothing. Ask a session:

```text
build ticket 12
```

The session claims the ticket, which moves it to "building" on the board,
and builds it where you are.
