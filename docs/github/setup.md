# Setting up on GitHub, with Claude Code

For someone setting the factory up with GitHub as the code host, GitHub
Issues for tickets, a GitHub Project for the board, GitHub Actions for
builds in the cloud, and Claude Code as the coding agent. One command sets
up the parts you choose. This page says what it asks you, and the little
it leaves for you to do.

## What you need

| Tool                                | Check it with      | If it is not ready                                                      |
| ----------------------------------- | ------------------ | ----------------------------------------------------------------------- |
| A GitHub repository, with Issues on | Its Issues tab     | On GitHub: Settings, General, Features, check "Issues"                  |
| The GitHub CLI, signed in           | `gh auth status`   | `gh auth login`                                                         |
| Claude Code, signed in              | `claude --version` | [Install it](https://claude.com/claude-code), run `claude`, and sign in |
| Node 22.18 or later                 | `node --version`   | [nodejs.org](https://nodejs.org)                                        |

## Run `factory init`

In your repository, with the package
[installed](../quick-start.md#1-install):

```bash
factory init
```

It shows what it found, then asks which parts you want. Each is optional
and stands alone:

| Part                                            | What you get                                                                   |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| An automated review of every pull request       | Claude reads each pull request once it is ready, comments, and gives a verdict |
| A board                                         | A GitHub Project showing each ticket's state, its session, and its cost        |
| Builds in the cloud                             | A ticket builds in GitHub Actions, with no session open on your machine        |
| Builds that start when you move a card to Ready | Moving a ticket's card to Ready on the board builds it                         |
| Pull requests that merge themselves             | A pull request that touches only files you listed merges once its checks pass  |
| Signed commits from cloud builds                | A build's commits show as "Verified"                                           |

On a first run the first three start checked. With none checked, you get
the basics: refining and building tickets in a Claude Code session on your
machine, which is all the [quick start](../quick-start.md) needs.

It then asks only what your parts need:

| Question                              | Asked when you chose                                                  | What you do                                                                                                 |
| ------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Which board                           | A board                                                               | Choose a new one, made with the factory's columns, or a Project you already have                            |
| Which files may merge without you     | Pull requests that merge themselves                                   | Type their patterns, such as `docs/**`. Start with a short list                                             |
| Where the poller runs                 | Builds that start from the board                                      | Choose a schedule on GitHub Actions or a server you host. [Builds in the cloud](../builds.md) compares them |
| The token `claude setup-token` prints | The review, and builds in the cloud                                   | It runs the command for you. Follow what it says, then paste the token it prints                            |
| A GitHub access token                 | A board, builds in the cloud, and pull requests that merge themselves | It opens GitHub's page with the right scopes checked. Choose an expiry, generate the token, and paste it    |

A token is typed into a masked prompt and goes straight to your
repository's secrets on GitHub. It is never printed or written to a file.
Leave a prompt empty to skip it, and run `init` again when you have the
token.

Before it changes anything, it lists everything it will do and asks "Go
ahead?". Then it does the rest itself: it writes the settings and the
factory's files, gives the board its columns and fields, stores each
secret, makes the signing key, allows auto-merge on the repository, and
requires the review's verdict before a merge to your default branch. It
commits nothing. [What it changes](../removing.md) lists every file.

**It worked when** the checks it prints last all show ✓, or `-` for a part
you left off.

## What is left for you

`init` ends with this list, under "Left to do":

| If you chose                                 | Do this                                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Anything, while your settings name no gate   | Add the commands that check a change, such as your tests and linter, under [`commands.gate`](../configuration.md#commandsgate). A build cannot finish without them |
| Anything                                     | Commit what it wrote on a branch, open a pull request, and merge it, as in [step 3 of the quick start](../quick-start.md#3-merge-the-setup)                        |
| The automated review                         | Install the Claude GitHub App on the repository, from <https://github.com/apps/claude>. The review posts its comments through it                                   |
| Builds from the board, on a server you host  | Run the poller's image with the four values `init` prints. [Hosting the poller](../builds.md#hosting-the-poller-own-server) has the steps                          |
| Signed commits, and it could not add the key | Add the public key it prints to the GitHub account that made the access token you pasted: Settings, "SSH and GPG keys", "New SSH key", key type "Signing Key"      |

## Optional: tune it

Each is a few lines in `.claude/factory.yaml`, merged like any change.

- **Let the review run your tests.** `init` writes
  [`pr-review`](../configuration.md#pr-review) with no commands, so the
  reviewer reads the pull request and runs nothing of yours. To let it
  confirm a finding by running something, list each command:

  ```yaml
  pr-review:
    commands:
      - npm test
      - npx tsc --noEmit
  ```

- **Run a command before every commit a session makes,** such as your
  linter, under
  [`commands.before-commit`](../configuration.md#commandsbefore-commit):

  ```yaml
  commands:
    before-commit:
      - npm run lint
  ```

- **Tell the reviewer what your `CLAUDE.md` does not say** about your
  project, in a file you write, `.github/review-notes.md`. The reviewer
  reads it when it exists.

[Configuration](../configuration.md) has every setting.

## Changing it later

Run `factory init` again to turn a part on or off. It starts from what you
have, and does not ask again for a secret that is already set.

```bash
factory doctor
```

runs the checks again at any time: the settings, the factory's files, the
installed version, who the GitHub CLI is signed in as, that each secret
your parts read is set, and the board's columns. GitHub never lets a
secret be read back, so a wrong one shows when the first run that needs it
fails, naming it.

## Doing it by hand

[Setting up on GitHub by hand](by-hand.md) has every step `init` takes,
and every secret with the scopes it needs, for anyone who cannot run
`init` or wants to see what it does.
