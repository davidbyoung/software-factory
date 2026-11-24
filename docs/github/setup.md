# Setting up on GitHub, with Claude Code

For someone setting the factory up with GitHub as the code host, GitHub
Issues for tickets, a GitHub Project for the board, GitHub Actions for
[builds](../glossary.md) in the cloud, and Claude Code as the coding
agent. Start where this table sends you:

| Who you are                                             | Where to start                                                                            | What you have at the end                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| One person, with repositories on your own account       | [Run `factory init`](#run-factory-init), then [On your own account](#on-your-own-account) | A pull request that sets your repository up, with the parts you chose      |
| A developer in an organization that an owner has set up | [Run `factory init`](#run-factory-init), then [In an organization](#in-an-organization)   | The same pull request, with no token pasted                                |
| An owner of an organization that is not set up yet      | [Set an organization up, once](#set-an-organization-up-once)                              | An organization whose developers each set a repository up with one command |

## What you need

| Tool                                | Check it with                        | If it is not ready                                                      |
| ----------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- |
| A GitHub repository, with Issues on | Its Issues tab                       | On GitHub: Settings, General, Features, check "Issues"                  |
| The GitHub CLI, signed in           | `gh auth status`                     | `gh auth login`                                                         |
| Claude Code, signed in              | `claude --version`                   | [Install it](https://claude.com/claude-code), run `claude`, and sign in |
| Node 22.18 or later                 | `node --version`                     | [nodejs.org](https://nodejs.org)                                        |
| The `factory` command               | `factory`, which prints its commands | [Install it](../quick-start.md#1-install), once on your machine         |

Nothing of the factory's is installed in a repository. Without Claude
Code, `factory init` stops and changes nothing.

## Run `factory init`

In the repository you are setting up:

```bash
factory init
```

It names the repository on its first line, which it works out from your
checkout's remotes. When they hold a fork, or more than one repository,
it asks which one you are setting up. It stops when your checkout has
commits the default branch lacks, so run it from the default branch.

Before it asks anything else, it reads [presets](../presets.md), the
settings several repositories share, and it asks only what they leave
open. It looks for a repository named `factory-config` in your account
or your organization, and asks which of its presets this repository
follows. When there is none, it offers the presets your machine last
followed there. To name the presets yourself, give each one with
`--preset`, as in `factory init --preset acme/platform-settings`. For
each preset you follow, it prints what that preset changes here, as
[`factory preset add`](../presets.md#adding-a-preset) does.

It asks which parts you want, less any that a preset or a stored secret
decides. Each is optional. With none, you refine and build tickets in a
[session](../glossary.md) on your machine, as the
[quick start](../quick-start.md) does:

| Part                                            | What you get                                                                                                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An automated review of every pull request       | Claude reads each pull request once it is ready, comments, and gives a verdict. It posts as `github-actions`, so there is no app of Claude's to install |
| A board                                         | A GitHub Project showing each ticket's state, its session, and its cost                                                                                 |
| Builds in the cloud                             | A ticket builds in GitHub Actions, with no session open on your machine                                                                                 |
| Builds that start when you move a card to Ready | Moving a ticket to Ready on the board builds it                                                                                                         |
| Pull requests that merge themselves             | A pull request that touches only files you listed merges once its checks pass                                                                           |
| Signed commits from cloud builds                | A build's commits show as "Verified". Not offered in an organization's repository                                                                       |

It asks these, and skips any that a preset or your settings already
answer:

| Question                                         | When it is asked                                                                                     | What you do                                                                                                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What to name the branch a build pushes           | Always                                                                                               | Press Enter for `{ticket}`, so ticket 12 is built on a branch named `12`, or type your team's pattern, such as `feature/{user}/{ticket}` ([`code-host`](../configuration.md#code-host)) |
| Which spec tool you use                          | Always                                                                                               | Choose None, unless you want OpenSpec to keep a folder in your repository that describes what your project does ([`specs`](../configuration.md#specs))                                  |
| Which board                                      | With "A board"                                                                                       | Choose a new one, made with the factory's columns, or a Project you already have                                                                                                        |
| Which files may merge without you                | With "Pull requests that merge themselves"                                                           | Type their patterns, such as `docs/**`. Start with a short list                                                                                                                         |
| Where [the poller](../builds.md#the-poller) runs | With "Builds that start when you move a card to Ready"                                               | Choose a schedule on GitHub Actions or a server you host. [Builds in the cloud](../builds.md) compares them                                                                             |
| Which command checks a change                    | Always                                                                                               | Type it, such as `npm test`. A build cannot finish without one ([`commands.gate`](../configuration.md#commandsgate))                                                                    |
| The token `claude setup-token` prints            | On your own account, with "An automated review of every pull request" or "Builds in the cloud"       | Init runs the command for you. Follow what it says, then paste the token it prints, as it is: init joins a token the terminal wrapped across lines                                      |
| A GitHub access token                            | On your own account, with "A board", "Builds in the cloud", or "Pull requests that merge themselves" | Init opens GitHub's page with the right scopes checked. Choose an expiry, generate the token, and paste it                                                                              |
| The token your `.npmrc` reads                    | When `.npmrc` reads one ([Private npm packages](#private-npm-packages))                              | Paste a token that can only read from your registry                                                                                                                                     |

Before it changes anything, it lists what it will do and asks "Go
ahead?". Type `y`: Enter alone answers no, and nothing changes. Then it
writes the settings and the factory's files
([What it changes](../removing.md) lists them), runs the commands that
check a change, asks for each token, commits what it wrote on a new
branch, `set-up-factory`, pushes it, and opens the pull request. When a
check fails, it commits nothing.

```text
✓ npm run check passes here.
✓ Opened acme/web#41, "Set up the software factory".
Merge it to finish. Nothing else is left to do.
```

Merge the pull request, then switch back to your default branch and
pull, since your checkout is left on `set-up-factory`. With the review
on, the first workflow run after the setup pull request merges requires
"Review verdict", the status the automated review's verdict sets on a
pull request. From then on, a pull request cannot merge until the review
passes it.

**It worked when** init printed `✓ Opened` with the pull request's
number, and, after the merge, `factory doctor` shows ✓ on every line, or
`-` for a part you left off.

### On your own account

The [steps above](#run-factory-init) ask you for two tokens, when a part
you chose reads one: the GitHub access token and the Claude token. Each
is typed into a masked prompt, stored in the repository's secrets, and
kept on your machine, so your next repository asks for neither
([Where your tokens are kept](../credentials.md#on-github)). Leave a
prompt empty to skip it, and run `factory init` again when you have the
token. To share settings between your repositories, put a preset in a
repository named `factory-config`
([Writing a preset](../presets.md#writing-a-preset)).

**It worked when** init prints the first line here, and in your next
repository the second:

```text
It belongs to sam. Stored for sam/api, and on this machine for your next repository.
✓ Stored 2 secrets for sam/web from this machine.
```

### In an organization

The [steps above](#run-factory-init) ask you for no token. Under
"Found", the `Organization` row reads one of three ways:

```text
  Organization     acme, set up: its app's key and its Claude token are stored
  Organization     acme, not set up: an owner runs factory init --org https://github.com/acme
  Organization     acme, set up, but its secrets do not reach this repository: GitHub Free shares them only with public repositories, or an owner narrowed them
```

- **With the first,** init lists the presets in the organization's
  `factory-config`, and you check the ones this repository follows. It
  offers "Pull requests that merge themselves", and any other part the
  presets leave open.
- **With the second or the third,** init leaves the review and builds in
  the cloud off, and builds on your machine work. For the second, ask an
  owner of the organization to
  [set it up](#set-an-organization-up-once). For the third, ask an owner
  of the organization, or store a GitHub token and a Claude token in the
  repository's secrets by hand, as [Secrets](by-hand.md#secrets) says.
  Then run `factory init` again.

**It worked when** the row is the first, and your first build in the
cloud opens its pull request. If that build fails with the line below,
the organization's App is not installed on your repository, and the page
it names is where an owner of the organization adds it:

```text
The software factory's app for acme is not installed on acme/web. An owner of acme adds it: https://github.com/organizations/acme/settings/installations
```

## Set an organization up, once

For an owner of the organization, with the GitHub CLI signed in, Claude
Code, and the `factory` command ([What you need](#what-you-need)). You
need no repository. Give the organization's address, from any folder:

```bash
factory init --org https://github.com/acme
```

When the GitHub CLI's sign-in lacks a permission the command needs,
which are `admin:org`, `project`, and `workflow`, it first asks to open
your browser so you can grant it.

It asks which board to use, and what pays for
[builds in the cloud](../builds.md): a Claude subscription, for which it
runs `claude setup-token` and you paste the token it prints, or an API
key, which you paste. The command creates a repository named
`factory-config` in the organization, to hold the settings its
repositories share. It is private, except on GitHub's Free plan. When it
is private, the command also asks how often
[the poller](../builds.md#the-poller) reads the board, because each run
of the poller then bills at least one Actions minute. Then it lists what
it will do and asks "Go ahead?", where Enter alone answers no. After
`y`, it prints:

```text
✓ Created board 12, "Software factory".
✓ Created acme/factory-config.
Opened GitHub in your browser. Press "Create GitHub App", then "Install".
If the page it sends you to does not load, paste that page's address here:
✓ Registered the app and installed it on 212 repositories.

The coding agent's token: running claude setup-token...
? Paste the token it printed (leave empty to do this later):
✓ Stored 2 secrets and 1 variable for acme.
✓ Required "Review verdict" where the property software-factory is "on".

A developer sets a repository up with: factory init
```

You do two things in the browser:

1. On the form the command has filled in, press **Create GitHub App**.
   If GitHub says the name is taken, change it first. GitHub then sends
   your browser back to the command. If that page does not load, as when
   you reach the machine over SSH, paste its address into the terminal,
   where the command waits for it.
2. On the next page, choose all repositories, or a selection that
   includes `factory-config`, and press **Install**.
   [Who can use the App's key](../credentials.md#on-github) says what
   that choice decides.

**It worked when** it prints the last line above. It leaves you with:

| What it created                                                                                         | Where to find it                                            |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| The GitHub App "Software Factory for acme", which builds in the cloud act as                            | The organization's Settings, GitHub Apps                    |
| Two secrets and a variable, which [Where your tokens are kept](../credentials.md#on-github) names       | The organization's Settings, Secrets and variables, Actions |
| The repository `acme/factory-config`, with the organization's preset and its one poller                 | Among the organization's repositories                       |
| The rule "Software factory", which requires "Review verdict" in each repository set up with the factory | The organization's Settings                                 |
| A board with the factory's columns and fields, or the board you chose with those it lacked              | The organization's Projects                                 |

The preset, `factory-preset.yaml`, is yours to edit. To use columns of
your own on the board, change
[`tickets.columns`](../configuration.md#ticketscolumns) there, as
[You already have a board](../existing-repo.md#you-already-have-a-board)
shows for a repository.

**To run it again,** as after a run that stopped, give the same command.
It does only what is missing, and offers to replace the Claude token,
which expires. Where the App is registered and not installed yet, it
opens the organization's list of apps: press the App's name, then
**Install App**. **It worked when** it prints
`✓ acme is set up. Nothing to do.`

Three things stay by hand, on GitHub:

| When this happens                                              | What you do                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The App's key has to be replaced                               | Follow [Replacing the App's key](../credentials.md#replacing-the-apps-key)                                                                                                                                                                                             |
| A run fails because the App is not installed on its repository | The failed run prints the address of the organization's installations page. Add the repository there. A ticket moved to Ready in such a repository starts no build and gets no comment: the poller's run in `factory-config` shows a warning that names the repository |
| A later release of the factory needs a new permission          | In the organization's Settings, GitHub Apps, GitHub shows a request to review beside the App after such a release. Accept it                                                                                                                                           |

### On GitHub's Free plan

The `Plan` row under "Found" says when the organization is on it. Then
`factory-config` is public, so anyone can read the shared settings in
it. A private repository gets no review and no builds in the cloud,
since the organization's secrets do not reach it. And there is no
organization-wide rule, so once each repository's setup merges, an admin
of that repository runs `factory init` again, which requires "Review
verdict" there.

## What is left for you

When nothing is left, `init` prints
`Merge it to finish. Nothing else is left to do.` after the pull
request's line. Otherwise it says what is left:

| When this happens                                                                  | Do this                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| You left the gate question empty                                                   | Add the commands that check a change, such as your tests and linter, under `commands.gate`. A build cannot finish without them                                                                                                                                                 |
| "Left to do" says an admin runs `factory init` once the pull request merges        | Merge it, then run `factory init` again, as an admin of the repository, to require "Review verdict". No workflow run could: the organization has no organization-wide rule ([On GitHub's Free plan](#on-githubs-free-plan)), or your own repository has no GitHub token stored |
| You chose "Builds that start when you move a card to Ready", on a server you host  | Run the poller's image with the values `init` prints. [Hosting the poller](../builds.md#hosting-the-poller-own-server) has the steps                                                                                                                                           |
| You chose "Signed commits from cloud builds", and it could not add the key         | Add the public key it prints to the GitHub account that made the access token you pasted: Settings, "SSH and GPG keys", "New SSH key", key type "Signing Key"                                                                                                                  |
| You chose "Pull requests that merge themselves", and it could not allow auto-merge | An admin of the repository allows it: Settings, General, "Allow auto-merge"                                                                                                                                                                                                    |
| The repository is public, and it could not add the policy                          | Let `.github/workflows/factory.yml` run on `pull_request_target`, in your repository's Settings, Actions, Policies. [By hand](by-hand.md#a-public-repository) has each field                                                                                                   |
| GitHub refused the push or the pull request                                        | Push the branch `set-up-factory`, where init left its commit, if it is not pushed, and open the pull request yourself                                                                                                                                                          |

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
have, and does not ask again for a secret that is already set. When it
changes a file, it opens a pull request titled "Change the software
factory's settings", which you merge as you did the first.

```bash
factory doctor
```

runs the checks again at any time: the settings, the factory's files, the
version your repository names and whether a newer one is released, each
[preset](../presets.md)'s pin, who the GitHub CLI is signed in as, that
each secret your parts read is set, those for
[private npm packages](#private-npm-packages), the board's columns, and,
with the review on, whether "Review verdict" is required before a merge
to your default branch, here `main`:

```text
✓ "Review verdict" is required before a merge to main
✗ "Review verdict" is not required before a merge to main. Run factory init
```

GitHub never lets a secret be read back, so a wrong one shows when the
first run that needs it fails, naming it.

## A public repository

For a repository anyone can read. A private repository needs nothing
here.

From December 2, 2026, GitHub blocks the `pull_request_target` event in
a public repository unless one of the repository's Actions policies
allows it. The factory's workflow file, `.github/workflows/factory.yml`,
starts on that event: it is how the review's verdict, who merges, and
the board sync run from your default branch's copy, where a pull request
cannot change them.

`factory init` adds the policy for you. Its plan has this row, and after
"Go ahead?" it prints the line under it:

```text
  policy        Let .github/workflows/factory.yml run on pull_request_target, as the policy "Software factory"
✓ Allowed pull_request_target for .github/workflows/factory.yml.
```

The policy covers that one file and lists every event the file starts
on, so your other workflows are not affected.

**It worked when** `factory doctor` shows:

```text
✓ pull_request_target is allowed for .github/workflows/factory.yml
```

Without the policy, it shows this, and running `factory init` again adds
it:

```text
✗ pull_request_target is not allowed for .github/workflows/factory.yml, so GitHub runs no verdict, merge policy, or board sync on a pull request. Run factory init
```

When `init` cannot add the policy, it says so and puts the step under
"Left to do". [Setting up on GitHub by hand](by-hand.md#a-public-repository)
has each field to fill in.

## Private npm packages

For a repository whose own dependencies include a package from a private
registry, such as your company's own packages. At the end, the factory's
jobs that install your dependencies install it as your machine does, and
Dependabot offers its new versions.

The factory itself needs none of this. It comes from the public npm
registry, onto each machine and each job, and a
[preset](../presets.md#who-can-read-a-preset) comes from a repository on
your code host, read with the access you already have. A repository with
no `package-lock.json` at its root needs none of it either, since no job
runs `npm ci` there.

### 1. Read the token from a variable in `.npmrc`

The workflows sign in to your registry the way npm does on your machine:
from the `.npmrc` at the root of your repository, which you commit. It
needs two lines, one that sends your packages' scope to the registry and
one that reads the token from an environment variable:

```ini
@acme:registry=https://acme.jfrog.io/artifactory/api/npm/npm/
//acme.jfrog.io/artifactory/api/npm/npm/:_authToken=${NPM_TOKEN}
```

Your registry's documentation gives both lines with its own address. The
variable can have any name; the factory stores the token as a secret of
the same name, so wherever this section says `NPM_TOKEN`, use yours. On
your machine, set the variable in your shell's profile, such as
`export NPM_TOKEN=...`. If the token line is only in your own
`~/.npmrc`, move it into this file with the variable in place of the
token: the workflows read only this one.

**It worked when** `npm ci` succeeds on your machine with the variable
set.

#### GitHub Packages

Read `${GITHUB_TOKEN}` in the token line. In the workflows it is their own
token, which can read the packages that give this repository access, so
there is no registry token to make or to store for Actions: skip steps 2
and 3. On your machine, set `GITHUB_TOKEN` to a personal access token
with the `read:packages` scope. Dependabot has no token of its own for
it: where step 3 would have `init` store one, store that personal access
token yourself, with `gh secret set PACKAGES_TOKEN --app dependabot`,
and in step 4 name `PACKAGES_TOKEN` in place of `NPM_TOKEN`.

This does not work in a repository whose builds act as an
[organization's App](reference.md#who-a-cloud-session-acts-as): a build
there would act with
the workflow's own token, not the App's
([Limitations](../limitations.md#what-it-does-not-do)). Read a variable
of another name there, such as `PACKAGES_TOKEN`, and follow steps 2 and
3 with a personal access token that has the `read:packages` scope.

### 2. Make a read-only token

On your registry, make a token that can only read, and only the packages
this repository installs. Builds and reviews in the cloud hold it while
they work, and they read tickets and pull requests that anyone with access
to the repository can write, so a read-only token is all that text could
ever lead one to give away.

### 3. Store it with `factory init`

```bash
factory init
```

Under "Found", `init` lists `.npmrc` and the variable it reads. Then it
asks you to paste the token, rewrites the factory's two workflow files
under `.github/workflows/` to pass the secret to the jobs that install,
and stores it twice: as an
Actions secret, and as a Dependabot secret, since a workflow that
Dependabot's pull request starts can read only Dependabot secrets. If
`.npmrc` isn't listed under "Found", the token line is missing from the
file at your repository's root.

If your organization already shares the secret with this repository,
`init` does not ask for the Actions copy. It still asks for the Dependabot
copy, since only an organization admin can see whether the organization
sets that one: leave it empty if yours does. To set both once for every
repository, an organization admin runs:

```bash
gh secret set NPM_TOKEN --org acme --visibility all
gh secret set NPM_TOKEN --org acme --visibility all --app dependabot
```

### 4. Tell Dependabot the registry

Skip this without a `.github/dependabot.yml`, or when your organization
sets the registry for Dependabot, which an organization admin can tell
you. Otherwise add the registry, and name it in your npm entry, or
Dependabot never sees a new version of a package from there:

```yaml
registries:
  acme: # any name; the npm entry uses it
    type: npm-registry
    url: https://acme.jfrog.io/artifactory/api/npm/npm/ # as in .npmrc
    token: ${{secrets.NPM_TOKEN}} # the Dependabot secret from step 3
updates:
  - package-ecosystem: npm
    directory: /
    registries: [acme]
    schedule:
      interval: weekly
```

### 5. Check it, and merge

Run `factory doctor`. **It worked when** it shows:

```text
✓ NPM_TOKEN is set, for installing what .npmrc names
✓ NPM_TOKEN is set for Dependabot, for installing on Dependabot's pull requests
✓ .github/dependabot.yml uses https://acme.jfrog.io/artifactory/api/npm/npm/ for its npm updates
```

Without a `.github/dependabot.yml` there is no third line. A line that
starts with `?` is one `doctor` cannot check from the repository, such as
a secret or a registry your organization may set, which only an
organization admin can see. It fails nothing.

`init` committed only the files it wrote, and left your checkout on the
branch of the pull request it opened. Commit `.npmrc` on that branch,
push it, and merge the pull request as any other change. If `init`
printed `Nothing to commit: the files already match.`, it opened none:
commit `.npmrc` on a branch and open the pull request yourself. The
first job that installs
your dependencies is the last check. With the automated review on, that
is the review of this pull request: its "Install the repository's
dependencies" step passes once the jobs can sign in. Without it, it is
your next build in the cloud.

### Replacing the token

When the token expires, the next job that installs your dependencies
fails at `npm ci` with a 401.
Store the new one in both places:

```bash
gh secret set NPM_TOKEN
gh secret set NPM_TOKEN --app dependabot
```

or run `factory init` and answer yes when it asks to replace the secrets
already set. An organization admin runs the two commands in step 3
again instead.

If you rename the variable in `.npmrc`, the factory's commands stop and
say to run `factory sync`, which rewrites the two workflow files for the
new name.

## Doing it by hand

[Setting up on GitHub by hand](by-hand.md) has every step `init` takes,
and every secret with the scopes it needs, for anyone who cannot run
`init` or wants to see what it does.
