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

| What                                                                                 | Added by                           | Removing it                                                     |
| ------------------------------------------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------- |
| `.claude/factory.yaml`, your settings                                                | Setup                              | Deletes it                                                      |
| `.claude/factory.lock`                                                               | Setup                              | Deletes it                                                      |
| `.claude/factory/`, the rules                                                        | Setup                              | Deletes it                                                      |
| `.claude/skills/factory-*/`                                                          | Setup                              | Deletes them                                                    |
| `.claude/agents/factory-*.md`                                                        | Setup                              | Deletes them                                                    |
| Five hook entries in `.claude/settings.json`                                         | Setup                              | Removes those five, keeps the rest                              |
| `attribution` in `.claude/settings.json`, when the file had none                     | Setup                              | Leaves it: delete the key to get Claude Code's lines back       |
| One line in `CLAUDE.md`                                                              | Setup                              | Removes that line                                               |
| `.github/workflows/factory-check.yml`                                                | Setup                              | Deletes them                                                    |
| Other `.github/workflows/factory-*.yml`                                              | Setup, and each part you turned on | Deletes them                                                    |
| `.github/factory-review.md`                                                          | The automated review               | Deletes it                                                      |
| `.github/review-notes.md`                                                            | You, if you wrote one. It is yours | Leaves it                                                       |
| The `@davidbyoung/software-factory` entry in `package.json`, and `package-lock.json` | `npm install`                      | Left for `npm uninstall`                                        |
| `package.json` itself, if you had none                                               | Setup                              | Leaves it. Delete it and its lockfile if nothing else uses them |
| `node_modules/` in `.gitignore`                                                      | Setup, if it was missing           | Leaves it. Remove the line if you deleted `package.json`        |

