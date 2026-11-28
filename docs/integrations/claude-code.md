# Claude Code

The coding agent: what runs each session, on your machine and in the
cloud.

## What lunamill uses it for

Every session runs in Claude Code: the ones you start on your machine,
and the automated review, the approval policies' agents, and builds in
the cloud. They run lunamill's skills and agents.

### Skills in Claude Code

In Claude Code each skill is a slash command, such as `/lunamill-refine 12`.
[Skills and agents](../reference/skills.md#at-a-glance) lists every one with what it does.

**Where the files live.** `lunamill sync`, which writes lunamill's
files into your repository, writes its skills to
`.claude/skills/lunamill-*/` and its agents to
`.claude/agents/lunamill-*.md`. Your own skills go in
`.claude/skills/NAME/SKILL.md` and your own agents in
`.claude/agents/NAME.md`, as for any Claude Code project. A plugin names
one under [`plugins`](../reference/settings/plugins.md#plugins) in
`.claude/lunamill.yaml`, with `skill:` for a folder in `.claude/skills/`
and `agent:` for a file in `.claude/agents/`. An agent's description is
the `description` in its file's front matter.

A colon, as in `/lunamill:refine`, is something Claude Code adds to a
skill that comes from a plugin. Plain skill files get plain names, so the
prefix `lunamill-` is part of the name. It also shows, in `.claude/skills/`,
which files an update will overwrite and which are yours. The package is
still laid out as a valid Claude Code plugin, so loading the skills from
it instead of copying them stays possible.

**Your project's instructions** are its `CLAUDE.md` files: the one at the
root, and any beside the code they govern. The skills read the rules for
each area from them. How to check a change is not there: it is
[`commands.gate`](../reference/settings/commands.md#commandsgate) in your settings.
`sync` adds one line to the root `CLAUDE.md`, which loads lunamill's
rules.

## You need

Claude Code, signed in. Check it with `claude --version`, which prints
its version. If it is not ready,
[install it](https://claude.com/claude-code), run `claude`, and sign in.

## Set it up

`lunamill init` writes everything under [What setup adds](#what-setup-adds),
and asks for the Claude token when you turn on the automated review or
builds in the cloud ([Tokens and secrets](#tokens-and-secrets)).

## What setup adds

This is the one list of every file setup writes in your repository, for
every tool lunamill uses, with what
[removing it](../maintain/removing.md) does with each. What setup adds on
the code host and the board is on [GitHub](github.md#what-setup-adds) and
[GitHub Projects](github-projects.md#what-setup-adds).

### In your repository

| What                                                                            | Added by                                                           | Removing it                                                    |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| `.claude/lunamill.yaml`, your settings                                          | Setup                                                              | Deletes it                                                     |
| `.claude/lunamill.lock`                                                         | Setup                                                              | Deletes it                                                     |
| `.claude/lunamill/`, the rules                                                  | Setup                                                              | Deletes it                                                     |
| `.claude/skills/lunamill-*/`                                                    | Setup                                                              | Deletes them                                                   |
| `.claude/agents/lunamill-*.md`                                                  | Setup                                                              | Deletes them                                                   |
| Six hook entries in `.claude/settings.json`                                     | Setup                                                              | Removes those six, keeps the rest, and deletes an emptied file |
| One folder under `permissions.additionalDirectories` in `.claude/settings.json` | Setup                                                              | Removes it, keeps the rest                                     |
| `attribution` in `.claude/settings.json`, when the file had none                | Setup                                                              | Leaves it: delete the key to get Claude Code's lines back      |
| One line in `CLAUDE.md`                                                         | Setup                                                              | Removes that line, and deletes an emptied file                 |
| `.github/workflows/lunamill.yml` and `.github/workflows/lunamill-review.yml`    | Setup                                                              | Deletes them                                                   |
| `.github/lunamill-review.md`                                                    | Setup                                                              | Deletes it                                                     |
| `.github/review-notes.md`                                                       | You, if you wrote one. It is yours                                 | Leaves it                                                      |
| A small `package.json`, and `node_modules/` in `.gitignore`, if you had none    | Setup, only before a spec tool that npm installs, such as OpenSpec | Leaves them. Delete them if nothing else uses them             |

The "Removing it" column says what `lunamill remove` does with each.

`sync` sets `attribution` in `.claude/settings.json` to leave out
Claude Code's own "Co-Authored-By" and "Generated with" lines, so a
session's commits and pull requests carry only the person's name. It
leaves an `attribution` you set yourself alone.

The list holds files only, since lunamill itself is not one of your
repository's dependencies. Nothing of lunamill's own is installed in
the repository: no
`package.json` entry, no `package-lock.json`, and no `node_modules/`. The
`lunamill` command is installed once on each machine
([Which version runs](../get-started/install.md#which-version-runs)).

## Tokens and secrets

The automated review, the approval policies' agents, and builds in the
cloud read a Claude token from a secret, `CLAUDE_CODE_OAUTH_TOKEN`, or an
API key as `ANTHROPIC_API_KEY`. Sessions on your machine use your own
sign-in.

What pays for builds in the cloud is a Claude subscription or an API
key, and `lunamill init --org` asks which. For a subscription it runs
`claude setup-token`, and you paste the token it prints, the line that
starts `sk-ant-oat01-`, which is stored as `CLAUDE_CODE_OAUTH_TOKEN`. An
API key you paste, and it is stored as `ANTHROPIC_API_KEY`.

### When the Claude token's year is up

For whoever stored the Claude token: you on your own account, or an
owner of the organization. A token that `claude setup-token` makes lasts
a year. After that, the automated review, the approval policies' agents,
and builds in the cloud stop, and each of their runs fails with an error
that names `CLAUDE_CODE_OAUTH_TOKEN`. If what you stored was an API key
instead, the secret is named `ANTHROPIC_API_KEY`. A key has no fixed
life, and nothing here applies to it.

**To see when it ends,** run `lunamill doctor`. More than a month before
the day, it prints a line like this one, for a token stored on
2026-11-16, under `GitHub Actions`:

```text
✓ CLAUDE_CODE_OAUTH_TOKEN stops working by 2027-11-16, a year after it was stored
```

It counts from the day the token was stored in the repository, or, when
your machine holds the day you pasted it and that is earlier, from that
day. A teammate's line can then give a later day than yours.

In its last 30 days, `lunamill doctor` and `lunamill status` print it with
a `?` instead. It is a warning: nothing has stopped yet. A session shows
it to you when it starts. For a token stored on 2025-12-10:

```text
? CLAUDE_CODE_OAUTH_TOKEN stops working by 2026-12-10, in 13 days. Run lunamill init to replace it
```

In a repository an organization owns, it ends
`An owner of acme runs lunamill init --org to replace it` instead. Once
the day has passed, `lunamill doctor` marks the line ✗ and fails, so a
script that runs it stops.

**To replace it on your own account,** run `lunamill init` in the
repository that printed the line. It asks `Make a new one now?`. Press
Enter, and it runs `claude setup-token`, which may open your browser to
sign in to Claude. If the browser gives you a code, that code goes
to `claude setup-token`, not to `lunamill init`. Once
`claude setup-token` has finished, copy the token it printed, the line
that starts `sk-ant-oat01-`: that is the one `lunamill init` waits for.
**It worked when** it prints
`Stored for sam/notes, and on this machine for your next repository.`

Each of your other repositories still holds the old token, and its
review and builds stop on the old day. Run `lunamill init` in each. It
asks
`Store the one on this machine, pasted on 2026-11-27, in its place?`,
which is the token you just made: press Enter, and it stores it with
nothing to paste. **It worked when** it prints
`✓ Stored 1 secret for sam/blog from this machine.`

`lunamill init` never copies a token from your machine into a repository
once it stops working in 30 days or fewer. It asks you to make a new
one, as above.

**To replace it in an organization,** an owner of the organization runs
`lunamill init --org acme`, signed in to the GitHub CLI as themselves, as
when they [set it up](../setup/organization.md#set-an-organization-up-once). It
asks `Replace it now?`. Press Enter, and it runs `claude setup-token`;
paste the `sk-ant-oat01-` token it prints, as in the step above. Every
repository the organization shares the secret with reads the new one
from then on. **It worked when** `lunamill doctor`, in any of those
repositories, prints the ✓ line with a day a year from today.

A developer who is not an owner cannot replace it. The organization's
owners are listed on its People page on GitHub, under the Owner role.

**A run that failed** because of the old token passes once the new one
is stored: re-run it from its page on the Actions tab.

## What lunamill can and cannot do there

### Hooks

`sync` adds six hooks to `.claude/settings.json`. They run inside Claude
Code sessions in this repository on a machine, not in your own terminal, and
not in a session in the cloud, where no hook runs. Each runs the `lunamill`
command installed on the machine. On a machine without it, the hooks before
a shell command and before a file is read block the call, and they and the
hook at a session's start say how to install it ([Which version
runs](../get-started/install.md#which-version-runs)).

| Hook                                                      | What it does                                                                                                                                                                                   |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Before a shell command                                    | Blocks a commit on your default branch, a push to it, and a force push. Runs your [`commands.before-commit`](../reference/settings/commands.md#commandsbefore-commit) commands before a commit |
| Before posting ticket text                                | Refuses text with a bare `<tag>`, which GitHub would silently drop                                                                                                                             |
| When a reviewer starts or stops                           | Records the run on the ticket, so its cost is counted                                                                                                                                          |
| Before an unattended build writes a file under `.claude/` | Approves the write, when the run is one lunamill started and the file is not `.claude/settings.json` or `.claude/settings.local.json`                                                          |
| When a session starts                                     | Shows unfinished branches and where each ticket stands                                                                                                                                         |
| Before a file is read, searched, or listed                | Refuses a call that opens lunamill's credentials file on your machine, which only lunamill's commands read ([The file on your machine](../security/credentials.md#the-file-on-your-machine))   |

The hook that approves an unattended build's writes under `.claude/`
matters only on a machine, since no hook runs in the cloud: a session
there writes such a file with a command instead. Either way, the change
is not live until you merge it. A pull request that changes a file under
`.claude/` always waits for you, whatever
[`auto-merge`](../reference/settings/auto-merge.md#auto-merge) allows, and
until it merges, every session in the cloud follows your default
branch's copy of those files.

A session Claude hosts, such as Claude Code on the web, is a machine of
its own, so the hooks there need the `lunamill` command too. Put the
install line, `npm install -g @lunamill-ai/lunamill`, in its
environment's setup: without the command, the hooks stop the session's
commands. With it, the hooks run, and the commands that read only the
repository work, such as `lunamill sync`, `lunamill config check`, and
`lunamill gate`
([Limits that come from Claude Code](#limits-that-come-from-claude-code)
has the ones that don't).

## Limits that come from Claude Code

- **A token that `claude setup-token` makes lasts a year**
  ([When the Claude token's year is up](#when-the-claude-tokens-year-is-up)).
- **Claude Code's sandbox is not a complete isolation boundary.** Its
  documentation says: "Sandboxing reduces risk but is not a complete
  isolation boundary."
- **A session Claude hosts, such as Claude Code on the web, can't reach
  GitHub's GraphQL API,** which is closed there. So the commands that
  need it do not work in one: the board commands, `lunamill status`, and
  the ticket commands. `lunamill build N` works, since it only asks GitHub
  to start a workflow ([Hooks](#hooks) says what such a session needs
  first).
- **Untested: whether `claude setup-token` ends Claude Code's own
  sign-in.** Once, Claude Code's sign-in on the machine expired within an
  hour of `claude setup-token`, which both setup commands run when a
  subscription pays for sessions. Claude Code's documentation does not
  say whether one affects the other. If a later step says the session
  expired, run `claude` and sign in again.

## When something goes wrong

A run in the cloud that fails with an error naming
`CLAUDE_CODE_OAUTH_TOKEN`: its token's year is up. Replace it as
[When the Claude token's year is up](#when-the-claude-tokens-year-is-up)
says, then re-run it.

A session on your machine that blocks every shell command and file read,
and says how to install the `lunamill` command: the command is not
installed on that machine ([Hooks](#hooks)).

## By hand

Nothing: `lunamill sync` writes every file and hook above.
