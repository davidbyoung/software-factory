# Host the poller

For someone who wants builds to start within a minute of a move to
Ready, and has a server to run the poller on. At the end the poller runs
there.

## What you get

A build starts within about a minute of a ticket's move to Ready, rather
than at the next scheduled pass.

## What it needs

One always-on container with outbound network access and half a gigabyte
of memory. It serves no traffic. A poller you host serves one repository:
an organization's one poller runs only on a schedule.

## Turn it on

To turn it on, set the trigger and run the image, as below. To turn it
off, see [Stop hosting it](#stop-hosting-it).

### Hosting the poller: `own-server`

Set the trigger in `.claude/kodor.yaml`. `kodor init` writes it when
you choose a server you host; without it the poller polls nothing:

```yaml
builds:
  trigger: own-server # start a build when a ticket moves to Ready, through the poller you host
```

Each release of kodor publishes the poller as a container image,
`ghcr.io/kodor-ai/kodor-poller`, tagged with its version and
`latest`. It holds nothing but Node and that version of kodor, runs
as an unprivileged user, and needs no sign-in to pull. Run the version on
the `version:` line of your repository's `.claude/kodor.lock`, with the
two variables [What it reads](builds-from-the-board.md#what-it-reads) names; `kodor init` prints the exact
line. To try it on your machine, with the token in your shell's own
`KODOR_BOARD_TOKEN`:

```bash
docker run \
  -e KODOR_REPOSITORY=your-name/your-repo \
  -e KODOR_BOARD_TOKEN \
  ghcr.io/kodor-ai/kodor-poller:0.2.0
```

**It worked when** its log shows `settings from .claude/kodor.lock on main:`
with your board and ready column, then a heartbeat with the number of Ready
tickets.

**A host that builds from your repository,** rather than running an image,
needs a Dockerfile there. Add one of a single line, such as
`poller/Dockerfile`:

```dockerfile
FROM ghcr.io/kodor-ai/kodor-poller:0.2.0
```

and an entry for your dependency bot, so it opens a pull request for each
new version of the image, which waits for you as kodor's own
[update](../maintain/updating.md) does.
[GitHub](../integrations/github.md#dependabot-and-the-pollers-image) has the entry.

As an example, one setup runs it as a worker on DigitalOcean's App
Platform, in the same app as the site it builds, for about $5 a month. Its
app spec declares the worker, points it at the Dockerfile, redeploys it on
every merge, and sets the two variables, with the board's token as a
secret. Any host that runs a container works the same way.

### Stop hosting it

Set [`builds.trigger`](../reference/settings/builds.md#builds) to another
value first, so nothing waits on the poller. Then stop the poller wherever
you host it, and delete it with the `KODOR_` variables you gave it.

## How it works

The poller you host reads your board once a minute, and never exits.
[The poller](builds-from-the-board.md#the-poller) says what it does on
each pass, and [What it reads](builds-from-the-board.md#what-it-reads)
where it finds your settings.

## Its settings

One: [`builds.trigger`](../reference/settings/builds.md#builds), set to
`own-server`. The hosting is yours: nothing else about it goes in
`.claude/kodor.yaml`, and kodor never deploys it.

## When something goes wrong

### When something fails

| What you see                                                                | What happened                                   | What to do                                                                                               |
| --------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `kodor status` flags a Ready ticket "not started, is the poller running?"   | The poller is down or stuck                     | Read its log, wherever your host shows the container's log                                               |
| A comment saying a build could not start, with a refusal from the code host | The token cannot start a build                  | Give it what [Secrets](../security/credentials.md#secrets) names, then move the ticket to Ready again    |
| The board stops updating                                                    | The board's token is missing or expired         | Replace it. The poller uses the same token                                                               |
| A ticket in Ready is skipped                                                | It is blocked by an open ticket                 | It starts at the poller's first pass after the blocker closes                                            |
| Its log says `not polling:`                                                 | Your settings say not to poll, or can't be read | [When its log says `not polling:`](builds-from-the-board.md#when-its-log-says-not-polling) has each line |

## On your tools

- [GitHub Projects](../integrations/github-projects.md)
- [GitHub Actions](../integrations/github-actions.md)
