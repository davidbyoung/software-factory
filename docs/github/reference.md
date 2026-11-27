# GitHub and Claude Code reference

Where each part of the factory lives when the code host is GitHub, the
tickets are GitHub Issues, the board is a GitHub Project, builds in the
cloud run in GitHub Actions, and the coding agent is Claude Code.
[Setting up on GitHub](setup.md) says how to turn each part on; this page
says what you will find once it is on.

## What setup adds

Everything the factory adds, and what
[removing it](../removing.md) does with each.

### In your repository

| What                                                                            | Added by                                                           | Removing it                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| `.claude/factory.yaml`, your settings                                           | Setup                                                              | Deletes it                                                     |
| `.claude/factory.lock`                                                          | Setup                                                              | Deletes it                                                     |
| `.claude/factory/`, the rules                                                   | Setup                                                              | Deletes it                                                     |
| `.claude/skills/factory-*/`                                                     | Setup                                                              | Deletes them                                                   |
| `.claude/agents/factory-*.md`                                                   | Setup                                                              | Deletes them                                                   |
| Six hook entries in `.claude/settings.json`                                     | Setup                                                              | Removes those six, keeps the rest, and deletes an emptied file |
| One folder under `permissions.additionalDirectories` in `.claude/settings.json` | Setup                                                              | Removes it, keeps the rest                                     |
| `attribution` in `.claude/settings.json`, when the file had none                | Setup                                                              | Leaves it: delete the key to get Claude Code's lines back      |
| One line in `CLAUDE.md`                                                         | Setup                                                              | Removes that line, and deletes an emptied file                 |
| `.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`      | Setup                                                              | Deletes them                                                   |
| `.github/factory-review.md`                                                     | Setup                                                              | Deletes it                                                     |
| `.github/review-notes.md`                                                       | You, if you wrote one. It is yours                                 | Leaves it                                                      |
| A small `package.json`, and `node_modules/` in `.gitignore`, if you had none    | Setup, only before a spec tool that npm installs, such as OpenSpec | Leaves them. Delete them if nothing else uses them             |

The "Removing it" column says what `factory remove` does with each.

