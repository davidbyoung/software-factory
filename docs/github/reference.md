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

| What                                                                         | Added by                                                           | Removing it                                                    |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| `.claude/factory.yaml`, your settings                                        | Setup                                                              | Deletes it                                                     |
| `.claude/factory.lock`                                                       | Setup                                                              | Deletes it                                                     |
| `.claude/factory/`, the rules                                                | Setup                                                              | Deletes it                                                     |
| `.claude/skills/factory-*/`                                                  | Setup                                                              | Deletes them                                                   |
| `.claude/agents/factory-*.md`                                                | Setup                                                              | Deletes them                                                   |
| Six hook entries in `.claude/settings.json`                                  | Setup                                                              | Removes those six, keeps the rest, and deletes an emptied file |
| `attribution` in `.claude/settings.json`, when the file had none             | Setup                                                              | Leaves it: delete the key to get Claude Code's lines back      |
| One line in `CLAUDE.md`                                                      | Setup                                                              | Removes that line, and deletes an emptied file                 |
| `.github/workflows/factory.yml` and `.github/workflows/factory-review.yml`   | Setup                                                              | Deletes them                                                   |
| `.github/factory-review.md`                                                  | Setup                                                              | Deletes it                                                     |
| `.github/review-notes.md`                                                    | You, if you wrote one. It is yours                                 | Leaves it                                                      |
| A small `package.json`, and `node_modules/` in `.gitignore`, if you had none | Setup, only before a spec tool that npm installs, such as OpenSpec | Leaves them. Delete them if nothing else uses them             |

The "Removing it" column says what `factory remove` does with each.

