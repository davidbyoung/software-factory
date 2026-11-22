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

`factory init` stops before its first question when Claude Code isn't
installed, and changes nothing. It needs Claude Code to set up the
coding agent's token, and to suggest your board's columns and your
tickets' fields.

## Run `factory init`

In your repository, with the package
[installed](../quick-start.md#1-install):

```bash
factory init
```

It shows what it found, then asks what to name the branch a session
pushes when it builds a ticket, offering `{ticket}`, the ticket's
number, so ticket 12 is built on a branch named `12`. Press Enter to
keep it, or type your team's pattern, such as `feature/{user}/{ticket}`,
where `{user}` is your GitHub account;
[`code-host`](../configuration.md#code-host) lists what a pattern can
hold.

Next it asks which spec tool you use:

```text
? Which spec tool do you use?
❯ None: each ticket holds its own spec
  OpenSpec: each ticket holds its spec, and each build also keeps it in openspec/specs/
```

Choose **None** unless you want a folder in your repository that always
describes what your project does, readable without opening a ticket:
that is what OpenSpec adds. Choose **OpenSpec** and init installs it for
you, printing `Installed @fission-ai/openspec.` once it has. Your answer is written to `.claude/factory.yaml` as
[`specs`](../configuration.md#specs).

Init skips the branch-name question when your `.claude/factory.yaml`, or
a [preset](../presets.md) you follow, sets `code-host.branch-name`, and
the spec tool question when they set `specs`. Then it asks
which parts you want. Each is optional and stands alone:

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

| Question                              | Asked when you chose                                                                         | What you do                                                                                                 |
| ------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Which board                           | A board                                                                                      | Choose a new one, made with the factory's columns, or a Project you already have                            |
| Which files may merge without you     | Pull requests that merge themselves                                                          | Type their patterns, such as `docs/**`. Start with a short list                                             |
| Where the poller runs                 | Builds that start from the board                                                             | Choose a schedule on GitHub Actions or a server you host. [Builds in the cloud](../builds.md) compares them |
| The token `claude setup-token` prints | The review, and builds in the cloud                                                          | It runs the command for you. Follow what it says, then paste the token it prints                            |
| A GitHub access token                 | A board, builds in the cloud, and pull requests that merge themselves                        | It opens GitHub's page with the right scopes checked. Choose an expiry, generate the token, and paste it    |
| The token your `.npmrc` reads         | Nothing: it asks whenever `.npmrc` reads one ([Private npm packages](#private-npm-packages)) | Paste a token that can only read from your registry                                                         |

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
your parts read is set, those for
[private npm packages](#private-npm-packages), and the board's columns. GitHub never lets a
secret be read back, so a wrong one shows when the first run that needs it
fails, naming it.

## Private npm packages

For a repository that installs a package from a private registry, such as
your company's own packages or a private [preset](../presets.md). At the
end, the factory's workflows install it as your machine does, and
Dependabot offers its new versions.

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
`init` asks for nothing and you skip step 2. On your machine, set
`GITHUB_TOKEN` to a personal access token with the `read:packages` scope.
Dependabot has no token of its own for it: in step 4, store that personal
access token with `gh secret set PACKAGES_TOKEN --app dependabot`, and
name `PACKAGES_TOKEN` in place of `NPM_TOKEN`.

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
asks you to paste the token, rewrites the factory's workflows under
`.github/workflows/` to pass the token to npm, and stores it twice: as an
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

Then commit `.npmrc` and what `init` wrote on a branch, open a pull
request, and merge it as any other change. The pull request's own
"Factory check" is the last check: its "Install dependencies" step passes
once the workflows can sign in.

### Replacing the token

When the token expires, the next workflow fails at `npm ci` with a 401.
Store the new one in both places:

```bash
gh secret set NPM_TOKEN
gh secret set NPM_TOKEN --app dependabot
```

or run `factory init` and answer yes when it asks to replace the secrets
already set. An organization admin runs the two commands in step 3
again instead.

If you rename the variable in `.npmrc`, the factory's commands stop and
say to run `factory sync`, which rewrites the workflows for the new name.

## Doing it by hand

[Setting up on GitHub by hand](by-hand.md) has every step `init` takes,
and every secret with the scopes it needs, for anyone who cannot run
`init` or wants to see what it does.
