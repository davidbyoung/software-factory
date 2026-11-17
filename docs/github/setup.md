# Setting up on GitHub, with Claude Code

Every step to set the factory up with GitHub as the code host, GitHub
Issues for tickets, a GitHub Project for the board, GitHub Actions for
builds in the cloud, and Claude Code as the coding agent. One command does
all of it; the rest of the page is the same setup by hand.

## What you need

| Tool                                | Check it with      | If it is not ready                                                      |
| ----------------------------------- | ------------------ | ----------------------------------------------------------------------- |
| A GitHub repository, with Issues on | Its Issues tab     | On GitHub: Settings, General, Features, check "Issues"                  |
| The GitHub CLI, signed in           | `gh auth status`   | `gh auth login`                                                         |
| Claude Code, signed in              | `claude --version` | [Install it](https://claude.com/claude-code), run `claude`, and sign in |
| Node 22.18 or later                 | `node --version`   | [nodejs.org](https://nodejs.org)                                        |

## Setting it up with one command

In your repository, with the package installed:

```bash
factory init
```

It says what it found, asks which parts you want, and shows everything it
will do before it does any of it. On a first run the automated review, a
board, and builds in the cloud start checked: uncheck the board unless you
want one made on your account. Told to go ahead, it writes the settings
and the factory's files, makes or connects the board with its columns and
fields, stores every secret your parts need, and turns on the repository
settings they need. It commits nothing, and ends with what is left for you
and the checks `factory doctor` runs.

Run it again to turn a part on or off. It starts from what you already
have, and does not ask again for a secret that is already set.

A token is typed into a masked prompt and goes straight to GitHub; it is
never printed or written to a file.

## Setting it up by hand

For anyone who cannot run `init`, or who wants to see what it does. Do
[the basics](#the-basics), then only the parts you want, in the order they
appear.

### Choose what you want

The basics are all the [quick start](../quick-start.md) needs. Everything
else is optional, and each part stands alone.

| Part                                                                        | What you get                                                                    | What it takes                                                      |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [The basics](#the-basics)                                                   | Refining and building tickets in a Claude Code session on your machine          | A settings file and one command                                    |
| [The automated review](#the-automated-review)                               | Claude reads every pull request once it is ready, comments, and gives a verdict | The Claude GitHub App, a workflow file, and your Claude token      |
| [A board](#a-board)                                                         | A GitHub Project showing each ticket's state, its session, and its cost         | A Project, one setting, and a GitHub token                         |
| [Builds in the cloud](#builds-in-the-cloud)                                 | A ticket builds in GitHub Actions, with no session open on your machine         | Your Claude token and a GitHub token                               |
| [Pull requests that merge themselves](#pull-requests-that-merge-themselves) | A pull request that touches only files you listed merges once its checks pass   | A list of files, one repository setting, and a second GitHub token |
| [Signed commits from cloud builds](#signed-commits-from-cloud-builds)       | A build's commits show as "Verified"                                            | A signing key                                                      |

Every part's secrets are gathered in [Secrets](#secrets), so you can make
them all at once.

### The basics

If you followed the quick start, this is done.

1. Write `.claude/factory.yaml`, with your repository's owner and name:

   ```yaml
   version: 1
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

3. Say in your `CLAUDE.md` how to check a change, such as the commands for
   your tests and linter. A build runs them.
4. Optionally, list commands to run before every commit a session makes:

   ```yaml
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

   Merge the pull request on GitHub, then `git switch main && git pull`,
   and start a new Claude Code session.

**It worked when** typing `/factory` in the new session offers
`/factory-refine` and `/factory-build`.

Every part below is turned on the same way: add its settings to
`.claude/factory.yaml`, run `factory sync`, do the steps
the part lists, and merge what `sync` wrote.

### The automated review

Claude reads every pull request once it is marked ready, comments on what
it finds, and posts a verdict. The session that built the pull request
answers each comment, fixing it or rejecting it with evidence.

It is on while `.claude/factory.yaml` has
[`ci-review`](../configuration.md#ci-review), which `init` writes when you
choose it. Three files have similar names, and `sync` writes all three:

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
3. **Write `ci-review` in `.claude/factory.yaml`,** with the commands the
   reviewer may run to confirm a finding, such as your tests, and run
   `factory sync`. The workflow installs your project with
   `npm ci`, and chooses the model from `FACTORY_BUILD_MODEL`
   ([Variables](reference.md#workflows)) when it is set.
4. **Optionally, write `.github/review-notes.md`:** what a reviewer must
   know about your project that your `CLAUDE.md` does not say. The
   reviewer reads it when it exists.
5. **To make the verdict count,** add "Review verdict" to the required
   status checks of your default branch: Settings, then Rules or Branches.
   Until you do, it is information only.

### A board

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
4. **Point the settings at it:**

   ```yaml
   tickets:
     board: 7
   ```

   Then `factory board check` shows how it reads your
   columns.

5. **Store a GitHub token** as `FACTORY_BOARD_TOKEN` ([Secrets](#secrets)).
6. **Run `factory sync`.** It writes the board-sync
   workflow, the only thing that writes to the board. It never creates,
   renames, or removes a column or field.

### Builds in the cloud

`factory build 12` builds ticket 12 in GitHub Actions and
prints the run's link, with no session open on your machine.

`sync` already wrote the workflows these use, and each does nothing until
it has work and its secrets:

| Workflow                | Runs a Claude Code session that                                                      |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `factory-build.yml`     | builds a ticket                                                                      |
| `factory-review.yml`    | answers a review you submit on a pull request                                        |
| `factory-conflicts.yml` | resolves a conflict between a pull request and your main branch                      |
| `factory-deps.yml`      | moves Dependabot's pull requests along, written once `.github/dependabot.yml` exists |

1. **Store your Claude token** as `CLAUDE_CODE_OAUTH_TOKEN`.
2. **Store a GitHub token that can push**, as `FACTORY_BUILD_TOKEN`. With
   a board, `FACTORY_BOARD_TOKEN` stands in for it when it has the
   `workflow` scope, so one token does both ([Secrets](#secrets)).

A build may run for 230 minutes, which
[`session-minutes`](../configuration.md#session-minutes) changes; GitHub
stops any job at six hours.

#### Starting builds from the board

To have a ticket build when you move its card to Ready, set
`builds.trigger: own-server` and run the poller, a small program that
watches the board and starts each build. [Builds in the cloud](../builds.md)
explains how to host it and what it costs.

### Pull requests that merge themselves

A pull request that touches only files you listed as safe merges once
every check passes. Everything else still waits for you. Turn this on
last: it is only as safe as your tests and the review. Start with a short
list, such as documentation.

1. **List the files** under `auto-merge.allow`, with exceptions under
   `deny`. [Configuration](../configuration.md#auto-merge) explains the
   rules. `sync` then writes the merge-policy workflow, which labels each
   pull request `merge: automatic` or `merge: manual` and says why.
2. **Allow auto-merge** on the repository: Settings, General, "Allow
   auto-merge".
3. **Store a GitHub token** as `FACTORY_AUTOMERGE_TOKEN` ([Secrets](#secrets)).

### Signed commits from cloud builds

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

### Secrets

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

To set the ones you need in one go, paste each value when asked:

```bash
claude setup-token
gh secret set CLAUDE_CODE_OAUTH_TOKEN
gh secret set FACTORY_BOARD_TOKEN
gh secret set FACTORY_AUTOMERGE_TOKEN
```

Paste the same GitHub token for both of the last two.

Two optional settings:

- **Paying by the token instead of a subscription:** store an API key from
  the [Claude Console](https://platform.claude.com) as `ANTHROPIC_API_KEY`.
  A workflow uses it when `CLAUDE_CODE_OAUTH_TOKEN` is not set.
- **The model a cloud session uses:** `gh variable set FACTORY_BUILD_MODEL`.
  This is a variable, not a secret.

Everything the factory owns starts with `FACTORY_`. The other two keep the
names Claude's GitHub Action gives them, since your other workflows may
use them too.

### Checking it

```bash
factory doctor
```

It checks the settings, that the factory's files match them, the installed
version, who the GitHub CLI is signed in as, that each secret your parts
read is set, and the board's columns. GitHub never lets a secret be read
back, so a secret is checked only for being set: a wrong one shows when
the first run that needs it fails, naming it.
