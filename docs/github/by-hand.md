# Setting up on GitHub by hand

Every step [`factory init`](setup.md) takes, for someone who cannot run it
or wants to see what it does. If you can run `init`, do that: it does all
of this for you. Here you do [the basics](#the-basics), then only the
parts you want, in the order they appear.

## Choose what you want

The basics are all the [quick start](../quick-start.md) needs. Everything
else is optional, and each part stands alone. You need the tools under
[What you need](setup.md#what-you-need), and the package
[installed](../quick-start.md#1-install).

| Part                                                                        | What it takes                                                      |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [The basics](#the-basics)                                                   | A settings file and one command                                    |
| [The automated review](#the-automated-review)                               | The Claude GitHub App, a workflow file, and your Claude token      |
| [A board](#a-board)                                                         | A Project, one setting, and a GitHub token                         |
| [Builds in the cloud](#builds-in-the-cloud)                                 | Your Claude token and a GitHub token                               |
| [Pull requests that merge themselves](#pull-requests-that-merge-themselves) | A list of files, one repository setting, and a second GitHub token |
| [Signed commits from cloud builds](#signed-commits-from-cloud-builds)       | A signing key                                                      |

[Run `factory init`](setup.md#run-factory-init) says what each part gives
you. Every part's secrets are gathered in [Secrets](#secrets), so you can
make them all at once.

## The basics

If you followed the quick start, this is done.

1. Write `.claude/factory.yaml`, with your repository's owner and name:

   ```yaml
   version: 2
   repository: your-name/your-repo
   ```

2. Write the factory's files:

   ```bash
   factory sync
   ```

   It writes the skills, agents, and rules Claude Code loads, under
   `.claude/`; adds hook entries to `.claude/settings.json`; adds one line
   to `CLAUDE.md`; and writes the workflows under `.github/workflows/`.
   [What lives where](reference.md) names each.

3. List the commands that check a change, such as your tests and linter,
   under [`commands.gate`](../configuration.md#commandsgate). A build runs
   them, and cannot finish without them:

   ```yaml
   commands:
     gate:
       - npm test
       - npm run lint
   ```

4. Optionally, list commands to run before every commit a session makes,
   under
   [`commands.before-commit`](../configuration.md#commandsbefore-commit),
   in the same block:

   ```yaml
   commands:
     before-commit:
       - npm run lint
   ```

5. Check, commit, and merge:

   ```bash
   factory sync --check
   factory config check
   git switch -c set-up-factory && git add -A
   git commit -m "Set up the software factory"
   git push -u origin set-up-factory
   gh pr create --fill
   ```

   Merge the pull request on GitHub, then switch to your default branch
   and pull, such as `git switch main && git pull`, and start a new Claude
   Code session.

**It worked when** typing `/factory` in the new session offers
`/factory-refine` and `/factory-build`.

Every part below is turned on the same way: add its settings to
`.claude/factory.yaml`, run `factory sync`, do the steps
the part lists, and merge what `sync` wrote.

## The automated review

Claude reads every pull request once it is marked ready, comments on what
it finds, and posts a verdict. The session that built the pull request
answers each comment, fixing it or rejecting it with evidence.

It is on while `.claude/factory.yaml` has
[`pr-review`](../configuration.md#pr-review). Three files have similar
names, and `sync` writes all three:

| File                                           | What it is                                                 |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `.github/workflows/factory-claude-review.yml`  | The workflow that runs the review                          |
| `.github/factory-review.md`                    | The review's instructions                                  |
| `.github/workflows/factory-review-verdict.yml` | Turns each review's summary into a "Review verdict" status |

1. **Install the Claude GitHub App** on the repository, from
   <https://github.com/apps/claude>. The review posts its comments through
   it. Or run `/install-github-app` in Claude Code, which installs the app
   and also stores the Claude token for you.
2. **Store your Claude token** as `CLAUDE_CODE_OAUTH_TOKEN`
   ([Secrets](#secrets)), unless step 1 did.
3. **Write `pr-review` in `.claude/factory.yaml`,** and run
   `factory sync`, which writes the three files above:

   ```yaml
   pr-review:
     commands:
       - npm test
       - npx tsc --noEmit
   ```

   Each command under it is one the reviewer may run to confirm a finding,
   such as your tests. To let it run nothing of yours, write the key
   alone, and it reads the pull request and comments:

   ```yaml
   pr-review:
   ```

   The workflow installs your project with `npm ci`, and chooses the
   model from `FACTORY_BUILD_MODEL` ([Variables](reference.md#workflows))
   when it is set.

4. **Optionally, write `.github/review-notes.md`:** what a reviewer must
   know about your project that your `CLAUDE.md` does not say. The
   reviewer reads it when it exists.
5. **To make the verdict count,** add "Review verdict" to the required
   status checks of your default branch: Settings, then Rules or Branches.
   Until you do, it is information only.

**It worked when** a pull request you mark ready gets Claude's comments
and a "Review verdict" status in its checks.

## A board

A GitHub Project that shows each ticket's state as a column, which session
has it, and what it has cost. [Workflow](../workflow.md#the-board) says
what each column means.

1. **Create a Project** under the account or the organization that owns the
   repository: its Projects tab, "New project", Board layout. Link it to
   the repository from the Project's menu, so it shows on the repository's
   Projects tab. Its number is the last part of its address.
2. **Give it the factory's columns:** Backlog, In refinement, Ready, In
   progress, In review, and Done, in its Status field. A new Project starts
   with Todo, In Progress, and Done. To keep columns of your own, map them
   under [`tickets.columns`](../configuration.md#ticketscolumns) instead.
3. **Give it the three fields the sync writes:** Session, a Text field;
   Runs in, a single select with the options Local and Actions; and Cost, a
   Number. A field the sync does not find, it skips.
4. **Point the settings at it,** with the Project's number under
   [`tickets`](../configuration.md#tickets), and which column shows each
   state under [`tickets.columns`](../configuration.md#ticketscolumns),
   here the columns step 2 added:

   ```yaml
   tickets:
     board: 7
     columns:
       backlog: Backlog
       refining: In refinement
       ready: Ready
       building: In progress
       review: In review
       done: Done
   ```

   Then `factory board check` shows how it reads your
   columns.

5. **Store a GitHub token** as `FACTORY_BOARD_TOKEN` ([Secrets](#secrets)).
6. **Run `factory sync`.** It writes the board-sync
   workflow, the only thing that writes to the board. It never creates,
   renames, or removes a column or field.

## Builds in the cloud

`factory build 12` builds ticket 12 in GitHub Actions and
prints the run's link, with no session open on your machine.

`sync` already wrote the workflows these use, and each does nothing until
it has work and its secrets:

| Workflow                | What its Claude Code session does                                                    |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `factory-build.yml`     | Builds a ticket                                                                      |
| `factory-review.yml`    | Answers a review you submit on a pull request                                        |
| `factory-conflicts.yml` | Resolves a conflict between a pull request and your default branch                   |
| `factory-deps.yml`      | Moves Dependabot's pull requests along, written once `.github/dependabot.yml` exists |

1. **Store your Claude token** as `CLAUDE_CODE_OAUTH_TOKEN`.
2. **Store a GitHub token that can push**, as `FACTORY_BUILD_TOKEN`. With
   a board, `FACTORY_BOARD_TOKEN` stands in for it when it has the
   `workflow` scope, so one token does both ([Secrets](#secrets)).

**It worked when** `factory build 12`, with the number of a refined
ticket, prints a run's link, and the run opens a pull request.

A build may run for 230 minutes, which
[`session-minutes`](../configuration.md#session-minutes) changes; GitHub
stops any job at six hours.

### Starting builds from the board

To have a ticket build when you move its card to Ready on
[a board](#a-board), a small program, the poller, watches the board and
starts each build. Set
[`builds.trigger: github-action`](../configuration.md#builds) to run it on
a schedule in GitHub Actions, with nothing to host, or `own-server` to
host it yourself.
[Builds in the cloud](../builds.md) explains each and what it costs.

## Pull requests that merge themselves

A pull request that touches only files you listed as safe merges once
every check passes. Everything else still waits for you. Turn this on
last: it is only as safe as your tests and the review. Start with a short
list, such as documentation.

1. **List the files** under
   [`auto-merge.allow`](../configuration.md#auto-merge), with exceptions
   under `deny`:

   ```yaml
   auto-merge:
     allow:
       - docs/**
   ```

   Then run `factory sync`, which writes the merge-policy workflow. It
   labels each pull request `merge: automatic` or `merge: manual` and
   says why.

2. **Allow auto-merge** on the repository: Settings, General, "Allow
   auto-merge".
3. **Store a GitHub token** as `FACTORY_AUTOMERGE_TOKEN` ([Secrets](#secrets)).

**It worked when** a pull request that touches only files you listed gets
the `merge: automatic` label.

## Signed commits from cloud builds

Without a key, a build's commits are unsigned.

1. Make a key for this and nothing else, with no passphrase:

   ```bash
   ssh-keygen -t ed25519 -N "" -C "factory builds" -f factory-signing-key
   ```

2. Add `factory-signing-key.pub` to the GitHub account whose token the
   builds use: Settings, "SSH and GPG keys", "New SSH key", key type
   "Signing Key".
3. Store the private half, then delete both files:

   ```bash
   gh secret set FACTORY_SIGNING_KEY < factory-signing-key
   rm factory-signing-key factory-signing-key.pub
   ```

Anything that can run a workflow in the repository can read the key, as
it can the build token. Removing the public key from the account ends its
use.

**It worked when** the commits of the next build's pull request show as
"Verified".

## Secrets

Everything here is stored on the repository with `gh secret set NAME`,
which asks for the value. Nothing the factory runs on your machine needs
one; each is for something that runs in GitHub Actions.

| Secret                    | Needed for                                                                             | Make it                                                                                                                                                   |
| ------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE_CODE_OAUTH_TOKEN` | The automated review, and builds in the cloud                                          | `claude setup-token`, on your machine. It bills your Claude subscription                                                                                  |
| `FACTORY_BOARD_TOKEN`     | A board. Also builds in the cloud, when `FACTORY_BUILD_TOKEN` is not set               | [A classic token](https://github.com/settings/tokens/new?scopes=repo,project,workflow&description=factory%20board) with `repo`, `project`, and `workflow` |
| `FACTORY_BUILD_TOKEN`     | Builds in the cloud. Optional with a board token; used instead of it when both are set | [A classic token](https://github.com/settings/tokens/new?scopes=repo,workflow&description=factory%20builds) with `repo` and `workflow`                    |
| `FACTORY_AUTOMERGE_TOKEN` | Pull requests that merge themselves                                                    | [A classic token](https://github.com/settings/tokens/new?scopes=repo&description=factory%20auto-merge) with `repo`                                        |
| `FACTORY_SIGNING_KEY`     | Signed commits from cloud builds                                                       | [The steps above](#signed-commits-from-cloud-builds)                                                                                                      |

Each token link opens GitHub's page with the scopes checked; choose an
expiry date and generate it. The account that makes a token is the one
its work is done as, and must be able to write the repository, and the
Project for the board token.

**One GitHub token is enough for everything.** Make one classic token with
`repo` and `workflow`, and `project` when you have a board, and store it
under each name your parts read; `init` does the same. Any workflow a pull
request from the repository adds can read every secret, so separate tokens
protect little.

Builds and auto-merge also take a fine-grained token instead: read and
write access to Contents, Pull requests, Issues, and Workflows for builds,
and to Contents and Pull requests for auto-merge. The board token must be
classic.

To set them in one go, run the lines for your parts and paste each value
when asked. `claude setup-token` prints the first value, and the other
three lines can all take the same GitHub token:

```bash
claude setup-token
gh secret set CLAUDE_CODE_OAUTH_TOKEN   # the review, or builds in the cloud
gh secret set FACTORY_BOARD_TOKEN       # a board
gh secret set FACTORY_BUILD_TOKEN       # builds in the cloud, with no board
gh secret set FACTORY_AUTOMERGE_TOKEN   # pull requests that merge themselves
```

For a private npm registry, each variable your `.npmrc` reads is stored
twice, with `gh secret set NAME` and `gh secret set NAME --app dependabot`:
[Private npm packages](setup.md#private-npm-packages).

Two optional settings:

- **Paying by the token instead of a subscription:** store an API key from
  the [Claude Console](https://platform.claude.com) as `ANTHROPIC_API_KEY`.
  A workflow uses it when `CLAUDE_CODE_OAUTH_TOKEN` is not set.
- **The model a cloud session uses:** `gh variable set FACTORY_BUILD_MODEL`.
  This is a variable, not a secret.

Everything the factory owns starts with `FACTORY_`. The other two keep the
names Claude's GitHub Action gives them, since your other workflows may
use them too.

## Checking it

```bash
factory doctor
```

**It worked when** every check shows ✓, or `-` for a part you left off.
[Changing it later](setup.md#changing-it-later) says what it checks.