Nothing of the factory's own is installed in the repository: no
`package.json` entry, no `package-lock.json`, and no `node_modules/`. The
`factory` command is installed once on each machine
([Which version runs](../cli.md#which-version-runs)).

### On GitHub

| What                                                                                                                                                                                                                       | Added when                                                                                                                                                                 | To undo                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Secrets and variables named `FACTORY_...`                                                                                                                                                                                  | You create them                                                                                                                                                            | Delete them                                                                               |
| `CLAUDE_CODE_OAUTH_TOKEN`                                                                                                                                                                                                  | You create it, for the automated review and builds in the cloud                                                                                                            | Delete it, unless another workflow uses it                                                |
| The secrets your `.npmrc` reads, such as `NPM_TOKEN`, for Actions and for Dependabot                                                                                                                                       | `init`, when you paste them                                                                                                                                                | Leave them if your own CI uses them; otherwise delete both copies                         |
| Labels: `merge-automatic`, `merge-manual`, `verdict-override`, `follow-up`, `spec`, or the names under [`tickets.labels`](../configuration.md#ticketslabels) and [`code-host.labels`](../configuration.md#code-hostlabels) | First use                                                                                                                                                                  | Delete them. Deleting a label removes it from every ticket                                |
| A CI check that the factory's files are in step                                                                                                                                                                            | Setup                                                                                                                                                                      | Goes with `factory-review.yml`                                                            |
| An Actions policy named "Software factory", on a public repository, which lets `factory.yml` start on `pull_request_target`                                                                                                | `init`, on a public repository; or you, [by hand](by-hand.md#a-public-repository)                                                                                          | Delete it, under Settings, Actions, Policies                                              |
| A "Review verdict" required check, as the ruleset "Software factory"                                                                                                                                                       | With the review on, the first workflow run after the setup's pull request merges; `init`, when your default branch already has `factory.yml`; or you, in your branch rules | Delete the ruleset, under Settings, Rules, **first**, or pull requests wait on it forever |
| Statuses on pull requests: "Who merges", "Review verdict"                                                                                                                                                                  | Each pull request                                                                                                                                                          | They stay in history                                                                      |
| One open ticket titled "Follow-ups"                                                                                                                                                                                        | The first follow-up                                                                                                                                                        | Close it                                                                                  |
| Comments on tickets the factory worked                                                                                                                                                                                     | Each refinement and build                                                                                                                                                  | They stay. They hold the ticket's history                                                 |

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
| A board, or the factory's columns and fields on the board the owner chose                                                                                               | The organization's Projects                                                           |

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
poller**, wherever you host it, with the four `FACTORY_` variables you
gave it. Stop and delete it.

## Workflows

`factory sync` writes two workflow files under `.github/workflows/`,
always, whichever parts are on:

| File                 | What the jobs it calls do                                                                                                                     |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `factory.yml`        | Everything that is judged from your default branch's copy, so a pull request cannot change how it is judged                                   |
| `factory-review.yml` | What has to read a pull request's own code: the check that the factory's files are in step, the automated review, and Dependabot's auto-merge |

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

| Job                        | File that starts it                                | Starts on                                                                     | Runs when                                                                                                                                                            |
| -------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Factory files in step      | `factory-review.yml`, and `factory.yml` for a push | Every pull request, and a push to the default branch                          | Always                                                                                                                                                               |
| The automated review       | `factory-review.yml`                               | A pull request marked ready, and each push after                              | [`pr-review`](../configuration.md#pr-review) is set                                                                                                                  |
| Dependabot's auto-merge    | `factory-review.yml`                               | Dependabot's pull requests                                                    | `.github/dependabot.yml` exists                                                                                                                                      |
| The review's verdict       | `factory.yml`                                      | Pull request events, and each automated review                                | Always                                                                                                                                                               |
| Requiring the verdict      | `factory.yml`                                      | A push to the default branch                                                  | `pr-review` is set                                                                                                                                                   |
| Who merges                 | `factory.yml`                                      | Pull request events                                                           | [`auto-merge.allow`](../configuration.md#auto-merge) is set                                                                                                          |
| The board sync             | `factory.yml`                                      | The factory's commands, pull request events, and 07:00                        | [`tickets.board`](../configuration.md#tickets) is set                                                                                                                |
| The poller                 | `factory.yml`                                      | Every [`builds.poll-minutes`](../configuration.md#builds) minutes, or by hand | `builds.trigger` is `github-action`, unless a [preset](../presets.md) you follow is in a repository that runs the poller, as an organization's `factory-config` does |
| A build                    | `factory.yml`                                      | The poller, `factory build N`, or by hand                                     | Always                                                                                                                                                               |
| Answering your review      | `factory.yml`                                      | A review you submit on a pull request, or by hand                             | The review is by someone who can write to the repository                                                                                                             |
| The conflict sweep         | `factory.yml`                                      | A push to the default branch, 09:00, or by hand                               | A pull request conflicts with the default branch                                                                                                                     |
| Dependabot's pull requests | `factory.yml`                                      | 01:00, 13:00, and 19:00, or by hand                                           | `.github/dependabot.yml` exists, and one of its pull requests is open                                                                                                |
| Updates                    | `factory.yml`                                      | 01:00, 13:00, and 19:00, or by hand                                           | Always                                                                                                                                                               |

What the less obvious ones do:

- **Factory files in step** fails when the factory's files differ from
  what your settings and the version your repository names would write,
  or when `factory config check` fails.
- **Dependabot's auto-merge** lets one of Dependabot's pull requests
  merge itself once its checks pass, unless it is a major version or
  names the factory ([Dependency bots](#dependency-bots)).
- **The review's verdict** posts the "Review verdict" status from the
  automated review's summary.
- **Requiring the verdict** runs `factory enroll`, which makes "Review
  verdict" required before a merge to your default branch, from the
  first push after the setup's pull request merges. A rule made before
  then would hold the setup's own pull request forever, since nothing
  judges it yet. In an organization it sets the repository's
  `software-factory` property to `on`, so the organization's rule covers
  it. On your own account it makes the repository's ruleset, with your
  build token. It prints the line for what it did, and nothing once the
  verdict is required. It passes whatever it could do, and a line that
  starts with `?` says who does the rest by hand:

  ```text
  ✓ Set software-factory to "on" for acme/web, so acme's rule requires "Review verdict" here.
  ✓ Required "Review verdict" before a merge to main, as the rule "Software factory".
  ? "Review verdict" is not required before a merge to main, and this run's token cannot require it. An admin of sam/api runs: factory init
  ? Could not set software-factory to "on" for acme/web: 403 Resource not accessible by integration. An owner of acme sets it under the organization's Settings, Custom properties.
  ```

- **Who merges** labels a pull request `merge-automatic` or
  `merge-manual`, and turns auto-merge on for the first.
- **Dependabot's pull requests** runs a session that moves each one
  along, with the [`factory-deps`](../skills.md#factory-deps) skill.
- **Updates** opens a pull request for a newer release of the factory,
  and for a preset that changed ([Updating](../updating.md#what-happens)).
  It is a script, and runs no session.

In a pull request's list of checks, a job's name follows the name of the
file's calling job: `review / Factory files in step` and
`review / Claude review` from `factory-review.yml`, and
`factory / Record the verdict` from `factory.yml`. "Review verdict" and
"Who merges" are statuses, and keep those names.

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
For a build, type `build` as the job and the ticket's key, such as `12`,
or the key alone. The board's "Runs in" field then shows "Actions", and
"Session" the run's link. The run's log also shows each tool call the
session was denied, with the reason. The other jobs take `conflicts`,
`dependencies`, `updates`, `board`, or `poller` as the job, and `review`
with a pull request's and a review's numbers.

The poller starts a build on the repository's default branch, which a
poller you host reads once when it starts, and a scheduled pass on each
run. The run does no start check of its own: only someone with write
access can start a workflow.

A review on a pull request that conflicts with the default branch starts
no run, since GitHub starts no workflow for a pull request it cannot
merge. The conflict sweep clears the conflict and works the review in the
same run, and the answer can be started by hand with the pull request's
and the review's numbers.

### With a part off

The two files are written whichever parts you chose, so a part that is
off shows as a skipped job, or as one that passes having done nothing.

- **The automated review is off** while `pr-review` is not set. Each
  pull request then gets a passing "Review verdict" status that reads
  "The automated review is off", so a rule that requires the verdict
  never waits, and `factory pr state` and `factory pr watch` wait for no
  review ([Pull requests](../cli.md#pull-requests)).
- **Builds in the cloud are off** while the run has neither a build
  token nor the key of an organization's App. A job that would run a
  session looks for work first, with the workflow's own token. Only then
  does it look for a build token and for Claude's credential. In an
  organization, the App's key counts as the build token. With
  work and no token, a run that a push, a schedule, or a review started
  says so and passes:

  ```text
  2 pull requests conflict, and no build token is set, so no session ran. Builds in the cloud are off: factory init turns them on.
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

Each job installs the version of the factory your repository names. A
job that runs a session, and the automated review, also install your
repository's own dependencies, with `npm ci`, only when its root has a
`package-lock.json`. They take Node's version from `package.json` when
it sets `engines.node`, and use Node 22 otherwise. A session job then
runs your [`commands.build-setup`](../configuration.md#commandsbuild-setup).

A secret of your own, such as one your `.npmrc` reads
([Private npm packages](setup.md#private-npm-packages)), reaches those
jobs through one line `factory sync` writes under `secrets` in the two
files, which passes each by name.

### Who a cloud session acts as

A cloud session acts as one of two things, by whether the key of an
organization's GitHub App reaches its run.
[Where your tokens are kept](../credentials.md#on-github) says who
stores what.

**When the App's key reaches the run, it acts as the organization's
App.** That is every repository of an organization an owner has set up
with `factory init --org`, where the secret `FACTORY_APP_PRIVATE_KEY`
and the variable `FACTORY_APP_CLIENT_ID` both reach the run. Each job
that needs more than the workflow's own token makes a token from the
App, for the run's repository and the organization's
[preset](../presets.md) repositories it follows, and uses it wherever a
run on your own account uses the build, board, or auto-merge token. A token lasts an hour and a build may run longer, so a
session's job signs the GitHub CLI and git in with one and makes a new
one every 45 minutes, and one process of that job holds the App's key
for as long as the job runs. A build's pull request and comments are the
App's. Its commits name Claude as their author and the App's bot, such
as `software-factory-for-acme[bot]`, as their committer, and are not
signed, whatever `FACTORY_SIGNING_KEY` holds. The automated review and
the "Review verdict" status keep the workflow's own token, so a build
cannot pass its own review. When the App is not installed on the
repository, the run fails with:

```text
The software factory's app for acme is not installed on acme/web. An owner of acme adds it: https://github.com/organizations/acme/settings/installations
```

**When no App's key reaches the run, it acts as the account that owns
its access token.** That is a repository on your own account, and an
organization's repository that the organization's secrets do not reach,
where someone stored a token by hand. The access token is
`FACTORY_BUILD_TOKEN`, or `FACTORY_BOARD_TOKEN` when that is not set.
The workflow's own token is never used for a build,
since GitHub starts no CI on a pull request that token opened. The token
must be allowed to push a change under `.github/workflows/` (the
`workflow` scope), or such a push is refused and the build stops there.

**Who the commits of a build with an access token name.** Their author
is Claude,
`Claude <noreply@anthropic.com>`, which GitHub links to its `claude` user.
Their committer is the token's owner, by the account's no-reply address,
which is what lets that account's signing key show them as verified. A
team that wants its builds to act as an account of their own creates a
GitHub account, gives it write access, and stores that account's token as
`FACTORY_BUILD_TOKEN`. The build's pull requests, comments, and commits'
committer are then that account's.

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
| `follow-up`        | Label on a ticket        | The first follow-up line, on the one follow-ups ticket                                                                                 |
| `spec`             | Label on a ticket        | Refinement, for a change your users will see, when [`specs: openspec`](../configuration.md#specs)                                      |
| Who merges         | Status on a pull request | The merge policy: which way it goes, and why                                                                                           |
| Review verdict     | Status on a pull request | The job that records the review's verdict: success when the review said ready, an approver overrode it, or the automated review is off |

## Hooks

`sync` adds six hooks to `.claude/settings.json`. They run inside Claude
Code sessions in this repository, not in your own terminal. Each runs
the `factory` command installed on the machine. On a machine without
it, the hooks before a shell command and before a file is read block
the call, and they and the hook at a session's start say how to install
it
([Which version runs](../cli.md#which-version-runs)).

| Hook                                                      | What it does                                                                                                                                                                              |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before a shell command                                    | Blocks a commit on your default branch, a push to it, and a force push. Runs your [`commands.before-commit`](../configuration.md#commandsbefore-commit) commands before a commit          |
| Before posting ticket text                                | Refuses text with a bare `<tag>`, which GitHub would silently drop                                                                                                                        |
| When a reviewer starts or stops                           | Records the run on the ticket, so its cost is counted                                                                                                                                     |
| Before an unattended build writes a file under `.claude/` | Approves the write, when the run is one the factory started and the file is not `.claude/settings.json` or `.claude/settings.local.json`                                                  |
| When a session starts                                     | Shows unfinished branches and where each ticket stands                                                                                                                                    |
| Before a file is read, searched, or listed                | Refuses a call that opens the factory's credentials file on your machine, which only the factory's commands read ([The file on your machine](../credentials.md#the-file-on-your-machine)) |

Claude Code protects `.claude/`, and an unattended run denies a write
there that nothing approves. The fourth hook approves, only in a run the
factory's session job started, a write to the repository's own files under
`.claude/`: its skills, its agents, `.claude/factory.yaml`, and
`.claude/change-types.md`. It never approves a write to the two settings
files, which hold the hooks that guard the run. A session a person starts
is asked as before. A change under `.claude/` still waits for your merge,
since no `auto-merge` rule allows it.

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

- **GitHub's own runners stop any job at 6 hours.** A cloud session's job
  is given its [`session-minutes`](../configuration.md#session-minutes)
  plus 10, so the step that releases the claim still runs; a value above
  350 does nothing there. A self-hosted runner allows longer. `sync`
  writes each `session-minutes` value you changed into `factory.yml`, as
  the session's limit.
- GitHub's shortest schedule is every five minutes, and scheduled runs can
  start late.
- **A pull request from a fork gets no secrets.** The "Factory files in
  step" check needs none, so it runs on one, unless the pull request
  moves the pin of a private [preset](../presets.md#who-can-read-a-preset),
  which the check cannot then read. The automated review skips a fork's
  pull request.
- **From December 2, 2026, GitHub blocks `pull_request_target` in a
  public repository** unless one of its Actions policies allows it, and
  `factory.yml` starts on that event. `factory init` adds the policy
  ([A public repository](setup.md#a-public-repository)). A private
  repository needs nothing.
- Public repositories are not billed for Actions minutes.
- **GitHub switches off a workflow with a schedule in a public
  repository with no activity for 60 days.** `factory.yml` has
  schedules, so every job it starts stops with it, the review's verdict
  among them, until you enable it again: on the Actions tab, or with
  `gh workflow enable factory.yml`.
- GitHub limits how many jobs an account runs at the same time.
- **A workflow's trigger cannot ask for the default branch's name,** so
  `factory sync` writes the name into the push trigger of `factory.yml`.
  After you rename the default branch, `factory sync --check` fails until
  you run `factory sync` again, and until then the conflict sweep runs
  nightly and by hand, not on a push.
- **A workflow in another owner's repository takes a secret only by a
  name it declares,** which is why your own secrets reach the factory's
  jobs through one line of the two files, not a line for each job.
- **Every review event costs a minute of Actions,** including the
  factory's own replies, which start runs that find nothing to do.
- **The squash merge on your default branch is signed by GitHub,** whether
  or not the build's own commits were.
- **Only part of the factory works inside a Claude cloud session,** such
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
- **Untested against a real organization: a board one owns.** It is read
  the same way as a person's, with the token made from the
  organization's App, whose permissions include the organization's
  Projects. A classic token stored by hand needs access to the
  organization's projects, which an organization's settings can refuse.
- **Untested: GitHub's built-in board automations,** such as moving a
  closed issue to Done. They may fight the board sync.
