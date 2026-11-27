# GitHub Actions

The cloud runner: the workflows that run the automated review, the board
sync, builds in the cloud, and the factory's other jobs.

## Workflows

`factory sync` writes two workflow files under `.github/workflows/`,
always, whichever parts are on:

| File                 | What the jobs it calls do                                                                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `factory.yml`        | Everything else: the runs that use Claude Code, and everything that is judged from your default branch's copy, so a pull request cannot change how it is judged                              |
| `factory-review.yml` | The check that the factory's files are in step, which has to read a pull request's own code. GitHub runs this file from the pull request's copy, so it is given no secret, and may only read |

Neither file holds those jobs. Each has one calling job, which calls a
workflow in the factory's own repository, `davidbyoung/software-factory`,
at the version your `.claude/factory.lock` names, so an update changes
one line of each. The jobs in the table below are the ones in the
factory's workflow that it calls. What `factory sync` writes into the
two files comes from your
settings: your default branch, which parts are on, the poller's
schedule, each session's minutes, and the names of your own secrets.

### The jobs

A job whose part is off is skipped, and starts no machine. Every time is
UTC.

| Job                                | File that starts it                                | Starts on                                                                                                                                                                                                      | Runs when                                                                                                                                                                                 |
| ---------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Factory files in step              | `factory-review.yml`, and `factory.yml` for a push | Every pull request, and a push to the default branch                                                                                                                                                           | Always                                                                                                                                                                                    |
| Review                             | `factory.yml`                                      | A pull request marked ready, each push after, and a change of its base branch                                                                                                                                  | [`pr-review`](../reference/settings/pr-review.md#pr-review) is set, and the pull request is from this repository. One of Dependabot's is reviewed only once someone else has pushed to it |
| Dependabot's auto-merge            | `factory.yml`                                      | Dependabot's pull requests                                                                                                                                                                                     | `.github/dependabot.yml` exists                                                                                                                                                           |
| The review's verdict               | `factory.yml`                                      | A pull request opened, pushed to, marked ready, or given another base branch, the `verdict-override` label, and a run in another repository that it [waits for](../workflow/across-repositories.md#merge-them) | Always                                                                                                                                                                                    |
| Telling the other repositories     | `factory.yml`                                      | A pull request opened, reopened, or closed                                                                                                                                                                     | Its text says it is part of a ticket, and it is from this repository                                                                                                                      |
| Requiring the verdict              | `factory.yml`                                      | A push to the default branch                                                                                                                                                                                   | `pr-review` is set                                                                                                                                                                        |
| Who merges                         | `factory.yml`                                      | Pull request events                                                                                                                                                                                            | [`auto-merge.allow`](../reference/settings/auto-merge.md#auto-merge) is set                                                                                                               |
| The board sync                     | `factory.yml`                                      | The factory's commands, pull request events, and 07:00                                                                                                                                                         | [`tickets.board`](../reference/settings/tickets.md#tickets) is set                                                                                                                        |
| Open the ticked tickets            | `factory.yml`                                      | A pull request from the repository merged, with a list of [follow-ups](../workflow/follow-ups.md)                                                                                                              |
| The poller                         | `factory.yml`                                      | Every [`builds.poll-minutes`](../reference/settings/builds.md#builds) minutes, or by hand                                                                                                                      | `builds.trigger` is `github-action`, unless a [preset](../customize/presets.md) you follow is in a repository that runs the poller, as an organization's `factory-config` does            |
| Build                              | `factory.yml`                                      | The poller, `factory build N`, or by hand                                                                                                                                                                      | Always                                                                                                                                                                                    |
| Answer                             | `factory.yml`                                      | A review you submit on a pull request, the run before it, or by hand                                                                                                                                           | The review is by someone who can write to the repository; or CI failed, or the automated review asked for changes, on a pull request a build in the cloud opened                          |
| Finding the conflicts              | `factory.yml`                                      | A push to the default branch, 09:00, or by hand                                                                                                                                                                | Always. It starts one Conflict run for each pull request that conflicts with the default branch                                                                                           |
| Conflict                           | `factory.yml`                                      | The job above, or by hand                                                                                                                                                                                      | A pull request conflicts                                                                                                                                                                  |
| Finding Dependabot's pull requests | `factory.yml`                                      | 01:00, 13:00, and 19:00, or by hand                                                                                                                                                                            | `.github/dependabot.yml` exists. It starts one Dependency run for each of Dependabot's open pull requests                                                                                 |
| Dependency                         | `factory.yml`                                      | The job above, or by hand                                                                                                                                                                                      | One of Dependabot's pull requests is open                                                                                                                                                 |
| Updates                            | `factory.yml`                                      | 01:00, 13:00, and 19:00, or by hand                                                                                                                                                                            | Always                                                                                                                                                                                    |

What the less obvious ones do:

- **Build, Review, Answer, Conflict, and Dependency** are the runs that use
  Claude Code. Each is three jobs, Prepare, Session, and Publish
  ([What a cloud run is](../security/cloud-runs.md#what-a-cloud-run-is)).
- **Factory files in step** fails when the factory's files differ from
  what your settings and the version your repository names would write,
  or when `factory config check` fails. On a pull request it also fails
  while `factory.yml` is disabled, since nothing then posts "Review
  verdict":

  ```text
  GitHub switched factory.yml off after 60 days with no activity, so nothing posts "Review verdict" here. Enable it on the Actions tab, or run: gh workflow enable factory.yml. Then push a commit to this pull request.
  ```

  It has no sign-in of yours, so it can't
  read a private [preset](../customize/presets.md) whose pin a pull request moves,
  and passes it. The review's Prepare checks that pin, and fails before
  any session starts when it is wrong:

  ```text
  - acme/factory-config can't be read here without a sign-in: the review's run checks it.
  ```

- **Dependabot's auto-merge** lets one of Dependabot's pull requests
  merge itself once its checks pass, unless it is a major version or
  names the factory ([Dependency bots](../features/dependency-updates.md#dependency-bots)).
- **The review's verdict** posts the "Review verdict" status, as the
  review's own Publish does when a review ends. It goes by the "Automated
  review" status that Publish set on the commit, and by no comment.
- **Open the ticked tickets** opens a ticket for each follow-up ticked in
  the pull request's description when it merged, and says which beside it.
  The board sync for that merge waits for it.
- **Requiring the verdict** runs `factory enroll`, which makes "Review
  verdict" required before a merge to your default branch, from the
  first push after the setup's pull request merges. A rule made before
  then would hold the setup's own pull request forever, since nothing
  judges it yet. In an organization it sets the repository's
  `software-factory` property to `on`, unless its value is already `on`,
  so the organization's rule covers it. On your own account it makes the
  repository's ruleset, with your build token. It prints the line for
  what it did, and nothing once the verdict is required, or where the
  plan has no branch rules for the repository, as in a private
  repository on GitHub's Free plan. It passes whatever it could do, and a line that
  starts with `?` says who does the rest by hand:

  ```text
  ✓ Set software-factory to "on" for acme/web, so acme's rule requires "Review verdict" here.
  ✓ Required "Review verdict" before a merge to main, as the rule "Software factory".
  ? "Review verdict" is not required before a merge to main, and this run's token cannot require it. An admin of sam/api runs: factory init
  ? Could not set software-factory to "on" for acme/web: 403 Resource not accessible by integration. An owner of acme sets it under the organization's Settings, Custom properties.
  ```

- **Who merges** labels a pull request `merge-automatic` or
  `merge-manual`, and turns auto-merge on for the first.
- **Dependency** runs a session that moves one of Dependabot's pull
  requests along, with the [`factory-deps`](../features/dependency-updates.md#factory-deps)
  skill.
- **Updates** opens a pull request for a newer release of the factory,
  and for a preset that changed ([Updating](../maintain/updating.md#what-happens)).
  It is a script, and runs no session.

In a pull request's list of checks, a job's name follows the name of the
file's calling job: `review / Factory files in step` from
`factory-review.yml`, and `factory / Review / Session` from `factory.yml`.
Most of `factory.yml`'s other jobs are in a group, and the group's name
comes next, as in `factory / Pull request / Record the verdict`. Each job
is listed here by the name its row shows:

| Group            | Its jobs                                                                                                                                                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| None             | Review and Answer, each three jobs, and Approve what an approval policy found                                                                                                                                                                                                                                      |
| `Pull request`   | Record the verdict, the [approval policies](../features/approval-policies.md)' Read the change for the approval policies, Run the approval policies' commands, Run an approval policy's agent, and Post the approval policies' status, Classify risk (Who merges), and Enable auto-merge (Dependabot's auto-merge) |
| `Tickets`        | Tell the other repositories, Sync the board, and Open the ticked tickets                                                                                                                                                                                                                                           |
| `Default branch` | Factory files in step, Require the verdict, Build, Find the conflicts, Conflict, Find the dependency pull requests, Dependency, Open the updates' pull requests, Start the Ready tickets, and Unknown job                                                                                                          |

A build's rows read `factory / Default branch / Build / Session`. A group
with nothing to do on an event shows as one skipped row with the group's
name, such as `factory / Tickets`, not a row for each of its jobs.

"Review verdict", "Automated review", "Approval policies", and "Who
merges" are statuses: a job posts each on the commit, under that name,
and the names do not change.

**An organization's poller is in a workflow file of its own, in one
repository.** `factory init --org` writes
`.github/workflows/factory-poller.yml` into the organization's
`factory-config` repository, beside its preset. Like the two files
above, it calls a workflow in the factory's own repository, `poller.yml`,
at the version it names. It has two jobs: the poller, on the schedule
[`builds.poll-minutes`](../reference/settings/builds.md#builds) gives in the preset,
which reads the organization's board once and starts the builds of every
repository with a ticket in Ready
([The poller](../features/builds-from-the-board.md#the-poller)), and, at 01:00 and by hand, an
update job that opens a pull request there when a newer release of the
factory is out. A repository that follows that preset gets no poller
schedule in its own `factory.yml`.

**Starting a job by hand.** The Actions tab, "Factory", "Run workflow".
For a build, type the ticket's key, such as `12`, and leave the job empty. The board's "Runs in" field then shows "Actions", and
"Session" the run's link. The Session job's log also shows each tool call
the session was denied. `answer`, `conflict`, and `dependency` take a pull
request's number, and `answer` a review's too, to answer that review. The
other jobs take `conflicts`, `dependencies`, `updates`, `board`, or
`poller` alone.

The poller starts a build on the repository's default branch, which a
poller you host reads once when it starts, and a scheduled pass on each
run. The run does no start check of its own: only someone with write
access can start a workflow.

A review you submit on a pull request that conflicts with the default
branch starts no run, since GitHub starts no workflow for a pull request it
cannot merge. A Conflict run clears the conflict. Then start the answer by
hand, with the pull request's and the review's numbers.

GitHub runs `factory.yml` as the pull request leaves it when you submit a
review, and as your default branch has it on every other event. A session
can't change that file ([A change to a workflow
file](../features/cloud-builds.md#a-change-to-a-workflow-file)).

### With a part off

The two files are written whichever parts you chose, so a part that is
off shows as a skipped job, or as one that passes having done nothing.

- **The automated review is off** while `pr-review` is not set. Each
  pull request then gets a passing "Review verdict" status that reads
  "The automated review is off", so a rule that requires the verdict
  never waits, and `factory pr state` and `factory pr watch` wait for no
  review ([Pull requests](../reference/cli-internal.md#pull-requests)).
- **Builds in the cloud are off** while the run has neither a build token
  nor the key of an organization's App. Prepare looks for work first, with
  the workflow's own token. Only then does it look for a build token and for
  Claude's credential. In an organization, the App's key counts as the build
  token, and a Review needs no build token. With work and no token, a run
  that a pull request or a review started says so and passes:

  ```text
  #31 waits for an answer, and no build token is set, so no session ran. Builds in the cloud are off: factory init turns them on.
  ```

  So do the jobs that find the conflicts and Dependabot's pull requests:

  ```text
  No build token is set, so no session starts.
  ```

  A run that a person or the poller started fails instead, since someone
  asked for it:

  ```text
  No build token: set the secret FACTORY_BUILD_TOKEN, or FACTORY_BOARD_TOKEN.
  ```

- **The update job with no build token** opens nothing, and passes:

  ```text
  No build token is set, so no update's pull request is opened. factory doctor shows when you are behind.
  ```

### What a job installs

Each job installs the version of the factory your repository names. The
Session job also installs your default branch's own dependencies, with
`npm ci`, only when its root has a `package-lock.json`, then runs your
[`commands.build-setup`](../reference/settings/commands.md#commandsbuild-setup), and
installs bubblewrap, socat, and ripgrep, which Claude Code's sandbox needs,
and Claude Code. It takes Node's version from `package.json` when it sets
`engines.node`, and uses Node 22 otherwise.

A secret of your own, such as one your `.npmrc` reads
([Private npm packages](private-npm.md#private-npm-packages)), reaches the
Session job through one line `factory sync` writes under `secrets` in
`factory.yml`, which passes each by name. The board sync, the poller, and
the job that opens the ticked tickets get it too.

### What each job can read and do

| Job                                                                 | Secrets it gets                                                                                                                  | What its workflow token may do                                                                                |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Prepare                                                             | The App's key, or the build token                                                                                                | Read the code, Actions, issues, pull requests, and statuses                                                   |
| Session                                                             | `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`, and your own secrets                                                           | Read packages                                                                                                 |
| Publish                                                             | The App's key, or the build token                                                                                                | Read the code, Actions, and checks; write issues, pull requests, and statuses, which is how it posts a review |
| Factory files in step, on a pull request                            | None                                                                                                                             | Read the code and Actions                                                                                     |
| The review's verdict                                                | The App's key, or the build token, to read with, when the pull request is part of a ticket                                       | Read the code and Actions; write issues, pull requests, and statuses                                          |
| Telling the other repositories                                      | The App's key, or the build token                                                                                                | Read the code and pull requests, and write issues                                                             |
| Updates                                                             | The App's key, or the build token and `FACTORY_SIGNING_KEY`                                                                      | Read the code                                                                                                 |
| The board sync                                                      | The App's key, or `FACTORY_BOARD_TOKEN` and the build token, and your own secrets                                                | Read the code and pull requests, and write issues                                                             |
| Who merges, and Dependabot's auto-merge                             | The App's key, or `FACTORY_AUTOMERGE_TOKEN`                                                                                      | Label and read pull requests, and post a status; Dependabot's, read only                                      |
| The poller, and finding the conflicts or Dependabot's pull requests | The App's key, or `FACTORY_BOARD_TOKEN` for the poller and the build token for the others. The poller also gets your own secrets | Read the code                                                                                                 |
| Open the ticked tickets                                             | Your own secrets                                                                                                                 | Read the code, and write issues and pull requests                                                             |
| Requiring the verdict                                               | The App's key, or the build token                                                                                                | Read the code                                                                                                 |

`FACTORY_SIGNING_KEY` reaches the updates' job alone. The updates' job is
also what the App's Workflows permission is for: a new version rewrites the
two workflow files. The tokens Prepare and Publish make from the App's key
do not carry it, and Publish refuses a session's change to one.

### Who a cloud session acts as

A cloud session acts as one of two things, by whether the key of an
organization's GitHub App reaches its run.
[Tokens and secrets](../security/credentials.md#on-github) says who
stores what.

**When the App's key reaches the run, it acts as the organization's App.**
That is every repository of an organization an owner has set up with
`factory init --org`, where the secret `FACTORY_APP_PRIVATE_KEY` and the
variable `FACTORY_APP_CLIENT_ID` both reach the run. Each job that needs
more than the workflow's own token makes a token from the App, for the run's
repository and the organization's [preset](../customize/presets.md) repositories it
follows, and uses it wherever a run on your own account uses the build,
board, or auto-merge token. Each job's token carries only the permissions
that job uses, and only the job that requires the verdict may set a
repository's `software-factory` property. The session itself has no token:
Prepare makes one before it, and Publish after it. A token lasts an hour,
and Publish may wait that long for CI, so it signs in again. A build's pull
request and comments are the App's. Its commits name Claude as their author
and the App's bot, such as `software-factory-for-acme[bot]`, as their
committer, and are not signed. The automated review's threads and the
"Review verdict" status are posted with the workflow's own token, so a build
cannot pass its own review. When the App is not installed on the repository,
Prepare fails with:

```text
The software factory's app for acme is not installed on acme/web. An owner of acme adds it: https://github.com/organizations/acme/settings/installations
```

**When no App's key reaches the run, it acts as the account that owns
its access token.** That is a repository on your own account, and an
organization's repository that the organization's secrets do not reach,
where someone stored a token by hand. The access token is
`FACTORY_BUILD_TOKEN`, or `FACTORY_BOARD_TOKEN` when that is not set.
The workflow's own token is never used for a build,
since GitHub starts no CI on a pull request that token opened. The updates
also need it to be allowed to push a change under `.github/workflows/` (the
`workflow` scope). When GitHub refuses a push, Publish says so, in GitHub's
words, on the ticket or the pull request.

**Who the commits of a build with an access token name.** Their author is
Claude, `Claude <noreply@anthropic.com>`, which GitHub links to its `claude`
user. Their committer is the token's owner, by the account's no-reply
address. They are not signed. A team that wants its builds to act as an
account of their own creates a GitHub account, gives it write access, and
stores that account's token as `FACTORY_BUILD_TOKEN`. The build's pull
requests, comments, and commits' committer are then that account's.

**Either way,** the agent's token is `CLAUDE_CODE_OAUTH_TOKEN`, or
`ANTHROPIC_API_KEY`; with both set, the first is used.
`FACTORY_BUILD_MODEL`, a repository variable, chooses the model. When a
pull request is squash merged, the commit on your default branch names
the person who opened it as its author, and GitHub adds a
`Co-authored-by: Claude` line for the build's commits.

When a build cannot start, the poller's comment on the ticket reads "Could
not start a build in GitHub Actions ... answered 403": give the token the
scopes [Secrets](../security/credentials.md#secrets) names. An organization's poller
posts no such comment for a repository its App is not installed on: its
run in `factory-config` shows a warning that names the repository, and
goes on to the next. A failed board sync arrives as an email from
GitHub.

## Limits

These come from GitHub, GitHub Actions, or Claude Code, not from the
factory.

- **GitHub's own runners stop any job at 6 hours.** The Session job is given
  its [`session-minutes`](../reference/settings/session-minutes.md#session-minutes) plus 10, so
  what the session left is still handed on; a value above 350 does nothing
  there. Prepare has 15 minutes, and Publish 75. A self-hosted runner allows
  longer. `sync` writes each `session-minutes` value you changed into
  `factory.yml`, as the session's limit.
- GitHub's shortest schedule is every five minutes, and scheduled runs can
  start late.
- **A pull request from a fork gets no secrets.** The "Factory files in
  step" check needs none, so it runs on one. No run that uses Claude Code
  starts on a fork's pull request, so its verdict waits for a person.
- **From December 2, 2026, GitHub blocks `pull_request_target` in a
  public repository** unless one of its Actions policies allows it, and
  `factory.yml` starts on that event. `factory init` adds the policy
  ([A public repository](github.md#a-public-repository)). A private
  repository needs nothing.
- Public repositories are not billed for Actions minutes.
- **GitHub switches off a workflow with a schedule in a public
  repository with no activity for 60 days.** `factory.yml` has
  schedules, so every job it starts stops with it, the review's verdict
  among them. "Factory files in step" still runs on a pull request, and
  fails, saying how to enable the file. `factory doctor` fails too. GitHub
  does not run what it missed, so after you enable the file, push a commit
  to each pull request that has no verdict.
- GitHub limits how many jobs an account runs at the same time.
- **A workflow's trigger cannot ask for the default branch's name,** so
  `factory sync` writes the name into the push trigger of `factory.yml`.
  After you rename the default branch, `factory sync --check` fails until
  you run `factory sync` again, and until then the conflict sweep runs
  nightly and by hand, not on a push.
- **A workflow in another owner's repository takes a secret only by a
  name it declares,** which is why your own secrets reach the factory's
  jobs through one line of `factory.yml`, not a line for each job.
- **Every review event costs a minute of Actions,** including the
  factory's own replies, which start a Prepare that finds nothing to do.
- **A run's artifacts are kept on GitHub:** one day for what Prepare handed
  over, and seven for what the session left. Anyone signed in to GitHub can
  download them from a public repository
  ([Limitations](../about/limitations.md#what-it-does-not-do)).
- **The squash merge on your default branch is signed by GitHub,** whether
  or not the build's own commits were.
- **Only part of the factory works inside a session Claude hosts,** such
  as Claude Code on the web. Such a session is a machine of its own, so
  put the install line, `npm install -g @davidbyoung/software-factory`,
  in its environment's setup: without the command, the factory's hooks
  stop the session's commands. With it, the hooks run, and the commands
  that read only the repository work, such as `factory sync`,
  `factory config check`, and `factory gate`. The commands that need
  GitHub's GraphQL API, which is closed there, still do not: the board
  commands, `factory status`, and the ticket commands.
  `factory build N` works, since it only asks GitHub to start a
  workflow.
- **Untested against a real organization: the board sync on a board one
  owns.** It is read the same way as a person's, with the token made from the
  organization's App, whose permissions include the organization's
  Projects. A classic token stored by hand needs access to the
  organization's projects, which an organization's settings can refuse.
- **Untested: GitHub's built-in board automations,** such as moving a
  closed issue to Done. They may fight the board sync.

## By hand

The steps `factory init` takes for the review and for builds in the cloud, done without it.

### The automated review

Claude reads every pull request once it is marked ready, and gives its
findings and a verdict, which a job with no AI posts. A session answers
each comment, fixing it or rejecting it with evidence.

It is on while `.claude/factory.yaml` has
[`pr-review`](../reference/settings/pr-review.md#pr-review). Two files have a part in it,
and `sync` writes both:

| File                            | What it is                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `.github/workflows/factory.yml` | The workflow file whose review run reads each pull request and records the verdict, as the "Review verdict" status |
| `.github/factory-review.md`     | The review's instructions                                                                                          |

The review posts its comments as `github-actions`, with the workflow's
own token.

1. **Store your Claude token** as `CLAUDE_CODE_OAUTH_TOKEN`
   ([Secrets](../security/credentials.md#secrets)).
2. **Write `pr-review` in `.claude/factory.yaml`,** and run
   `factory sync`, which turns the review's run on:

   ```yaml
   pr-review: {}
   ```

   The reviewer may run the pull request's own code to confirm a finding,
   confined to [the session's sandbox](../security/cloud-runs.md#what-a-cloud-run-is).
   The review's job installs your default branch's dependencies with
   `npm ci` when its root has a `package-lock.json`, and chooses the model
   from `FACTORY_BUILD_MODEL` ([Variables](#who-a-cloud-session-acts-as)) when
   it is set.

3. **Optionally, write `.github/review-notes.md`:** what a reviewer must
   know about your project that your `CLAUDE.md` does not say. The
   reviewer reads it when it exists.
4. **To make the verdict count,** add "Review verdict" to the required
   status checks of your default branch: Settings, then Rules or Branches.
   With a build token stored, a push to your default branch does this for
   you. Until it is required, it is information only.

**It worked when** a pull request you mark ready gets Claude's comments
and a "Review verdict" status in its checks.

### Builds in the cloud

`factory build 12` builds ticket 12 in GitHub Actions and
prints the run's link, with no session open on your machine.

`sync` already wrote `factory.yml`, whose runs these are. Each does
nothing until it has work and its secrets
([With a part off](#with-a-part-off)). Each is
[three jobs](../security/cloud-runs.md#what-a-cloud-run-is), and the one that runs
Claude Code is given no GitHub token:

| Run        | What its Claude Code session does                                                            |
| ---------- | -------------------------------------------------------------------------------------------- |
| Build      | Builds a ticket                                                                              |
| Answer     | Answers a pull request's failed CI, its automated review, or a review you submit             |
| Conflict   | Resolves a conflict between a pull request and your default branch                           |
| Dependency | Moves one of Dependabot's pull requests along. It is on once `.github/dependabot.yml` exists |

One more job needs the same GitHub token and runs no session: the update
job, which opens a pull request for each new release of the factory
([Updating](../maintain/updating.md#what-happens)).

1. **Store your Claude token** as `CLAUDE_CODE_OAUTH_TOKEN`.
2. **Store a GitHub token that can push**, as `FACTORY_BUILD_TOKEN`. With
   a board, `FACTORY_BOARD_TOKEN` stands in for it when it has the
   `workflow` scope, so one token does both ([Secrets](../security/credentials.md#secrets)).

**It worked when** `factory build 12`, with the number of a refined
ticket, prints a run's link, and the run opens a pull request.

A build may run for 230 minutes, which
[`session-minutes`](../reference/settings/session-minutes.md#session-minutes) changes; GitHub
stops any job at six hours.

#### Starting builds from the board

To have a ticket build when you move its card to Ready on
[a board](github-projects.md#a-board), a small program, the poller, watches the board and
starts each build. Set
[`builds.trigger: github-action`](../reference/settings/builds.md#builds) to run it on
a schedule in GitHub Actions, with nothing to host, or `own-server` to
host it yourself.
[Builds in the cloud](../features/cloud-builds.md) explains each and what it costs. In
an organization that is set up, there is nothing to set here: the
organization's [preset](../customize/presets.md) sets `builds.trigger`, and the
one schedule is in the organization's `factory-config` repository.
