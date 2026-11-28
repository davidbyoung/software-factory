# Builds in the cloud

A build is one session taking one approved ticket to a pull request. You
can always build a ticket by running `/lunamill-build N` in a session on
your machine. A build in
the cloud does the same with nobody at the keyboard: it runs on your code
host's cloud runner, and you read its log or its pull request afterward.
This page is for someone deciding whether to build in the cloud, or who
wants to know what happens when they do. At the end you know what each run
does, what it costs, and which way of starting one fits you.

[Set up a repository](../setup/repository.md) has the steps, and
[GitHub Actions](../integrations/github-actions.md#workflows) has what runs
there.

## What you get

A pull request marked ready, and a report on the ticket, from a build
nobody had to watch.

## What it needs

Two credentials, stored as secrets on the code host:
your coding agent's credential, which pays for the session, and an access token for the
code host, which the build acts as. On your own account,
[`lunamill init`](../setup/repository.md#run-lunamill-init) asks for each and
stores it. In an organization, an owner stores the agent's credential once,
with the key of the organization's own app on the code host, and the
jobs that need an access token make one from that key, so `lunamill init`
asks a developer for no token. The session itself is given no access
token ([Tokens and secrets](../security/credentials.md#who-handles-a-token)).

## Turn it on

Run `lunamill init` and check "Builds in the cloud". It asks for the two
credentials [What it needs](#what-it-needs) names and stores them as
secrets, and in an organization it uses the ones the owner stored. So
"builds in the cloud set up", in the table below, means both secrets are
stored where the cloud runner reads them. Nothing in
`.claude/lunamill.yaml` turns it on.

**It worked when** `lunamill doctor` shows ✓ on each secret's line that
ends "for builds in the cloud", and doesn't list "Builds in the cloud" as
off. Then `lunamill build 12` prints the address of the run it started.

### Three ways a build starts

| What you do                           | Where the build runs                    | What you need                                                                             |
| ------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------- |
| Run `/lunamill-build 12` in a session | In that session, wherever you opened it | Nothing                                                                                   |
| Run `lunamill build 12`               | In the cloud                            | Builds in the cloud set up                                                                |
| Move the ticket to Ready on a board   | In the cloud, at the poller's next pass | Builds in the cloud set up, and [the poller](builds-from-the-board.md#the-poller) running |

Which of the last two you use is
[`builds.trigger`](../reference/settings/builds.md#builds) in your
[settings](../reference/settings/builds.md#builds):

| `trigger`       | What moving a ticket to Ready does                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `manual`        | Records your approval and starts nothing. The default                                                             |
| `own-server`    | Starts a build within a minute, through the poller you host                                                       |
| `github-action` | Starts one at the next pass of a schedule on the cloud runner, every `poll-minutes` minutes, with nothing to host |

`manual` is a fine place to stay. Running `/lunamill-build N` in a session
and running `lunamill build N` work whatever the trigger.

## How it works

### What a build in the cloud does

```console
$ lunamill build 12
Started a build of ticket 12 in the cloud:
https://your-code-host/your-name/your-repo/runs/123456789
```

Anyone who can write to the repository can start one. The build's first
act is a comment that takes the ticket, its [claim](../reference/glossary.md#the-words),
which names who did. The run's log shows each thing the
session says and each command it runs, as it happens, then the session's
turns and cost. The board shows the ticket In progress, with where it runs
and the run's link.

It ends with a pull request marked ready and a report on the ticket. What
comes after, the review and the answers to it, are runs of their own
([What a cloud run is](../security/cloud-runs.md#what-a-cloud-run-is)).

**How long it may run.** A build's session may run for 230 minutes, which
[`session-minutes`](../reference/settings/session-minutes.md#session-minutes) changes. A build that
ends without opening a pull request releases its claim in its last job,
so a failed run does not hold its ticket.

**Who it acts as.** On your own account, the build acts as whoever owns
that access token. Its commits name your coding agent as their author
and that account as their committer, and its pull request and comments
are that account's. When the token is yours, that is you. A team that
wants an agent account makes one on the code host, gives it write
access, and stores its token instead. A session takes instructions from
anyone who can write to the repository, but never from a comment Lunamill posted, so an agent account cannot instruct a later session. In an organization that is set
up, the build acts as the organization's app: the pull request and
comments are the app's, and the commits name it as their committer.

**Its commits are never signed,** on your own account or under an
organization's app: no job that runs a session holds a signing key
([Limitations](../about/limitations.md#what-it-does-not-do)).

**Before the session starts,** the commands under
[`commands.build-setup`](../reference/settings/commands.md#commandsbuild-setup) in your
settings run, as your default branch has them. Your npm dependencies are
installed before them, with `npm ci`, when your repository's root has a
`package-lock.json`.

**When there is nothing to build to,** the build claims the ticket and then
stops it with the reason, as any build that stops does. A ticket with no
Spec and no Acceptance criteria gets:

```text
it has no Spec or Acceptance criteria section, so there is nothing to build yet: refine it first
```

**When the ticket names several repositories,** each is built by a run in
its own repository, one at a time. The run that opens a pull request starts
the next: [Build it in the cloud](../workflow/across-repositories.md#build-it-in-the-cloud).

### What a session can use

- **Hosts.** Its commands reach the npm registry and the hosts you list
  under [`builds.hosts`](../reference/settings/builds.md#builds). Your code host is never
  one, so a package it serves can't be installed by a session
  ([`commands.build-setup`](../reference/settings/commands.md#commandsbuild-setup) says what
  to do instead). A package manager other than npm needs its registry
  there:

  ```yaml
  builds:
    hosts:
      - pypi.org # pip's registry, and where its files are
      - files.pythonhosted.org
  ```

  It worked when your gate passes in a build.

- **Git LFS files are pointers.** There is no sign-in to fetch them with, so
  a gate that reads one fails.
- **Docker does not run there.** A gate or a test that starts a container
  fails, so that ticket is built on your machine.
- **A browser needs a flag.** Chromium can't start its own sandbox inside
  the agent's. A test that drives it has to start it with `--no-sandbox`:

  ```ts
  // playwright.config.ts
  export default defineConfig({
    use: { launchOptions: { args: ["--no-sandbox"] } },
  });
  ```

- **No hook runs,** so [`commands.before-commit`](../reference/settings/commands.md#commandsbefore-commit)
  does not either. Your gate, your CI, and Publish's checks take their
  place.
- **Its dependencies.** What was installed before it started is your
  default branch's. The session installs the dependencies of the branch it
  works on itself, when a command needs them, so your registry has to be
  reachable from the sandbox.

### What a run costs

- **Your coding agent's use,** which the run's log ends with: its turns,
  its minutes, and its price at list prices. Publish notes it on the pull
  request, or on the ticket when there is none, and the board adds it to the
  ticket's Cost.
- **The cloud runner's minutes,** on a plan that bills them. A run is
  three jobs, and
  [GitHub Actions](../integrations/github-actions.md#limits-that-come-from-github)
  says how it rounds each one. Publish's
  minutes include its wait for CI, so a run whose CI takes 20 minutes pays
  for those 20 twice: once in CI's own jobs, and once in Publish.
- **More than one run for a ticket.** A pull request that uses both rounds
  of review is one build, three reviews, and two answers, each of three
  jobs.
- **A run with nothing to do** is Prepare alone, about a minute, and no use
  of the agent. Looking for conflicts is one job on each push to your
  default branch. With work to do and no token to do it with, a run that
  nobody asked for says so and passes
  ([With a part off](../integrations/github-actions.md#with-a-part-off)).

One more job runs no session: three times a day, the update job opens a
pull request for a newer release of Lunamill, and for a
[preset](../customize/presets.md) that changed. [Updating](../maintain/updating.md#what-happens)
describes it.

## Its settings

[`builds.trigger`](../reference/settings/builds.md#builds) and
[`builds.hosts`](../reference/settings/builds.md#builds),
[`session-minutes`](../reference/settings/session-minutes.md#session-minutes),
and [`commands.build-setup`](../reference/settings/commands.md#commandsbuild-setup)
are the settings a build in the cloud reads. This page says what each
does where it uses it.

## When something goes wrong

### A change to a workflow file

A session can't change a file under `.github/workflows/`: what is in one
runs with your repository's secrets. Publish pushes nothing then, whatever
else the session did, and comments on the ticket, or on the pull request
for any run but a build:

```text
Not pushed: commit 3c9f730 changes .github/workflows/ci.yml, which a build in the cloud can't push.
Build this ticket on your computer: tell a session to work it. The commits are in the run: https://your-code-host/your-name/your-repo/runs/123456789
```

On your computer that is `/lunamill-build 12` in a session. The run's page
keeps the commits for seven days, as the artifact whose
name starts with `out-`. Publish also refuses commits that add a symbolic
link or a submodule, merge anything but your default branch, are in another
person's name, or whose message closes another ticket, and a build that asks
for no pull request. Nothing else the session
asked for is done then but a stop.

## On your tools

- [GitHub Actions](../integrations/github-actions.md)
- [Claude Code](../integrations/claude-code.md)
- [GitHub](../integrations/github.md)
- [GitHub organizations](../integrations/github-organizations.md)