Nothing of the factory's own is installed in the repository: no
`package.json` entry, no `package-lock.json`, and no `node_modules/`. The
`factory` command is installed once on each machine
([Which version runs](../cli.md#which-version-runs)).

### On GitHub

| What                                                                                                                                                                                                                     | Added when                                                                                                                                                                 | To undo                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Secrets and variables named `FACTORY_...`                                                                                                                                                                                | You create them                                                                                                                                                            | Delete them                                                                               |
| `CLAUDE_CODE_OAUTH_TOKEN`                                                                                                                                                                                                | You create it, for the automated review and builds in the cloud                                                                                                            | Delete it, unless another workflow uses it                                                |
| The secrets your `.npmrc` reads, such as `NPM_TOKEN`, for Actions and for Dependabot                                                                                                                                     | `init`, when you paste them                                                                                                                                                | Leave them if your own CI uses them; otherwise delete both copies                         |
| Labels: `merge-automatic`, `merge-manual`, `verdict-override`, `spec`, `factory`, or the names under [`tickets.labels`](../configuration.md#ticketslabels) and [`code-host.labels`](../configuration.md#code-hostlabels) | First use; `verdict-override`, the first time "Review verdict" is posted on a pull request with the review on                                                              | Delete them. Deleting a label removes it from every ticket                                |
| A CI check that the factory's files are in step                                                                                                                                                                          | Setup                                                                                                                                                                      | Goes with `factory-review.yml`                                                            |
| An Actions policy named "Software factory", on a public repository, which lets `factory.yml` start on `pull_request_target`                                                                                              | `init`, on a public repository; or you, [by hand](by-hand.md#a-public-repository)                                                                                          | Delete it, under Settings, Actions, Policies                                              |
| A "Review verdict" required check, as the ruleset "Software factory"                                                                                                                                                     | With the review on, the first workflow run after the setup's pull request merges; `init`, when your default branch already has `factory.yml`; or you, in your branch rules | Delete the ruleset, under Settings, Rules, **first**, or pull requests wait on it forever |
| Statuses on pull requests: "Who merges", "Review verdict"                                                                                                                                                                | Each pull request                                                                                                                                                          | They stay in history                                                                      |
| A ticket for each [follow-up](../workflow.md#follow-ups) ticked in a pull request                                                                                                                                        | The merge                                                                                                                                                                  |
| Comments on tickets the factory worked                                                                                                                                                                                   | Each refinement and build                                                                                                                                                  | They stay. They hold the ticket's history                                                 |

In an organization's repository, the organization's own rule requires
"Review verdict" in place of that ruleset, and the secrets are the
organization's ([In an organization](#in-an-organization)).

### In an organization

What [`factory init --org`](setup.md#set-an-organization-up-once) adds,
once, for every repository of the organization, here `acme`. No command takes these
out: [Removing it](../removing.md#taking-an-organizations-setup-out)
lists them in the order to delete them.

| What `factory init --org` adds                                                                                                                                          | Where to find it                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| The GitHub App "Software Factory for acme", registered by the organization and installed on the repositories its owner chose                                            | The organization's Settings, Developer settings, GitHub Apps                          |
| The secret `FACTORY_APP_PRIVATE_KEY`, the variable `FACTORY_APP_CLIENT_ID`, and the secret `CLAUDE_CODE_OAUTH_TOKEN`, or `ANTHROPIC_API_KEY`, each for every repository | The organization's Settings, Secrets and variables, Actions                           |
| The repository `acme/factory-config`, with `factory-preset.yaml`, `.github/workflows/factory-poller.yml`, and a `README.md`                                             | Among the organization's repositories                                                 |
| The property `software-factory`, with the values `on` and `off`, which the first workflow run after a repository's setup merges sets to `on` for it                     | The organization's Settings, Custom properties                                        |
| The rule "Software factory", which requires "Review verdict" before a merge to the default branch of each repository whose property is `on`                             | The organization's Settings, Rules. Not on GitHub's Free plan, which has no such rule |
| A board, or whichever of the factory's columns and fields the board the owner chose still lacked                                                                        | The organization's Projects                                                           |

### On your machine

| What                                                                                                         | Added when                                                                                                                  | To undo                                                                   |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| The `factory` command, and each version it downloads, in `~/.cache/software-factory/`                        | You install it, and a repository names a version                                                                            | `npm uninstall -g @davidbyoung/software-factory`, and delete the folder   |
| A GitHub access token and a Claude token, in `~/.config/software-factory/credentials.yaml`                   | `init`, on your own account, when you paste them ([Where your tokens are kept](../credentials.md#the-file-on-your-machine)) | Delete your account's entries from the file, which `factory remove` names |
| The presets you last followed for each account or organization, in `~/.config/software-factory/presets.yaml` | `init`, when you follow a preset                                                                                            | Delete the file                                                           |

### On your board

| What                                                                                                                                  | To undo                                      |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Up to six columns, if yours lacked them and `factory init` added them                                                                 | Delete the ones you do not want              |
| Three fields, Session, Runs in, and Cost, if yours lacked them and `init` added them. The sync also sets the board's own Status field | Delete the three                             |
| A Project `init` created, linked to the repository                                                                                    | Delete it, or keep it as an ordinary Project |

A board the factory created for you is an ordinary GitHub Project. Keep
it or delete it.

### Outside GitHub

Only if you host the poller
([`builds.trigger: own-server`](../configuration.md#builds)): **the
poller**, wherever you host it, with the `FACTORY_` variables you
gave it. Stop and delete it.

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

| Job                                | File that starts it                                | Starts on                                                                                                                                                                                             | Runs when                                                                                                                                                                 |
| ---------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Factory files in step              | `factory-review.yml`, and `factory.yml` for a push | Every pull request, and a push to the default branch                                                                                                                                                  | Always                                                                                                                                                                    |
| Review                             | `factory.yml`                                      | A pull request marked ready, each push after, and a change of its base branch                                                                                                                         | [`pr-review`](../configuration.md#pr-review) is on, and the pull request is from this repository. One of Dependabot's is reviewed only once someone else has pushed to it |
| Dependabot's auto-merge            | `factory.yml`                                      | Dependabot's pull requests                                                                                                                                                                            | `.github/dependabot.yml` exists                                                                                                                                           |
| The review's verdict               | `factory.yml`                                      | A pull request opened, pushed to, marked ready, or given another base branch, the `verdict-override` label, and a run in another repository that it [waits for](../across-repositories.md#merge-them) | Always                                                                                                                                                                    |
| Telling the other repositories     | `factory.yml`                                      | A pull request opened, reopened, or closed                                                                                                                                                            | Its text says it is part of a ticket, and it is from this repository                                                                                                      |
| Requiring the verdict              | `factory.yml`                                      | A push to the default branch                                                                                                                                                                          | `pr-review` is on                                                                                                                                                         |
| Who merges                         | `factory.yml`                                      | Pull request events                                                                                                                                                                                   | [`auto-merge.allow`](../configuration.md#auto-merge) is set                                                                                                               |
| The board sync                     | `factory.yml`                                      | The factory's commands, pull request events, and 07:00                                                                                                                                                | [`tickets.board`](../configuration.md#tickets) is set                                                                                                                     |
| Open the ticked tickets            | `factory.yml`                                      | A pull request from the repository merged, with a list of [follow-ups](../workflow.md#follow-ups)                                                                                                     |
| The poller                         | `factory.yml`                                      | Every [`builds.poll-minutes`](../configuration.md#builds) minutes, or by hand                                                                                                                         | `builds.trigger` is `github-action`, unless a [preset](../presets.md) you follow is in a repository that runs the poller, as an organization's `factory-config` does      |
| Build                              | `factory.yml`                                      | The poller, `factory build N`, or by hand                                                                                                                                                             | Always                                                                                                                                                                    |
| Answer                             | `factory.yml`                                      | A review you submit on a pull request, the run before it, or by hand                                                                                                                                  | The review is by someone who can write to the repository; or CI failed, or the automated review asked for changes, on a pull request a build in the cloud opened          |
| Finding the conflicts              | `factory.yml`                                      | A push to the default branch, 09:00, or by hand                                                                                                                                                       | Always. It starts one Conflict run for each pull request that conflicts with the default branch                                                                           |
| Conflict                           | `factory.yml`                                      | The job above, or by hand                                                                                                                                                                             | A pull request conflicts                                                                                                                                                  |
| Finding Dependabot's pull requests | `factory.yml`                                      | 01:00, 13:00, and 19:00, or by hand                                                                                                                                                                   | `.github/dependabot.yml` exists. It starts one Dependency run for each of Dependabot's open pull requests                                                                 |
| Dependency                         | `factory.yml`                                      | The job above, or by hand                                                                                                                                                                             | One of Dependabot's pull requests is open                                                                                                                                 |
| Updates                            | `factory.yml`                                      | 01:00, 13:00, and 19:00, or by hand                                                                                                                                                                   | Always                                                                                                                                                                    |

What the less obvious ones do:

- **Build, Review, Answer, Conflict, and Dependency** are the runs that use
  Claude Code. Each is three jobs, Prepare, Session, and Publish
  ([What a cloud run is](../builds.md#what-a-cloud-run-is)).
- **Factory files in step** fails when the factory's files differ from
  what your settings and the version your repository names would write,
  or when `factory config check` fails. On a pull request it also fails
  while `factory.yml` is disabled, since nothing then posts "Review
  verdict":

  ```text
  GitHub switched factory.yml off after 60 days with no activity, so nothing posts "Review verdict" here. Enable it on the Actions tab, or run: gh workflow enable factory.yml. Then push a commit to this pull request.
  ```

  It has no sign-in of yours, so it can't
  read a private [preset](../presets.md) whose pin a pull request moves,
  and passes it. The review's Prepare checks that pin, and fails before
  any session starts when it is wrong:

  ```text
  - acme/factory-config can't be read here without a sign-in: the review's run checks it.
  ```

- **Dependabot's auto-merge** lets one of Dependabot's pull requests
  merge itself once its checks pass, unless it is a major version or
  names the factory ([Dependency bots](#dependency-bots)).
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
  requests along, with the [`factory-deps`](../skills.md#factory-deps)
  skill.
- **Updates** opens a pull request for a newer release of the factory,
  and for a preset that changed ([Updating](../updating.md#what-happens)).
  It is a script, and runs no session.

In a pull request's list of checks, a job's name follows the name of the
file's calling job: `review / Factory files in step` from
`factory-review.yml`, and `factory / Review / Session` from `factory.yml`.
Most of `factory.yml`'s other jobs are in a group, and the group's name
comes next, as in `factory / Pull request / Record the verdict`. Each job
is listed here by the name its row shows:

| Group            | Its jobs                                                                                                                                                                                                                                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| None             | Review and Answer, each three jobs, and Approve what an approval policy found                                                                                                                                                                                                                             |
| `Pull request`   | Record the verdict, the [approval policies](../approval-policies.md)' Read the change for the approval policies, Run the approval policies' commands, Run an approval policy's agent, and Post the approval policies' status, Classify risk (Who merges), and Enable auto-merge (Dependabot's auto-merge) |
| `Tickets`        | Tell the other repositories, Sync the board, and Open the ticked tickets                                                                                                                                                                                                                                  |
| `Default branch` | Factory files in step, Require the verdict, Build, Find the conflicts, Conflict, Find the dependency pull requests, Dependency, Open the updates' pull requests, Start the Ready tickets, and Unknown job                                                                                                 |

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
[`builds.poll-minutes`](../configuration.md#builds) gives in the preset,
which reads the organization's board once and starts the builds of every
repository with a ticket in Ready
([The poller](../builds.md#the-poller)), and, at 01:00 and by hand, an
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
file](../builds.md#a-change-to-a-workflow-file)).

### With a part off

The two files are written whichever parts you chose, so a part that is
off shows as a skipped job, or as one that passes having done nothing.

- **The automated review is off** while `pr-review` is off. Each
  pull request then gets a passing "Review verdict" status that reads
  "The automated review is off", so a rule that requires the verdict
  never waits, and `factory pr state` and `factory pr watch` wait for no
  review ([Pull requests](../cli.md#pull-requests)).
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
[`commands.build-setup`](../configuration.md#commandsbuild-setup), and
installs bubblewrap, socat, and ripgrep, which Claude Code's sandbox needs,
and Claude Code. It takes Node's version from `package.json` when it sets
`engines.node`, and uses Node 22 otherwise.

A secret of your own, such as one your `.npmrc` reads
([Private npm packages](setup.md#private-npm-packages)), reaches the
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
[Where your tokens are kept](../credentials.md#on-github) says who
stores what.

**When the App's key reaches the run, it acts as the organization's App.**
That is every repository of an organization an owner has set up with
`factory init --org`, where the secret `FACTORY_APP_PRIVATE_KEY` and the
variable `FACTORY_APP_CLIENT_ID` both reach the run. Each job that needs
more than the workflow's own token makes a token from the App, for the run's
repository and the organization's [preset](../presets.md) repositories it
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
scopes [Secrets](by-hand.md#secrets) names. An organization's poller
posts no such comment for a repository its App is not installed on: its
run in `factory-config` shows a warning that names the repository, and
goes on to the next. A failed board sync arrives as an email from
GitHub.

## The board

A GitHub Project, owned by the account or the organization that owns the
repository. The sync sets its Status field to the ticket's column and
writes three fields of its own, which `init` adds when the board lacks
them:

| Field   | Shows                                                                    |
| ------- | ------------------------------------------------------------------------ |
| Status  | The column                                                               |
| Session | Which session is on the ticket, "actions, starting", or "Waiting on you" |
| Runs in | "local" or "Actions"                                                     |
| Cost    | An estimate of what refining and building the ticket used                |

Anything typed into the last three is overwritten on the next sync. Its
number, the last part of its address, is `tickets.board` in your settings.

## Labels and statuses

| Name               | Kind                     | Set by                                                                                                                                 |
| ------------------ | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `merge-automatic`  | Label on a pull request  | The merge policy, when every file is allowed                                                                                           |
| `merge-manual`     | Label on a pull request  | The merge policy, otherwise                                                                                                            |
| `verdict-override` | Label on a pull request  | Only a person: passes the review verdict for one commit. Sessions never add it                                                         |
| `spec`             | Label on a ticket        | Refinement, for a change your users will see, when [`specs: openspec`](../configuration.md#specs)                                      |
| `factory`          | Label on a ticket        | The factory, on [each ticket it works on](../workflow.md#which-tickets-are-the-factorys)                                               |
| Who merges         | Status on a pull request | The merge policy: which way it goes, and why                                                                                           |
| Automated review   | Status on a pull request | The review's Publish: what the review of that commit concluded, and the run's link. "Review verdict" goes by it                        |
| Review verdict     | Status on a pull request | The job that records the review's verdict: success when the review said ready, an approver overrode it, or the automated review is off |
| Merge order        | Status on a pull request | The same job, for a ticket across repositories: what the pull request waits for. "Review verdict" waits with it                        |

## Hooks

`sync` adds six hooks to `.claude/settings.json`. They run inside Claude
Code sessions in this repository on a machine, not in your own terminal, and
not in a session in the cloud, where no hook runs. Each runs the `factory`
command installed on the machine. On a machine without it, the hooks before
a shell command and before a file is read block the call, and they and the
hook at a session's start say how to install it ([Which version
runs](../cli.md#which-version-runs)).

| Hook                                                      | What it does                                                                                                                                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before a shell command                                    | Blocks a commit on your default branch, a push to it, and a force push. Runs your [`commands.before-commit`](../configuration.md#commandsbefore-commit) commands before a commit          |
| Before posting ticket text                                | Refuses text with a bare `<tag>`, which GitHub would silently drop                                                                                                                        |
| When a reviewer starts or stops                           | Records the run on the ticket, so its cost is counted                                                                                                                                     |
| Before an unattended build writes a file under `.claude/` | Approves the write, when the run is one the factory started and the file is not `.claude/settings.json` or `.claude/settings.local.json`                                                  |
| When a session starts                                     | Shows unfinished branches and where each ticket stands                                                                                                                                    |
| Before a file is read, searched, or listed                | Refuses a call that opens the factory's credentials file on your machine, which only the factory's commands read ([The file on your machine](../credentials.md#the-file-on-your-machine)) |

The fourth hook has nothing to approve while no hook runs in a session in
the cloud. A change under `.claude/` in any pull request still waits for
your merge, since no `auto-merge` rule allows it, and a session in the
cloud follows your default branch's copy of those files until then.

`sync` also sets `attribution` in `.claude/settings.json` to leave out
Claude Code's own "Co-Authored-By" and "Generated with" lines, so a
session's commits and pull requests carry only the person's name. It leaves an `attribution`
you set yourself alone.

## Skills in Claude Code

In Claude Code each skill is a slash command, such as `/factory-refine 12`.
[Skills](../skills.md#at-a-glance) lists every one with what it does.

**Where the files live.** `sync` writes the factory's skills to
`.claude/skills/factory-*/` and its agents to
`.claude/agents/factory-*.md`. Your own skills go in
`.claude/skills/NAME/SKILL.md` and your own agents in
`.claude/agents/NAME.md`, as for any Claude Code project. A plugin names
one under [`plugins`](../configuration.md#plugins) in
`.claude/factory.yaml`, with `skill:` for a folder in `.claude/skills/`
and `agent:` for a file in `.claude/agents/`. An agent's description is
the `description` in its file's front matter.

A colon, as in `/factory:refine`, is something Claude Code adds to a
skill that comes from a plugin. Plain skill files get plain names, so the
prefix `factory-` is part of the name. It also shows, in `.claude/skills/`,
which files an update will overwrite and which are yours. The package is
still laid out as a valid Claude Code plugin, so loading the skills from
it instead of copying them stays possible.

**Your project's instructions** are its `CLAUDE.md` files: the one at the
root, and any beside the code they govern. The skills read the rules for
each area from them. How to check a change is not there: it is
[`commands.gate`](../configuration.md#commandsgate) in your settings.
`sync` adds one line to the root `CLAUDE.md`, which loads the factory's
rules.

## Dependency bots

Dependabot does not update the factory, or a [preset](../presets.md).
Nothing of the factory's is in `package.json`, and the factory's own
update job opens those pull requests ([Updating](../updating.md)). So
`.github/dependabot.yml` needs no group for the factory. If yours has
one from an earlier version, delete it, with its name in any other
group's `exclude-patterns`.

If Dependabot updates your workflow files, have it leave the factory's
alone. The update job raises the version in the two workflow files
together with the files that version writes, and a pull request of
Dependabot's that raised the version alone would fail the "Factory files
in step" check:

```yaml
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    ignore:
      - dependency-name: "davidbyoung/software-factory*"
```

Dependabot's auto-merge job never turns auto-merge on for a pull request
that names the factory, so one that slips through waits for you whatever
its size.

## Limits

These come from GitHub, GitHub Actions, or Claude Code, not from the
factory.

- **GitHub's own runners stop any job at 6 hours.** The Session job is given
  its [`session-minutes`](../configuration.md#session-minutes) plus 10, so
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
  ([A public repository](setup.md#a-public-repository)). A private
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
  ([Limitations](../limitations.md#what-it-does-not-do)).
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
