# Settings

This page and the ones it lists are for changing what Lunamill does in
your repository once it is set up. Everything you can change is in one file,
`.claude/lunamill.yaml`, which [`lunamill init`](../../setup/README.md) writes when
you set Lunamill up. You don't need to read this page top to bottom:
start with
[the settings most repositories change](#the-settings-most-repositories-change),
and look up any other setting under [Every setting](#every-setting).

## Words this page uses

- **Session:** one conversation with the
  [coding agent](../glossary.md#the-tools) working in your repository. A session on your own machine is a
  local session. One that runs in the cloud with nobody at the keyboard is
  an unattended session.
- **Build:** a session taking one approved ticket to a pull request.
- **The cloud runner:** where Lunamill's unattended work runs. Today
  that is [GitHub Actions](../../integrations/github-actions.md).
- **The board:** a view showing each ticket's state as a column, today a
  [GitHub Project](../../integrations/github-projects.md). It is optional.
- **The board sync:** a job on the cloud runner that moves each ticket to
  its column on the board and fills in its fields. It is the only thing
  that writes to the board.
- **`lunamill sync`:** a command you run. It copies Lunamill's skills,
  agents, and rules into your repository, choosing which ones from this
  file, writes its two workflow files, and writes the settings in effect
  into `.claude/lunamill.lock`. It has nothing to do with the board sync.
- **Skill and agent:** a skill is a set of instructions a session follows,
  and an agent is a separate reviewer a session launches to read something
  and report back.

The [glossary](../glossary.md) has the rest.

## How the file works

- **Three settings are required, and a fourth before any build.** Every
  file has [`version`](#version), [`repository`](#repository), and
  [`code-host.branch-name`](code-host.md#code-host), which `lunamill init` writes for
  you, and a session can't build a ticket until you set
  [`commands.gate`](commands.md#commandsgate). Every other setting has a default, and
  you write it only when you want something else.
- **It holds only what a script needs.** Anything that needs judgment,
  such as when one of your reviewers should apply, goes in the
  instructions your coding agent already reads, such as `CLAUDE.md`.
- **File patterns are globs.** `*` matches within one folder and `**`
  matches across folders. Both match names that start with a dot. A
  pattern with no wildcard matches that one path from the repository's
  root.
- **A command is one line of shell.** Each runs with bash, from the
  repository's root. Only the commands under [`site.checks`](site.md#site),
  [`auto-merge.commands`](auto-merge.md#auto-merge), and
  [`approval-policies`](approval-policies.md#approval-policies) are given anything on their
  standard input, and their entries say what.
- **Some settings choose between tools, and name the tool with `type`.**
  When `type` is the only thing in the block, you can write the tool's
  name on the same line. These two mean the same:

  ```yaml
  specs: openspec
  ```

  ```yaml
  specs:
    type: openspec
  ```

- **Your comments are kept.** `lunamill init` writes a comment above each
  section, and updates never remove yours.
- **Every command reads the lock, not this file.** `lunamill sync` combines
  Lunamill's defaults, any [`presets`](presets.md#presets) you list, and this
  file, and writes every setting Lunamill will use, defaults included,
  into `.claude/lunamill.lock`, which you commit and never edit. Until you
  sync after a change, every command stops and says so, but the ones that
  fix or report it: `lunamill sync`, `lunamill doctor`,
  `lunamill config check`, and the `lunamill preset` commands.

  ```text
  .claude/lunamill.yaml changed since the last sync. Run: lunamill sync
  ```

  [`lunamill config explain`](../cli.md) prints the settings in effect, each
  marked with where its value came from.

## The shortest file

These are the settings Lunamill needs before a session can build a
ticket. Every other setting has a default.

```yaml
version: 1
repository: your-name/your-repo
code-host:
  branch-name: "{ticket}"
commands:
  gate:
    - npm test
```

- [`version`](#version), [`repository`](#repository), and
  [`code-host.branch-name`](code-host.md#code-host) are required by every command,
  and `lunamill init` writes all three. Without one, every command stops
  and names it. `"{ticket}"` is a pattern: ticket 12 is built on a branch
  named `12`. The code host is [GitHub](../../integrations/github.md) unless you say
  otherwise.
- [`commands.gate`](commands.md#commandsgate) is how a session checks a change, such
  as your tests and linter. `lunamill init` asks for one command and
  writes it. Left empty, it lists the gate under "Left to do", and you
  add it. Without it Lunamill still [refines](../../workflow/README.md) tickets,
  but a session can't build one.

With these, Lunamill refines a ticket when you run `/lunamill-refine N`
in a session, builds it when you run `/lunamill-build N`, nothing merges
without you, and there is no board.

**With a board,** two more settings are required. Skip this part if you
have none:
[`tickets.board`](tickets.md#tickets), your board's number, and
[`tickets.columns`](tickets.md#ticketscolumns), which of its columns shows each of
the six [states](../../workflow/README.md#the-six-states) a ticket goes through.
`lunamill init` writes both from the board you choose:

```yaml
tickets:
  board: 1
  columns:
    backlog: Backlog
    refining: In refinement
    ready: Ready
    building: In progress
    review: In review
    done: Done
```

Every state needs a line. For a state your board has no column for,
write `none` as its column. By default nothing starts a build when a
ticket reaches Ready ([`builds.trigger`](builds.md#builds) is `manual`); if you
set it to `own-server` or `github-action`, `ready` must name a column.

`lunamill init` may write more, such as [`tickets.fields`](tickets.md#ticketsfields)
when you confirm the ticket fields it suggests. None of it is required.

**It worked when** `lunamill config check` prints
`✓ The settings are valid.`

## The settings most repositories change

- **How to check a change:** your tests, linter, and type check, under
  [`commands.gate`](commands.md#commandsgate). A build cannot finish without it.
- **Quick checks before every commit:** your formatter and the other
  checks that take a few seconds, under
  [`commands.before-commit`](commands.md#commandsbefore-commit).
- **A board:** your board's number, under
  [`tickets.board`](tickets.md#tickets).
- **What may merge without you:** for example your docs, under
  [`auto-merge.allow`](auto-merge.md#auto-merge).
- **Reviewers of your own:** an agent you wrote, which reads a change that
  touches certain files, under
  [`plugins.build.reviewers`](plugins.md#pluginsbuild). [Your own skills and agents](../../customize/plugins.md) has a
  worked example.

**After you change the file,** run:

```bash
lunamill config check
lunamill sync
```

`lunamill config check` prints `✓ The settings are valid.` when the file
is valid, and names the setting when it is not. `lunamill sync` then rewrites the lock and the
copied files that depend on what you changed, and lists each file it
wrote. Every change needs it, one under `plugins` included, as
[How the file works](#how-the-file-works) says.

## Every setting

`version` and `repository` are below. Every other key has a page of its
own:

| Key                                         | What it sets                                                  |
| ------------------------------------------- | ------------------------------------------------------------- |
| [`presets`](presets.md)                     | The shared settings this repository follows                   |
| [`tickets`](tickets.md)                     | The ticket system, the board, its columns, fields, and labels |
| [`code-host`](code-host.md)                 | The code host, how a build names its branch, and its labels   |
| [`builds`](builds.md)                       | Builds in the cloud, and what starts them                     |
| [`specs`](specs.md)                         | The spec tool, if any                                         |
| [`commands`](commands.md)                   | The commands that check a change                              |
| [`session-minutes`](session-minutes.md)     | How long a session in the cloud may run                       |
| [`plugins`](plugins.md)                     | Your own skills and agents                                    |
| [`site`](site.md)                           | A website's pages, for the website review                     |
| [`auto-merge`](auto-merge.md)               | The pull requests that merge themselves                       |
| [`pr-review`](pr-review.md)                 | The automated review                                          |
| [`rules`](rules.md)                         | Lunamill's rules, tuned for your repository                   |
| [`approval-policies`](approval-policies.md) | The checks a person approves                                  |

[Example settings files](examples.md) shows three whole files.

### `version`

Which layout of this file you are using. It is not Lunamill's version.
Write `2`.

- **Default:** none. `lunamill init` writes it.
- **If it is wrong,** every Lunamill command that reads this file stops
  with `version: must be 2`. For a version 1 file, it also says where
  [Upgrade notes](../../maintain/upgrade-notes.md#moving-to-settings-version-2) shows each setting
  that moved.

### `repository`

Your repository, as `owner/name`, such as `harbor-goods/storefront`.

- **Default:** none. `lunamill init` writes it. It proposes the
  repository from your checkout's remotes, whatever each is called, and
  asks which one you are setting up when they name a fork or more than
  one repository. Once the line is written, nothing works it out again.
- **If it is wrong,** commands read and write another repository's
  tickets, or fail because it does not exist. A command that reads the
  default branch, such as `lunamill sync`, stops when no remote of your
  checkout is that repository:

  ```text
  ✗ repository: .claude/lunamill.yaml says acme/web, and no remote here is acme/web. origin is dev/web. Add the remote, or change the line and run lunamill sync.
  ```

- **In a run in the cloud too, commands take the repository from this
  line,** and not from the run. After you rename a repository, change the
  line: the "Lunamill files in step" check fails on each pull request until
  you do, with both names:

  ```text
  ✗ repository: .claude/lunamill.yaml says acme/web, and this pull request is in acme/website. Change the line and run lunamill sync.
  ```

It is written down rather than worked out from your checkout, because the
[poller](builds.md#builds), which watches your board from outside any checkout,
needs it too.

## Checking the file

| Command or tool           | What it does                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| Your editor               | Flags a misspelled setting as you type, using the schema named on the file's first line           |
| `lunamill config check`   | Stops on anything Lunamill can't use, and warns about patterns that match nothing. CI runs it     |
| `lunamill config explain` | Prints the whole file as Lunamill reads it, with every default written out and marked `# default` |
| `lunamill doctor`         | Checks the file against your real board, and that each secret Lunamill needs is set               |

A first line like this one is optional. It points your editor at the
schema, in Lunamill's own repository:

```yaml
# $schema: https://raw.githubusercontent.com/lunamill-ai/lunamill/main/settings.schema.json
```

JetBrains editors and Visual Studio Code's YAML extension both read it.
The editor's check is only a help: it accepts some things
`lunamill config check` refuses, such as a plugin whose file doesn't exist.
