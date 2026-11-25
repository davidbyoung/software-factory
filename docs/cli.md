# The CLI

`factory` is the command-line tool. Skills, hooks, and workflows call it for
everything that must give the same answer every time. You will run a few
of these yourself; most are run for you.

Run any command as `factory`, from the one install on your machine that
the [quick start](quick-start.md#1-install) sets up. `factory` with no
command, or one it does not have, prints the list of commands it has and
exits non-zero.

Commands you read yourself use color when they print to a terminal. Cyan
is something to copy, such as a command or an address. Yellow is your
turn: a question, or a step that is left for you. Green worked, red
failed, and dim text can be skipped. The words are the same without it.
Set `NO_COLOR` to turn color off, or `FORCE_COLOR=1` to keep it when you
pipe the output, as to `less -R`. A command whose output a skill or a
workflow reads never uses color.

A table with a State column has commands still to come, marked
**Planned**; every command in a table without one is built.
[What is built](developing.md#what-is-built) lists the parts.

The skills are not `factory` commands: you type one in a session as a
slash command, such as `/factory-refine 12`. [Skills](skills.md) lists them.

## Which version runs

The command you installed only starts the factory. Each repository names
the version it uses, in the `version:` line of `.claude/factory.lock`,
and that is the one that runs there:

| Where you run `factory`                                   | What runs                                                                         |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A repository whose `.claude/factory.lock` names a version | That version. The first time, npm downloads it, and a line says so                |
| A repository not set up yet, or outside any repository    | The version installed on your machine                                             |
| When you run `factory update`, in any directory           | The version installed on your machine, which hands the sync to the newest release |
| With `FACTORY_VERSION` set to a release                   | That release, for that one command, whatever the lock names                       |

```text
Downloading the factory 0.3.0, which this repository names. This happens once.
```

`FACTORY_VERSION=0.3.0 factory init` runs that one `init` at 0.3.0.
`factory update` sets the variable itself for its sync, and
[Updating](updating.md#naming-every-column) uses it where a release needs
a setting before it can sync. A run in the cloud installs the version the
repository names:
[What a job installs](github/reference.md#what-a-job-installs).

Each version it downloads is kept in `~/.cache/software-factory/`, or
under `$XDG_CACHE_HOME` when that is set, and the folder is safe to
delete. When a version cannot be downloaded, the command stops, exits 1,
and ends its line with npm's own reason:

```text
✗ This repository names the factory 0.3.0, and it could not be downloaded: npm error 404 Not Found
```

A session's hooks run the same command. On a machine without it, they
stop each command the session tries to run, and print:

```text
The factory is not installed on this machine. Install it once: npm install -g @davidbyoung/software-factory
```

## Setting up

| Command                      | When you run it                                                                                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `factory init`               | Once, to set a repository up. Again, to turn a part on or off. It opens a pull request with the files it wrote, on a first run and whenever a later run changes one                              |
| `factory init --preset NAME` | The same, following the [presets](presets.md) you name, once for each, in place of those `init` would look for                                                                                   |
| `factory init --org ADDRESS` | Once, as an owner of an organization, to set the organization up for all its repositories. ADDRESS is the organization's, such as `https://github.com/acme`, and the command needs no repository |
| `factory sync`               | After editing `.claude/factory.yaml`, to write the factory's files from your settings                                                                                                            |
| `factory sync --check`       | To see that the factory's files match your settings. It also runs in CI                                                                                                                          |
| `factory config check`       | To validate your settings. It also runs in CI                                                                                                                                                    |
| `factory board check`        | After pointing [`tickets.board`](configuration.md#tickets) at your board, to see how it reads it                                                                                                 |
| `factory doctor`             | When something seems off. It checks the settings, files, version, secrets, board, and each tool's own setup                                                                                      |

`init` asks its questions in the terminal, and reads each token in a
masked prompt. [Setting up on GitHub](github/setup.md) shows what each
form asks and prints.

`sync --check` ends with `✓ The factory's files match the settings.`,
and `config check` with `✓ The settings are valid.`, when there is
nothing to fix.

`doctor` prints its checks under headings: `Settings and files`, then
each tool's name, such as `GitHub` or `Claude Code`, then the parts you
left off. Each check starts with a mark: ✓ works, ✗ needs fixing, ?
worth a look, and - off on purpose. `doctor` exits 1 when a
check fails. GitHub never lets a secret be read back, so `doctor` checks
only that each secret your parts read is set. With the automated review
on, it checks that "Review verdict" is required before a merge to your
default branch ([Changing it later](github/setup.md#changing-it-later)).
Before the setup's pull request has merged, that line reads
`- "Review verdict" is not required yet: the rule is made once the setup's pull request merges`,
and is no failure.
In a private repository of an organization on GitHub's Free plan, it
says instead that the organization's secrets are not shared with the
repository, and that the verdict cannot be required there
([On GitHub's Free plan](github/setup.md#on-githubs-free-plan)).
A ticket system's token kept on your machine it checks with the ticket
system itself. It does not check the GitHub access token and the Claude
token that `init` keeps on your machine on your own account.

`board check` prints two blocks, each headed by the setting it shows.
Under [`tickets.columns`](configuration.md#ticketscolumns) is a row for
each of a ticket's states, such as `backlog` or `review`, with the
[board](glossary.md) column it sits in. Under
[`tickets.fields`](configuration.md#ticketsfields) is a row for each
field the [board sync](glossary.md) fills in on a card. A row is a mark,
the state or the field, and what the factory makes of it, such as
`✗ review     In review: no such column on the board`. When every row is
✓ or -, the factory reads your board as your settings say. A ✗ makes the
command exit 1.

| Mark | Words after the state or field     | What to do                                                                                                  |
| ---- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ✓    | the column's name, or `synced`     | Nothing                                                                                                     |
| -    | `none, shows in Backlog`, or `off` | Nothing: the settings set it to `none`, so the ticket shows in the column named, or the field is left empty |
| ?    | `skipped: no such field`           | Add the field to the board, or set it to `none` under `tickets.fields`, if you want it gone from this list  |
| ?    | `no state: left alone`             | Name the column under `tickets.columns` if the factory should move cards there; otherwise nothing           |
| ✗    | `no such column on the board`      | Add the column to the board, or change its name under `tickets.columns` to one the board has                |

## Every day

| Command                  | When you run it                                         |
| ------------------------ | ------------------------------------------------------- |
| `factory status`         | To see each ticket's state and which session is on it   |
| `factory status --watch` | The same, read again every 15 seconds                   |
| `factory build N`        | To build ticket N in the cloud. Prints the run's link   |
| `factory pr watch N`     | To wait until pull request N needs you, and be told why |

## Now and then

| Command                  | When you run it                                                                                               | State |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ----- |
| `factory config get KEY` | To print one setting in effect, such as `tickets.board`                                                       | Built |
| `factory config explain` | To see every setting in effect, defaults included                                                             | Built |
| `factory plugins`        | To see the plugins the factory will use, by role                                                              | Built |
| `factory site compare`   | To picture a website's pages before and after a change. See below                                             | Built |
| `factory site stop`      | To end the sites `compare --keep` left running                                                                | Built |
| `factory update`         | To raise the factory to its newest release, and each preset to its newest commit, without waiting for the job | Built |
| `factory remove`         | To take the factory out of a repository                                                                       | Built |

`factory plugins` prints one line for each plugin, the factory's own
included: its kind, its name, its [role](plugins.md#the-roles), then its
files or labels. `factory plugins ROLE` prints one role's lines.

`factory update` changes the version your repository names and syncs, and
leaves the files for you to commit:
[Doing it yourself](updating.md#doing-it-yourself) shows what it prints.
The update job runs it with `--pull-requests`, which opens a pull request
for each update instead ([Updating](updating.md#what-happens)).
[Removing](removing.md) says what `remove` deletes and what it leaves to
you.

## Presets

A [preset](presets.md) is a folder of settings, in a repository on your
code host, that several repositories share. A repository lists each one
it follows under [`presets`](configuration.md#presets), by the name of
the repository that holds it, such as `acme/factory-config`.

| Command                            | When you run it                                                                                                                                                                                                                               |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `factory preset add NAME`          | To follow a preset. It shows what would change and asks before changing anything                                                                                                                                                              |
| `factory preset remove NAME`       | To stop following one, the same way                                                                                                                                                                                                           |
| `factory preset choices`           | To see where two of your presets disagree, and choose which one this repository follows                                                                                                                                                       |
| `factory preset choose KEY PRESET` | To record one of those choices without questions, from a session or a script, as [Your choices](presets.md#your-choices) shows                                                                                                                |
| `factory preset check`             | In a checkout of a preset's own repository, before merging a change to it. It also fails when the `cron` line of an organization's `.github/workflows/factory-poller.yml` there differs from [`builds.poll-minutes`](configuration.md#builds) |
| `factory preset changes REF`       | To see what the presets' update changed since `REF`, a git branch, tag, or commit such as `origin/main`. It is the description of each [preset update's pull request](presets.md#when-a-preset-changes)                                       |

`add` and `remove` ask only in a terminal. Elsewhere they print what would
change and stop, unless given `--yes`; `--dry-run` prints it and changes
nothing.

## Run for you

The rest are run by the skills, the hooks, and the workflows, not by you.
They are listed so nothing the factory does is hidden.

### Tickets

Skills call these to read or change a ticket. Every one goes through one
interface, which is what lets another ticket system be added later:
[Developing](developing.md#adding-a-ticket-system) explains it. Each exits
non-zero with the error when it cannot reach the ticket system: a failed
read is never an empty answer. `view` and `list` take `--json`, which
prints what the ticket system returned as one JSON value. `edit`,
`comment`, and `open` refuse a body with a bare tag-like `<word>` the
ticket system would swallow, name it, and post nothing.

N is the ticket's key as your ticket system writes it: `12` on GitHub.

| Command                                                    | What it does                                                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `factory ticket view N`                                    | Prints ticket N: its title, state, labels, body, and comments with their IDs and authors. A label you renamed shows its key beside it                                                                                                                                                                                                           |
| `factory ticket answers N`                                 | Prints each comment on N that counts as an answer: its author can write to the repository, and it is not the factory's own. Says so when there is none                                                                                                                                                                                          |
| `factory ticket view N --field NAME`                       | Prints one of `title`, `state`, `labels` (one per line), `body`, or `ref`, how the ticket system writes N in prose, such as `#12`, and nothing else                                                                                                                                                                                             |
| `factory ticket list`                                      | Lists the open tickets: key, title, and labels, separated by tabs                                                                                                                                                                                                                                                                               |
| `factory ticket list --label LABEL`                        | Only those with the label. `--title "TITLE"` keeps those whose title is exactly that                                                                                                                                                                                                                                                            |
| `factory ticket edit N [--title TITLE] [--body-file FILE]` | Replaces N's title, its body, or both. `--attach FILE` adds an image to a body                                                                                                                                                                                                                                                                  |
| `factory ticket comment N --body-file FILE`                | Comments on N and prints the comment's ID. `--attach FILE` adds an image                                                                                                                                                                                                                                                                        |
| `factory ticket open --title TITLE --body-file FILE`       | Opens a ticket with the factory label and prints its key. `--label LABEL` adds another                                                                                                                                                                                                                                                          |
| `factory ticket label N --add LABEL`                       | Adds a label to N. `--remove LABEL` takes one off                                                                                                                                                                                                                                                                                               |
| `factory ticket label N --was-removed LABEL`               | Prints `yes` if the label was ever removed from N, otherwise `no`                                                                                                                                                                                                                                                                               |
| `factory ticket link N`                                    | Prints the text that makes a merged pull request close N, such as "Closes #12". `--part` prints the text that says it builds part of N, such as "Part of #4"                                                                                                                                                                                    |
| `factory ticket branch N`                                  | Prints the branch a build of N pushes, from [`code-host.branch-name`](configuration.md#code-host), such as `12` or `feature/octocat/12`. Exits 1 when N does not exist, or the pattern has `{user}` and `gh` is not signed in                                                                                                                   |
| `factory ticket blockers N`                                | One line per ticket N waits on: the ticket, as its system writes it, and whether it is open                                                                                                                                                                                                                                                     |
| `factory ticket block N --by M`                            | Records that N waits on M                                                                                                                                                                                                                                                                                                                       |
| `factory ticket unblock N --by M`                          | Removes that record                                                                                                                                                                                                                                                                                                                             |
| `factory ticket repositories N`                            | Prints the repositories N names, each ✓ set up or ✗ with what to do, or the one line that says where N builds. Exits 1 with a ✗                                                                                                                                                                                                                 |
| `factory ticket repositories N --set REPO...`              | Records them on N, with who did. `--add REPO...` adds to them, and `--after LATER=EARLIER` after either says which merges after which. Exits 1, and records nothing, when one is not found, has another owner, or can't be written to, or the order goes in a circle ([A ticket across repositories](across-repositories.md#changing-the-list)) |
| `factory ticket supports GROUP`                            | Prints `yes` or `no` for `board`, `blockers`, `label-history`, or `attachments`                                                                                                                                                                                                                                                                 |
| `factory ticket claim N`                                   | Claims ticket N for this session. Prints `claimed`, `held by`, or `blocked by`. Adds the factory label first when N lacks it, and says so                                                                                                                                                                                                       |
| `factory ticket adopt N...`                                | Adds the factory label to each ticket named. `--all-open` labels every open ticket instead, and `--since-lock FILE` labels only when FILE, the `.claude/factory.lock` an update replaces, has no [`tickets.labels.factory`](configuration.md#ticketslabels). Prints each it labeled, then how many carry it                                     |
| `factory ticket still-live N`                              | Says whether this session still holds N                                                                                                                                                                                                                                                                                                         |
| `factory ticket stop N "reason"`                           | Releases N and says why                                                                                                                                                                                                                                                                                                                         |
| `factory ticket end N`                                     | A run's last step: releases this session's claim if no open pull request links N. Prints `released`, `kept`, or `not live`                                                                                                                                                                                                                      |
| `factory ticket refining N`                                | Marks N as being refined. Adds the factory label first when N lacks it, and says so                                                                                                                                                                                                                                                             |
| `factory ticket waiting N`                                 | Marks N as waiting on your reply to a round of questions                                                                                                                                                                                                                                                                                        |
| `factory ticket refined N`                                 | Marks N as refined, unless its body lacks what a build reads. `--check` makes that check alone and posts nothing                                                                                                                                                                                                                                |
| `factory ticket ready N`                                   | Moves N to Ready. Only when you ask a session to. Adds the factory label first when N lacks it, and says so                                                                                                                                                                                                                                     |
| `factory ticket cost N`                                    | Notes what this session has spent on ticket N so far                                                                                                                                                                                                                                                                                            |
| `factory follow-up FILE "what is wrong"`                   | Adds a line about that file to the follow-ups ticket, opening the ticket if none is open                                                                                                                                                                                                                                                        |

A command that records something on a ticket, such as `claim`,
`refining`, `cost`, `open`, or `adopt`, then starts the board sync, so the
board follows it. When it cannot start it, it says so on a line of its
own and still exits 0, and the nightly sync catches up:

```text
? the board updates at the nightly sync: couldn't start the board sync (HTTP 403: Resource not accessible by integration)
```

`factory ticket refined N` posts nothing and exits 1 when N's body lacks a
section a build reads, printing one line for each, such as
`missing: ## Acceptance criteria`. With `--check` it prints `sound` for a
body that passes. [Plugins](plugins.md#refiner) lists the sections.

### Pull requests

Pull requests stay on the code host whatever the ticket system. A pull
request's conversation comments and labels go through these, never the
ticket system.

| Command                                          | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `factory pr state [N]`                           | What stands between N and a merge: checks, review, threads, conflict                                                                                                                                                                                                                                                                                                                                                                                |
| `factory pr threads N`                           | The unresolved review threads, each with its comments. `--all` lists the resolved ones too                                                                                                                                                                                                                                                                                                                                                          |
| `factory pr reply N COMMENT --body-file FILE`    | Replies on a thread                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `factory pr resolve N COMMENT`                   | Resolves a thread                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `factory pr closes N`                            | The tickets N closes, by key                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `factory pr cost N`                              | Notes what this session spent on pull request N since it started                                                                                                                                                                                                                                                                                                                                                                                    |
| `factory pr for-branch BRANCH`                   | The newest pull request from BRANCH, open or not: `#N open`, `#N merged`, or `#N closed`, or `none` when there has been none                                                                                                                                                                                                                                                                                                                        |
| `factory pr wait-checks N`                       | Waits for every CI run on the pushed commit. Prints `success`, `failure:` with the failed checks, or `no checks`                                                                                                                                                                                                                                                                                                                                    |
| `factory pr ready N`                             | Marks a draft ready for review. When `commit.gpgsign` is `true`, refuses while the code host shows a commit as not verified                                                                                                                                                                                                                                                                                                                         |
| `factory pr comments N`                          | N's conversation comments: ID, author, time, and first line. `--author LOGIN`, `--contains TEXT`, `--from-approvers`, which keeps the comments whose author can write to the repository, and `--json`, which prints each comment's `id`, `user.login`, `body`, and `created_at`                                                                                                                                                                     |
| `factory pr comment N --body-file FILE`          | Posts a conversation comment and prints its ID. Refuses a bare tag-like `<word>`, as `ticket comment` does                                                                                                                                                                                                                                                                                                                                          |
| `factory pr comment-view ID`                     | Prints one conversation comment's body                                                                                                                                                                                                                                                                                                                                                                                                              |
| `factory pr label N --add LABEL`                 | Adds a label to N. `--remove LABEL` takes one off                                                                                                                                                                                                                                                                                                                                                                                                   |
| `factory pr watch N`                             | Waits until N needs attention, says why, and exits                                                                                                                                                                                                                                                                                                                                                                                                  |
| `factory pr watch N --release`                   | Stops watching N                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `factory pr review-pending N REVIEW`             | Exits 0 when an approver's review has something of theirs to answer, and 1, saying why, when it has not                                                                                                                                                                                                                                                                                                                                             |
| `factory pr conflicts`                           | The pull requests the conflict sweep takes, one number a line; exits 0 when there is one and 1 when none                                                                                                                                                                                                                                                                                                                                            |
| `factory pr open --title TITLE --body-file FILE` | Opens a draft pull request from the current branch into the default branch and prints its number. `--base BRANCH` names another base, and `--ready` opens it ready for review. Fails in the code host's own words when the branch has nothing new or already has one open                                                                                                                                                                           |
| `factory pr view N --field FIELD`                | Prints one field of N: `head` (its last commit, in full), `branch`, `base`, `title`, `body`, `state`, or `mergeable` (`dirty` for a conflict, `unknown` until the code host has worked it out)                                                                                                                                                                                                                                                      |
| `factory pr review N REVIEW`                     | One review as JSON: its author, its body, and each comment it left on a line, with the comment a reply replies to                                                                                                                                                                                                                                                                                                                                   |
| `factory pr push`                                | Pushes this branch, or, in a session in the cloud, hands its commits over to be checked and pushed. Never the default branch                                                                                                                                                                                                                                                                                                                        |
| `factory pr pull`                                | Merges the remote's commits on this branch. A session in the cloud already has the newest there were when it started                                                                                                                                                                                                                                                                                                                                |
| `factory pr unverified N`                        | Each of N's commits the code host does not show as signed, with the reason. Prints nothing when it shows them all                                                                                                                                                                                                                                                                                                                                   |
| `factory pr uncovered [BASE] [LCOV]`             | The lines the branch added or changed that the coverage report shows no test covers, a file at a time: `MISS` for a line no test ran, and `PART` for a line that ran with a branch never taken. `BASE` is what the branch is compared with, and is the default branch on your repository's remote, usually `origin`, when left out. `LCOV` is the report, and is `coverage/lcov.info` when left out. Prints nothing when every such line is covered |
| `factory pr failed N`                            | For N's last commit, the failures `wait-checks` counts: each failed job's name and the last 200 lines of its log, from the newest run of each workflow started by a push or a pull request, and what a check that did not pass wrote about itself. Prints nothing when nothing failed                                                                                                                                                               |
| `factory pr review-again N`                      | Asks for a fresh review of N's last commit. Exits 1, saying so, when no review has run on it                                                                                                                                                                                                                                                                                                                                                        |
| `factory deps`                                   | The open dependency pull requests, their checks, and what each needs                                                                                                                                                                                                                                                                                                                                                                                |
| `factory deps --any`                             | Exits 0 when a dependency pull request is open and 1 when none is                                                                                                                                                                                                                                                                                                                                                                                   |

`factory pr wait-checks N` waits until the code host
shows the commit you pushed as N's head, then until the newest run of each
CI job started by that push or pull request has finished. It leaves out
the factory's own jobs, so a failed board sync does not stop a pull
request being marked ready. With no run two minutes after the commit became the head, it
prints `no checks` and exits 0. A failure exits 3.

**In a session in the cloud,** these and the ticket commands work from what
was handed over: a read answers from it, a write prints `Asked:` and is done
after the session ends, and `pr wait-checks`, `pr watch`, and
`pr state --wait` say that the run ends there
([What a cloud run is](builds.md#what-a-cloud-run-is)).

Where [`pr-review`](configuration.md#pr-review) is not set, no automated
review runs. `factory pr state N` then prints
`Claude review: none expected on this head`, and `factory pr state N --wait`
and `factory pr watch N` wait for none.

### Your repository's commands

Skills call these to check and test a change, so no skill names a test
runner or a linter: each runs what your settings list under
[`commands`](configuration.md#commands) and
[`specs`](configuration.md#specs), with bash, from the repository's root.
You can run them too.

| Command                               | What it does                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `factory gate`                        | Runs each [`commands.gate`](configuration.md#commandsgate) command in order, printing `$` and the command before each. Stops at the first that fails, with `✗ The gate failed on:` and the command. Ends with `✓ Every gate command passed.` and exits 0 when every command passes, and exits 1 at the first that fails or when no gate is set |
| `factory workspace N`                 | Clones each other repository N names under `~/.local/share/software-factory/work/`, on N's branch, and prints where each is. Prints one line where N names no other. In the cloud, prints what the session was handed. Exits 1 when one can't be cloned                                                                                        |
| `factory workspace N --remove`        | Removes those clones. Keeps one with work that is not pushed, says so, and exits 1                                                                                                                                                                                                                                                             |
| `factory test-one FILE [NAME]`        | Runs [`commands.test-one`](configuration.md#commandstest-one), one test file alone or the one test NAME in it, and exits with its status                                                                                                                                                                                                       |
| `factory end-to-end FILE [--times K]` | Runs [`commands.end-to-end`](configuration.md#commandsend-to-end), one end-to-end spec alone, and exits with its status. With `--times K`, K times in a row, stopping at the first run that fails. Ends with `✓ The test passed.` or `✗ The test failed.`                                                                                      |
| `factory specs list`                  | Prints each spec your spec tool keeps, one per line with its file, or `none yet`                                                                                                                                                                                                                                                               |
| `factory specs new N`                 | Starts ticket N's spec: with OpenSpec, it creates `openspec/changes/issue-N/`. Then it prints each file to write or update there, which part of the ticket goes in it, and, last, the command to run once they are written. It writes none of them itself, and run again, it prints them again                                                 |
| `factory specs check`                 | Runs [`specs.check`](configuration.md#specscheck), the check of your written specs, ending with `✓ The specs check passed.` or `✗ The specs check failed.`                                                                                                                                                                                     |
| `factory specs finish N`              | With OpenSpec, folds ticket N's spec into `openspec/specs/`, ending with `✓ Folded ticket N's spec into openspec/specs/.` It changes files and commits nothing                                                                                                                                                                                 |
| `factory default-branch`              | Prints the name of your repository's default branch, which nothing in the factory assumes is `main`                                                                                                                                                                                                                                            |

With [`specs: none`](configuration.md#specs), each of the four
`factory specs` commands prints
`- No spec tool (specs: none): each ticket holds its own spec.` and
exits 0. Otherwise each exits 0 when it worked and 1 when it didn't, and
says why on its last line: `new` when your spec tool isn't installed, which
`factory init` fixes, and `finish` when ticket N has no spec started,
which `factory specs new N` fixes.

A build runs `new` before it writes any code, and `finish` just before
its last commit, so you rarely run those two yourself. `list` is the one
to know: it names the spec to read before you change what it describes.

`factory default-branch` asks, in turn, the event of the workflow run it
is in, the remote's `HEAD` in your checkout, such as `origin/HEAD`, and
the code host, whose answer it writes to that `HEAD` so the next run
asks nobody.
The remote is the one whose address is the repository your settings'
`repository` line names, whatever that remote is called. When no remote
is that repository, it exits 1 and says so, naming `origin`'s repository
when there is an `origin`:

```text
✗ repository: .claude/factory.yaml says acme/web, and no remote here is acme/web. origin is dev/web. Add the remote, or change the line and run factory sync.
```

A checkout with no settings file reads `origin`, and with no `origin`
remote it takes git's own `init.defaultBranch`, or `main`. When the
remote exists and none of the three answers, it exits 1 with a line that
names that remote, such as
`Could not tell the default branch. Run: git remote set-head origin --auto`.
`factory sync` and `factory site compare` stop with the same lines, and
the commit hook blocks a session's git command with them.

### Workflows and hooks

| Command                                          | Run by                                                                       | What it does                                                                                                                                                                                                                                                                                                                                                                                                | State |
| ------------------------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `factory board collect`                          | The board sync's job                                                         | Reads the tickets and posts the comments a closed pull request or the nightly run needs                                                                                                                                                                                                                                                                                                                     | Built |
| `factory board apply`                            | The board sync's job                                                         | Sets each ticket's column and fields from its comments                                                                                                                                                                                                                                                                                                                                                      | Built |
| `factory board --dry-run`                        | You, to see what it would set                                                | Reads the tickets and the board, prints what the sync would set, and writes nothing                                                                                                                                                                                                                                                                                                                         | Built |
| `factory merge-policy N`                         | The job that says who merges                                                 | Decides whether N may merge without you, and why                                                                                                                                                                                                                                                                                                                                                            | Built |
| `factory review verdict`                         | The job that records the review's verdict                                    | Posts the "Review verdict" status for an event of a pull request. A review's own run posts it too, as it ends                                                                                                                                                                                                                                                                                               | Built |
| `factory poller`                                 | Your server                                                                  | Starts a build for each Ready ticket. See [Builds](builds.md)                                                                                                                                                                                                                                                                                                                                               | Built |
| `factory poller --once`                          | The poller's job                                                             | One pass of the poller, with the board and Ready column from your settings                                                                                                                                                                                                                                                                                                                                  | Built |
| `factory poller --once --preset FILE`            | The poller's job in an organization's `factory-config` repository            | One pass for an organization: reads the board and Ready column from the preset FILE, and starts the builds of every repository with a ticket in Ready ([The poller](builds.md#the-poller))                                                                                                                                                                                                                  | Built |
| `factory session ready KIND ID [REVIEW]`         | Prepare, the first job of each [cloud run](builds.md#what-a-cloud-run-is)    | Decides whether the session runs. KIND is `build`, `review`, `answer`, `conflict`, or `dependency`, and ID is a ticket's key for a build and a pull request's number for any other. It looks for work first, then for the build token, which the key of an organization's App counts as and a review does not need, and Claude's credential, as [With a part off](github/reference.md#with-a-part-off) says | Built |
| `factory session prepare KIND ID`                | Prepare                                                                      | Claims the ticket of a build, and writes the files the session works from: the default branch, the branch it works on, and what its `factory` commands may read. Ends the run, saying why, when there is nothing to hand over                                                                                                                                                                               | Built |
| `factory session run`                            | Session, the second job                                                      | Lays those files out, runs the coding agent in its sandbox, and keeps the commits, the requests, and a review's answer                                                                                                                                                                                                                                                                                      | Built |
| `factory session publish`                        | Publish, the last job                                                        | Checks what the session left and does it: pushes, opens the pull request, posts what was asked for, waits for CI, and marks a draft ready or starts the next answer. For a review, posts the threads, the summary, and the verdict                                                                                                                                                                          | Built |
| `factory session next PULL`                      | A review's Publish                                                           | Starts the next answer to a pull request a build in the cloud opened, or says on it that it waits for a person                                                                                                                                                                                                                                                                                              | Built |
| `factory session each conflict\|dependency`      | The jobs that look for conflicts and for Dependabot's pull requests          | Starts one run for each pull request that conflicts, or that Dependabot has open                                                                                                                                                                                                                                                                                                                            | Built |
| `factory session repositories`                   | A job that makes a token from an organization's App                          | Prints the repositories that token is for, separated by commas: the run's own, and each of the same owner that holds a preset the lock names                                                                                                                                                                                                                                                                | Built |
| `factory sync --check --against COMMIT --public` | "Factory files in step", on a pull request                                   | Checks the factory's files, and each preset's pin against COMMIT's lock. With `--public`, a preset it can't read with no sign-in is named and passed, since the review's run checks it. Without, it fails                                                                                                                                                                                                   | Built |
| `factory session token`                          | Prepare and Publish, in an organization                                      | Signs the GitHub CLI and git in with a token made from the organization's App, which lasts an hour. No session runs in a job that does this ([Who a cloud session acts as](github/reference.md#who-a-cloud-session-acts-as))                                                                                                                                                                                | Built |
| `factory enroll`                                 | The job that requires the verdict, on a push to the default branch           | Makes "Review verdict" required before a merge to the default branch, once the setup's pull request has merged, or says who does it by hand ([The jobs](github/reference.md#the-jobs))                                                                                                                                                                                                                      | Built |
| `factory update --pull-requests`                 | The update job, and the update job of an organization's `factory-config`     | Opens a pull request for a newer release of the factory, and one for each preset repository whose preset changed ([Updating](updating.md#what-happens)). In an organization's `factory-config`, it opens one that raises the version `.github/workflows/factory-poller.yml` names                                                                                                                           | Built |
| `factory guard`                                  | A hook, before each command                                                  | Runs every guard below on one Bash call                                                                                                                                                                                                                                                                                                                                                                     | Built |
| `factory guard commit`                           | Within `factory guard`                                                       | Blocks a commit on your default branch, a push to it, a force push, or a commit while a [`commands.before-commit`](configuration.md#commandsbefore-commit) command fails                                                                                                                                                                                                                                    | Built |
| `factory guard ticket-text`                      | Within `factory guard`                                                       | Refuses ticket text with a bare `<tag>`, which the ticket system would swallow                                                                                                                                                                                                                                                                                                                              | Built |
| `factory guard credentials`                      | Within `factory guard`, and a hook before each file read, search, or listing | Refuses a call that reads the credentials file, which only the factory's commands read. A message or a search that only mentions it goes through                                                                                                                                                                                                                                                            | Built |
| `factory reviewers start`                        | A hook, when an agent starts                                                 | Records a reviewer's run on the ticket, for its cost                                                                                                                                                                                                                                                                                                                                                        | Built |
| `factory reviewers stop`                         | A hook, when an agent stops                                                  | The same                                                                                                                                                                                                                                                                                                                                                                                                    | Built |
| `factory session-start`                          | A hook, when a session starts                                                | Shows unfinished branches and each ticket's state                                                                                                                                                                                                                                                                                                                                                           | Built |

The board sync runs `collect` and `apply` as two steps, so the board's
token reaches only the second. The board's number comes from
`tickets.board` in your settings.

## Exit codes

- `0`: done, or the answer is the line printed.
- `2`: no such command; the usage is printed. A guard also exits 2 when it
  blocks a call, and so does one of
  [your repository's commands](#your-repositorys-commands) given an
  argument it does not know.
- `3`: `pr wait-checks` saw a check fail.
- Any other non-zero: it could not do it, and the reason is on standard
  error. A command that could not reach the code host or the ticket system
  always exits non-zero.

## `factory site`

`factory site compare` starts the working tree with
[`site.start`](configuration.md#site), starts the default branch from a
temporary git worktree on another port, shoots each page at each width in
light and dark, and prints the pages that changed, with the pixels and
rows. It writes the pictures before, after, and with what changed
outlined, and `report.json`, under `node_modules/.cache/factory/site/`. It
exits 0 whether or not anything changed, and non-zero only when it could
not do its job.

- **Three measurements** are made on each view that changed, a view being one
  page at one width in one scheme, on the base and on the branch, and only what
  got worse prints, one `measured:` line each after the table, beside the lines
  your `site.checks` print, and the same in `report.json`:
  - **Accessibility,** by axe-core at the level `site.accessibility` names
    (`wcag22aa` by default), including text contrast and the standard's target
    size. A failure is new when the base has none of the same rule on an
    element with the same selector or the same markup.
  - **A page that scrolls sideways** on the branch and not on the base.
  - **A new style value:** a font size, color, spacing, or corner radius that
    the base uses in no view of that scheme. It is a fact to weigh, not a
    failure. `site.new-values: false` leaves it out.

  ```text
  measured: /about/ 390 light: accessibility color-contrast: p.intro: Element has insufficient color contrast of 2.5 (foreground color: #9aa5b4, ...). Expected contrast ratio of 4.5:1
  measured: /about/ 390 light: sideways scroll: the page is 412 px wide in a 390 px window
  measured: /about/ 390 light: new value: font-size 15px on h2 "Background"; the site uses 12, 14, 16, 18, 24, 30, and 36 px
  ```

  A page the base does not have is measured alone, and everything found on it
  is new. A view whose pictures did not change is not measured.

- `--base REF` compares against something other than the default branch.
- `--keep` leaves both sites running and prints their addresses, for a state
  that takes a click to reach. `factory site stop` ends them and removes the
  worktree.
- `--before URL --after URL` compares two sites that are already running and
  starts nothing. One without the other is refused.
