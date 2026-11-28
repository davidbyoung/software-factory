# `builds`

What starts a build when you approve a ticket, and where the build runs.

```yaml
builds:
  trigger: own-server
```

| Setting        | What it sets                                                  | Choices                                 | Default          |
| -------------- | ------------------------------------------------------------- | --------------------------------------- | ---------------- |
| `trigger`      | What notices you moved a ticket to Ready on the board         | `manual`, `own-server`, `github-action` | `manual`         |
| `runner`       | Where a build in the cloud runs                               | `github-actions`                        | `github-actions` |
| `poll-minutes` | With `github-action`, how often it checks the board           | 5, 10, 15, 30, or 60                    | 5                |
| `max-per-hour` | How many builds the poller starts in any one hour             | A whole number, 1 or more               | 20               |
| `hosts`        | The hosts a cloud session may reach, besides the npm registry | A list of host names                    | None             |

The three triggers:

- **`manual`:** nothing watches the board. You build a ticket by running
  `/factory-build 12` in a session.
- **`own-server`:** a small program you host, the poller, checks the board
  once a minute and starts a cloud build for each ticket in Ready.
  [Hosting the poller](../../features/hosting-the-poller.md#hosting-the-poller-own-server) shows how
  to run it.
- **`github-action`:** a schedule on GitHub Actions does the same every
  `poll-minutes` minutes, with nothing for you to host. On a private
  repository, each check is billed as at least one Actions minute.
  `factory sync` writes its schedule into
  `.github/workflows/factory.yml`, with one exception: a repository that
  follows a [preset](../../customize/presets.md) whose repository runs the poller, as an
  organization's `factory-config` does, gets no schedule of its own. The
  one schedule is then that repository's
  `.github/workflows/factory-poller.yml`, and `poll-minutes` in the
  preset must match that file's `cron` line, which `factory preset check`
  compares ([Checking and releasing](../../customize/writing-a-preset.md#checking-and-releasing)).

Watch the spelling: the trigger is `github-action`, singular, and the
runner is `github-actions`, plural.

Whatever starts it, a cloud build runs on the cloud runner.
[Builds](../../features/cloud-builds.md) explains each trigger. **It worked when** a ticket you
move to Ready shows as In progress on the board within a few minutes. If
nothing is watching the board, a ticket you move to Ready just sits there, and `factory status`
marks it "not started": after 5 minutes with `own-server`, and after
`poll-minutes` plus 15 minutes with `github-action`.

`factory config check` stops on `poll-minutes` with any trigger but
`github-action`, and on any value but the five above. It stops on a
`max-per-hour` that isn't a whole number of 1 or more.

A [session in the cloud](../../features/cloud-builds.md#what-a-session-can-use) reaches the npm
registry and no other host, unless you list it. List a host under `hosts`
when a command the session runs downloads from it, such as your package
manager's registry:

```yaml
builds:
  hosts:
    - repo.packagist.org
    - "*.example.com" # every host under example.com
```

It worked when that command succeeds in your next build. Each host is also
one a [hijacked session](../../security/risks.md#what-a-hijacked-session-could-still-do)
could send what it was handed to, so list few. What
[`commands.build-setup`](commands.md#commandsbuild-setup) downloads needs no entry,
since it runs before the session, outside its sandbox.

Write a name that starts with `*.` in quotes, since YAML reads a bare `*`
as something else. Write the name alone: `factory config check` stops on
one with `https://`, a path, or a port, and on an IP address. It also stops
on `github.com`, `githubusercontent.com`, any host under either, and `*.com`:

```text
.claude/factory.yaml: builds.hosts can't name GitHub: a build has no GitHub access
```

A [preset](../../customize/presets.md#how-presets-combine)'s hosts and your own add up.
