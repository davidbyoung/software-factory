# Commands

`lunamill` is the command-line tool. Skills, hooks, and workflows call it for
everything that must give the same answer every time. You will run a few
of these yourself; most are run for you.

Run any command as `lunamill`, from the one install on your machine that
[Install](../get-started/install.md) sets up. `lunamill` with no
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
[What is built](../developing.md#what-is-built) lists the parts.

The skills are not `lunamill` commands: you type one in a session as a
slash command, such as `/lunamill-refine 12`. [Skills and agents](skills.md) lists them.

## Setting up

| Command                       | When you run it                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lunamill init`               | Once, to set a repository up. Again, to turn a part on or off. It opens a pull request with the files it wrote, on a first run and whenever a later run changes one                              |
| `lunamill init --preset NAME` | The same, following the [presets](../customize/presets.md) you name, once for each, in place of those `init` would look for                                                                      |
| `lunamill init --org ADDRESS` | Once, as an owner of an organization, to set the organization up for all its repositories. ADDRESS is the organization's, such as `https://github.com/acme`, and the command needs no repository |
| `lunamill sync`               | After editing `.claude/lunamill.yaml`, to write Lunamill's files from your settings                                                                                                              |
| `lunamill sync --check`       | To see that Lunamill's files match your settings. It also runs in CI                                                                                                                             |
| `lunamill config check`       | To validate your settings. It also runs in CI                                                                                                                                                    |
| `lunamill board check`        | After pointing [`tickets.board`](settings/tickets.md#tickets) at your board, to see how it reads it                                                                                              |
| `lunamill doctor`             | When something seems off. It checks the settings, files, version, secrets, board, and each tool's own setup                                                                                      |

`init` asks its questions in the terminal, and reads each token in a
masked prompt. [Which setup is yours](../setup/README.md) shows what each
form asks and prints.

`sync --check` ends with `✓ lunamill's files match the settings.`,
and `config check` with `✓ The settings are valid.`, when there is
nothing to fix.

`doctor` prints its checks under headings: `Settings and files`, then
each tool's name, such as `GitHub` or `Claude Code`, then the parts you
left off. Each check starts with a mark: ✓ works, ✗ needs fixing, ?
worth a look, and - off on purpose. `doctor` exits 1 when a
check fails. A secret cannot be read back from the code host
([GitHub](../integrations/github.md#limits-that-come-from-github)), so
`doctor` checks that each secret your parts read is set. It gives the
day the coding agent's token, today
[the Claude token](../integrations/claude-code.md#when-the-claude-tokens-year-is-up),
stops working and, on your own account, the day the code host's access
token, today
[the GitHub access token](../integrations/github.md#when-the-github-access-token-expires),
expires.
With the automated review
on, it checks that "Review verdict" is required before a merge to your
default branch ([Changing it later](../setup/repository.md#changing-it-later)).
Before the setup's pull request has merged, that line reads
`- "Review verdict" is not required yet: the rule is made once the setup's pull request merges`,
and is no failure.
On a plan with no branch rules for a private repository, such as
[GitHub's Free plan](../integrations/github-organizations.md#on-githubs-free-plan),
that line reads
`- "Review verdict" cannot be required here: GitHub Free has no branch rules for a private repository`
instead, and is no failure either.
A ticket system's token kept on your machine it checks with the ticket
system itself. It does not try the code host's access token and the
coding agent's token that `init` keeps on your machine on your own account.

`board check` prints two blocks, each headed by the setting it shows.
Under [`tickets.columns`](settings/tickets.md#ticketscolumns) is a row for
each of a ticket's states, such as `backlog` or `review`, with the
[board](glossary.md) column it sits in. Under
[`tickets.fields`](settings/tickets.md#ticketsfields) is a row for each
field the [board sync](glossary.md) fills in on a card. A row is a mark,
the state or the field, and what Lunamill makes of it, such as
`✗ review     In review: no such column on the board`. When every row is
✓ or -, Lunamill reads your board as your settings say. A ✗ makes the
command exit 1.

| Mark | Words after the state or field     | What to do                                                                                                  |
| ---- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| ✓    | the column's name, or `synced`     | Nothing                                                                                                     |
| -    | `none, shows in Backlog`, or `off` | Nothing: the settings set it to `none`, so the ticket shows in the column named, or the field is left empty |
| ?    | `skipped: no such field`           | Add the field to the board, or set it to `none` under `tickets.fields`, if you want it gone from this list  |
| ?    | `no state: left alone`             | Name the column under `tickets.columns` if Lunamill should move cards there; otherwise nothing              |
| ✗    | `no such column on the board`      | Add the column to the board, or change its name under `tickets.columns` to one the board has                |

## Every day

| Command                   | When you run it                                         |
| ------------------------- | ------------------------------------------------------- |
| `lunamill status`         | To see each ticket's state and which session is on it   |
| `lunamill status --watch` | The same, read again every 15 seconds                   |
| `lunamill build N`        | To build ticket N in the cloud. Prints the run's link   |
| `lunamill pr watch N`     | To wait until pull request N needs you, and be told why |

In the last 30 days before the coding agent's token, today
[the Claude token](../integrations/claude-code.md#when-the-claude-tokens-year-is-up),
or, on your own account, the code host's access token, today
[the GitHub access token](../integrations/github.md#when-the-github-access-token-expires),
stops working, `status` ends with a line that says when.

## Now and then

| Command                   | When you run it                                                                                                        | State |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----- |
| `lunamill config get KEY` | To print one setting in effect, such as `tickets.board`                                                                | Built |
| `lunamill config explain` | To see every setting in effect, defaults included                                                                      | Built |
| `lunamill plugins`        | To see the plugins Lunamill will use, by role                                                                          | Built |
| `lunamill site compare`   | To picture a website's pages before and after a change ([Website review](../features/website-review.md#lunamill-site)) | Built |
| `lunamill site stop`      | To end the sites `compare --keep` left running                                                                         | Built |
| `lunamill update`         | To raise Lunamill to its newest release, and each preset to its newest commit, without waiting for the job             | Built |
| `lunamill remove`         | To take Lunamill out of a repository                                                                                   | Built |

`lunamill plugins` prints one line for each plugin, Lunamill's own
included: its kind, its name, its [role](../customize/plugins.md#the-roles), then its
files or labels. `lunamill plugins ROLE` prints one role's lines.

`lunamill update` changes the version your repository names and syncs, and
leaves the files for you to commit:
[Doing it yourself](../maintain/updating.md#doing-it-yourself) shows what it prints.
The update job runs it with `--pull-requests`, which opens a pull request
for each update instead ([Updating](../maintain/updating.md#what-happens)).
[Removing](../maintain/removing.md) says what `remove` deletes and what it leaves to
you.

## Presets

A [preset](../customize/presets.md) is a folder of settings, in a repository on your
code host, that several repositories share. A repository lists each one
it follows under [`presets`](settings/presets.md#presets), by the name of
the repository that holds it, such as `acme/lunamill-config`.

| Command                                  | When you run it                                                                                                                                                                                                                                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lunamill preset add NAME [--in FOLDER]` | To follow a preset. It shows what would change and asks before changing anything                                                                                                                                                                                                                       |
| `lunamill preset remove NAME`            | To stop following one, the same way                                                                                                                                                                                                                                                                    |
| `lunamill preset choices`                | To see where two of your presets disagree, and choose which one this repository follows                                                                                                                                                                                                                |
| `lunamill preset choose KEY PRESET`      | To record one of those choices without questions, from a session or a script, as [Your choices](../customize/presets.md#your-choices) shows                                                                                                                                                            |
| `lunamill preset check`                  | In a checkout of a preset's own repository, before merging a change to it. It fails on a key or a value no repository could use. It also fails when the `cron` line of an organization's `.github/workflows/lunamill-poller.yml` there differs from [`builds.poll-minutes`](settings/builds.md#builds) |
| `lunamill preset changes REF`            | To see what the presets' update changed since `REF`, a git branch, tag, or commit such as `origin/main`. It is the description of each [preset update's pull request](../customize/presets.md#when-a-preset-changes)                                                                                   |

`add` and `remove` ask only in a terminal. Elsewhere they print what would
change and stop, unless given `--yes`; `--dry-run` prints it and changes
nothing.

## Your repository's commands

Skills call these to check and test a change, so no skill names a test
runner or a linter: each runs what your settings list under
[`commands`](settings/commands.md#commands) and
[`specs`](settings/specs.md#specs), with bash: a command written as text
from the repository's root, and an item in each of its folders
([Commands for some folders](settings/commands.md#commands-for-some-folders)).
You can run them too.

| Command                                       | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lunamill gate [--dry-run \| --all]`          | Runs each [`commands.gate`](settings/commands.md#commandsgate) command the branch's change sets off, in order, printing `$` and the command before each. Where commands name their folders and files, it first prints which run and why, and counts those it leaves out; `--dry-run` lists each and runs nothing, and `--all` runs every one. Stops after the first that fails, with `✗ The gate failed on:` and the command. Ends with `✓ Every gate command passed.` and exits 0 when every command passes, and exits 1 when one fails or no gate is set |
| `lunamill test-one FILE [NAME]`               | Runs [`commands.test-one`](settings/commands.md#commandstest-one), one test file alone or the one test NAME in it, with the command for the file's folder, and exits with its status                                                                                                                                                                                                                                                                                                                                                                       |
| `lunamill end-to-end FILE [--times K]`        | Runs [`commands.end-to-end`](settings/commands.md#commandsend-to-end), one end-to-end spec alone, with the command for the file's folder, and exits with its status. With `--times K`, K times in a row, stopping at the first run that fails. Ends with `✓ The test passed.` or `✗ The test failed.`                                                                                                                                                                                                                                                      |
| `lunamill coverage [--dry-run]`               | Runs the [`commands.coverage`](settings/commands.md#commandscoverage) commands the branch's change sets off, then prints each line the branch changed that no test covers, as `lunamill pr uncovered` does. Ends with `✓ Coverage ran:` and how many lines are not covered                                                                                                                                                                                                                                                                                 |
| `lunamill relock [--dry-run \| --all]`        | Runs the [`commands.relock`](settings/commands.md#commandsrelock) commands set off by the files that differ from the default branch, or every one with `--all`, to rebuild lock files after a conflict in one                                                                                                                                                                                                                                                                                                                                              |
| `lunamill build-setup [--dry-run]`            | Runs every [`commands.build-setup`](settings/commands.md#commandsbuild-setup) command, each in its folders, as a build in the cloud does before its session starts                                                                                                                                                                                                                                                                                                                                                                                         |
| `lunamill specs list`                         | Prints each spec your spec tool keeps, one per line with its file, or `none yet`                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `lunamill specs new N`                        | Starts ticket N's spec: with `specs: openspec`, it creates `openspec/changes/issue-N/`. Then it prints each file to write or update there, which part of the ticket goes in it, and, last, the command to run once they are written. It writes none of them itself, and run again, it prints them again                                                                                                                                                                                                                                                    |
| `lunamill specs check`                        | Runs [`specs.check`](settings/specs.md#specscheck), the check of your written specs, ending with `✓ The specs check passed.` or `✗ The specs check failed.`                                                                                                                                                                                                                                                                                                                                                                                                |
| `lunamill specs finish N`                     | With `specs: openspec`, folds ticket N's spec into `openspec/specs/`, ending with `✓ Folded ticket N's spec into openspec/specs/.` It changes files and commits nothing                                                                                                                                                                                                                                                                                                                                                                                    |
| `lunamill default-branch`                     | Prints the name of your repository's default branch, which nothing in Lunamill assumes is `main`                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `lunamill approval-policies check [--pull N]` | Runs your [approval policies](../features/approval-policies.md) against what your branch changes since the default branch, uncommitted and untracked files included, or against pull request N, and posts nothing. Prints `? NAME: N waiting for approval` and each finding, `✓ NAME: nothing to approve`, or `- No approval policy applies to this change`. Exits 1 only when a check fails                                                                                                                                                               |

With [`specs: none`](settings/specs.md#specs), each of the four
`lunamill specs` commands prints
`- No spec tool (specs: none): each ticket holds its own spec.` and
exits 0. Otherwise each exits 0 when it worked and 1 when it didn't, and
says why on its last line: `new` when your spec tool isn't installed, which
`lunamill init` fixes, and `finish` when ticket N has no spec started,
which `lunamill specs new N` fixes.

A build runs `new` before it writes any code, and `finish` just before
its last commit, so you rarely run those two yourself. `list` is the one
to know: it names the spec to read before you change what it describes.

`lunamill default-branch` asks, in turn, the event of the workflow run it
is in, the remote's `HEAD` in your checkout, such as `origin/HEAD`, and
the code host, whose answer it writes to that `HEAD` so the next run
asks nobody.
The remote is the one whose address is the repository your settings'
`repository` line names, whatever that remote is called. When no remote
is that repository, it exits 1 and says so, naming `origin`'s repository
when there is an `origin`:

```text
✗ repository: .claude/lunamill.yaml says acme/web, and no remote here is acme/web. origin is dev/web. Add the remote, or change the line and run lunamill sync.
```

A checkout with no settings file reads `origin`, and with no `origin`
remote it takes git's own `init.defaultBranch`, or `main`. When the
remote exists and none of the three answers, it exits 1 with a line that
names that remote, such as
`Could not tell the default branch. Run: git remote set-head origin --auto`.
`lunamill sync` and `lunamill site compare` stop with the same lines, and
the commit hook blocks a session's git command with them.

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