The "Removing it" column says what `factory remove`
(_[Planned](../developing.md#what-is-built)_) does with each; until it is
built, do the same by hand.

### On GitHub

| What                                                                                  | Added when                                                      | To undo                                                                 |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Secrets and variables named `FACTORY_...`                                             | You create them                                                 | Delete them                                                             |
| `CLAUDE_CODE_OAUTH_TOKEN`                                                             | You create it, for the automated review and builds in the cloud | Delete it, unless another workflow uses it                              |
| Labels: `merge: automatic`, `merge: manual`, `verdict: override`, `follow-up`, `spec` | First use                                                       | Delete them. Deleting a label removes it from every ticket              |
| A CI check that the factory's files are in step                                       | Setup                                                           | Goes with `factory-check.yml`                                           |
| A "Review verdict" required check                                                     | You add it to your branch rules                                 | Remove it from the rules **first**, or pull requests wait on it forever |
| Statuses on pull requests: "Who merges", "Review verdict"                             | Each pull request                                               | They stay in history                                                    |
| One open ticket titled "Follow-ups"                                                   | The first follow-up                                             | Close it                                                                |
| Comments on tickets the factory worked                                                | Each refinement and build                                       | They stay. They hold the ticket's history                               |

### On your board

| What                                                                                                                                  | To undo                                      |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Up to six columns, if yours lacked them and `factory init` added them                                                                 | Delete the ones you do not want              |
| Three fields, Session, Runs in, and Cost, if yours lacked them and `init` added them. The sync also sets the board's own Status field | Delete the three                             |
| A Project `init` created, linked to the repository                                                                                    | Delete it, or keep it as an ordinary Project |
| The "Software factory" ruleset, requiring "Review verdict"                                                                            | Delete the ruleset, under Settings, Rules    |

A board the factory created for you is an ordinary GitHub Project. Keep
it or delete it.

### Outside GitHub

Only if you turned on builds that start from the board: **the poller**,
wherever you host it, with the four `FACTORY_` variables you gave it. Stop
and delete it.

## Workflows

`factory sync` writes these under `.github/workflows/`.
Each one that runs a Claude Code session first checks whether there is
anything to do, and stops there when there is not.

| Workflow                      | Starts on                                                       | What it does                                                                                                                                |
| ----------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `factory-check.yml`           | Every pull request                                              | Fails when the factory's files differ from what your settings and version would write                                                       |
| `factory-build.yml`           | The poller, `factory build N`, or by hand                       | Runs a session that builds the ticket                                                                                                       |
| `factory-review.yml`          | A review you submit on a pull request                           | Runs a session that answers it, when `factory pr review-pending N REVIEW` exits 0                                                           |
| `factory-conflicts.yml`       | A push to the default branch, nightly at 09:00 UTC, or by hand  | Runs the conflict sweep, when `factory pr conflicts` exits 0                                                                                |
| `factory-deps.yml`            | 01:00, 13:00, and 19:00 UTC, or by hand                         | Runs a session that moves Dependabot's pull requests along, when `factory deps --any` exits 0. Written once `.github/dependabot.yml` exists |
| `factory-deps-auto-merge.yml` | Dependabot's pull requests                                      | Lets one merge itself when your `auto-merge` settings allow its files. Written once `.github/dependabot.yml` exists                         |
| `factory-board-sync.yml`      | Ticket and pull request events, and nightly                     | Sets the board's columns and fields from the tickets' marker comments. Written once `tickets.board` is set                                  |
| `factory-merge-policy.yml`    | Every pull request                                              | Labels it `merge: automatic` or `merge: manual`, and turns auto-merge on for the first. Written once `auto-merge.allow` is set              |
| `factory-review-verdict.yml`  | Each automated review                                           | Posts the "Review verdict" status from the review's summary                                                                                 |
| `factory-claude-review.yml`   | Every pull request once it is marked ready, and each push after | Runs the automated review. Written once `ci-review` is set                                                                                  |

**Starting a build by hand.** The Actions tab, "Factory build", "Run
workflow", and the ticket's number. The board's "Runs in" field then shows
"Actions", and "Session" the run's link. The run's log also shows each
tool call the session was denied, with the reason.

The poller starts `factory-build.yml` on the repository's default branch,
which it reads once when it starts. The run does no start check of its
own: only someone with write access can start a workflow.

A review on a pull request that conflicts with the default branch starts
no run, since GitHub starts no workflow for a pull request it cannot
merge. The conflict sweep clears the conflict and works the review in the
same run, and `factory-review.yml` can be started by hand with the pull
request's and the review's numbers.

**Which token a cloud session uses.** The access token is
`FACTORY_BUILD_TOKEN`, or `FACTORY_BOARD_TOKEN` when that is not set. The
workflow's own token is never used for a build, since GitHub starts no CI
on a pull request that token opened. The token must be allowed to push a
change under `.github/workflows/` (the `workflow` scope), or such a push is
refused and the build stops there. The agent's token is
`CLAUDE_CODE_OAUTH_TOKEN`, or `ANTHROPIC_API_KEY`; with both set, the
first is used. `FACTORY_BUILD_MODEL`, a repository variable, chooses the
model.

**Who a build's commits name.** Their author is Claude,
`Claude <noreply@anthropic.com>`, which GitHub links to its `claude` user.
Their committer is the token's owner, by the account's no-reply address,
which is what lets that account's signing key show them as verified. When
a pull request is squash merged, the commit on your default branch names
the person who opened it as its author, and GitHub adds a
`Co-authored-by: Claude` line for the build's commits.

A team that wants its builds to act as an account of their own creates a
GitHub account, gives it write access, and stores that account's token as
`FACTORY_BUILD_TOKEN`. The build's pull requests, comments, and commits'
committer are then that account's.

When a build cannot start, the poller's comment on the ticket reads "Could
not start a build in GitHub Actions ... answered 403": give the token the
scopes [Secrets](setup.md#secrets) names. A failed board sync arrives as
an email from GitHub.

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

| Name                | Kind                     | Set by                                                                         |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------ |
| `merge: automatic`  | Label on a pull request  | The merge policy, when every file is allowed                                   |
| `merge: manual`     | Label on a pull request  | The merge policy, otherwise                                                    |
| `verdict: override` | Label on a pull request  | Only a person: passes the review verdict for one commit. Sessions never add it |
| `follow-up`         | Label on a ticket        | The first follow-up line, on the one follow-ups ticket                         |
| `spec`              | Label on a ticket        | Refinement, for a change your users will see, when `specs: openspec`           |
| Who merges          | Status on a pull request | The merge policy: which way it goes, and why                                   |
| Review verdict      | Status on a pull request | The review-verdict workflow: success only when the review said ready           |

## Hooks

`sync` adds five hooks to `.claude/settings.json`. They run inside Claude
Code sessions in this repository, not in your own terminal.

| Hook                                                      | What it does                                                                                                                             |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Before a shell command                                    | Blocks a commit on your main branch, a push to it, and a force push. Runs your `before-commit` commands before a commit                  |
| Before posting ticket text                                | Refuses text with a bare `<tag>`, which GitHub would silently drop                                                                       |
| When a reviewer starts or stops                           | Records the run on the ticket, so its cost is counted                                                                                    |
| Before an unattended build writes a file under `.claude/` | Approves the write, when the run is one the factory started and the file is not `.claude/settings.json` or `.claude/settings.local.json` |
| When a session starts                                     | Shows unfinished branches and where each ticket stands                                                                                   |

Claude Code protects `.claude/`, and an unattended run denies a write
there that nothing approves. The fourth hook approves, only in a run the
factory's action started, a write to the repository's own files under
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

In Claude Code a skill is also a slash command: type `/` and its name,
with the ticket or pull request number after it. Asking in plain words
calls the same skill.

| Type                             | Same as asking                     |
| -------------------------------- | ---------------------------------- |
| `/factory-refine 12`             | "refine ticket 12"                 |
| `/factory-build 12`              | "build ticket 12"                  |
| `/factory-address-review 280`    | "address the review on 280"        |
| `/factory-resolve-conflicts 280` | "resolve the conflicts on 280"     |
| `/factory-diagnose`              | "diagnose this failing test"       |
| `/factory-mutate`                | "mutate this test"                 |
| `/factory-deps`                  | "fix the dependency pull requests" |
| `/factory-design`                | "mock up a new about page"         |

Typing `/factory` in a session lists them, which is also how to check that
a session picked the factory up.

**Where the files live.** `sync` writes the factory's skills to
`.claude/skills/factory-*/` and its agents to `.claude/agents/factory-*.md`.
Your own skills go in `.claude/skills/NAME/SKILL.md` and your own agents
in `.claude/agents/NAME.md`, as for any Claude Code project. A plug-in
names one under `plugins` in `.claude/factory.yaml`, with `skill:` for a
folder in `.claude/skills/` and `agent:` for a file in `.claude/agents/`.
An agent's description is the `description` in its file's front matter.

A colon, as in `/factory:refine`, is something Claude Code adds to a
skill that comes from a plugin. Plain skill files get plain names, so the
prefix `factory-` is part of the name. It also shows, in `.claude/skills/`,
which files an update will overwrite and which are yours. The package is
still laid out as a valid Claude Code plugin, so loading the skills from
it instead of copying them stays possible.

**Your project's instructions** are its `CLAUDE.md` files: the one at the
root, and any beside the code they govern. The skills read how to check a
change, and the rules for each area, from them. `sync` adds one line to
the root `CLAUDE.md`, which loads the factory's rules.

## Dependency bots

Dependabot opens each new version of the factory as a pull request of its
own, and `factory-deps` adds the files that version writes
([Updating](../updating.md)). Give the package a group of its own, and keep
it out of any group that takes every package, so its pull request holds
nothing else. In `.github/dependabot.yml`:

```yaml
updates:
  - package-ecosystem: npm
    directory: /
    schedule:
      interval: weekly
    groups:
      factory:
        patterns: ["@davidbyoung/software-factory"]
      npm:
        patterns: ["*"]
        exclude-patterns: ["@davidbyoung/software-factory"]
        update-types: [minor, patch]
```

`factory-deps-auto-merge.yml` never turns auto-merge on for it, so it
waits for you whatever its size.

## Limits

These come from GitHub, GitHub Actions, or Claude Code, not from the
factory.

- **GitHub's own runners stop any job at 6 hours.** A cloud session's job
  is given its `session-minutes` plus 10, so the step that releases the
  claim still runs; a value above 350 does nothing there. A self-hosted
  runner allows longer. `sync` writes each `session-minutes` value into
  the session workflows as the session step's timeout.
- GitHub's shortest schedule is every five minutes, and scheduled runs can
  start late.
- Public repositories are not billed for Actions minutes.
- GitHub switches off scheduled workflows in a public repository with no
  activity for 60 days.
- GitHub limits how many jobs an account runs at the same time.
- **A default branch not named `main` or `master` gets no conflict sweep
  on a push.** A copied workflow cannot ask for the default branch's name.
  It gets the nightly sweep, and can start one by hand.
- **Every review event costs a minute of Actions,** including the
  factory's own replies, which start runs that find nothing to do.
- **A token from a GitHub App is not supported** for a build. The run asks
  GitHub who owns the token to name its commits' committer, and an App's
  token has no user.
- **The squash merge on your default branch is signed by GitHub,** whether
  or not the build's own commits were.
- **The factory does not work inside a Claude cloud session.** Its
  commands need GitHub's GraphQL API, which is closed there.
  `factory build N` still works from such a session,
  since it only asks GitHub to start a workflow.
- **Untested against a real organization: a board one owns.** It is read
  the same way as a person's. The token needs access to the
  organization's projects, which an organization's settings can refuse a
  classic token.
- **Untested: GitHub's built-in board automations,** such as moving a
  closed issue to Done. They may fight the board sync.
