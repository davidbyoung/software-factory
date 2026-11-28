# Private npm registries

For a repository whose own dependencies include a package from a private
registry, such as your company's own packages. At the end, Lunamill's
jobs that install your dependencies install it as your machine does, and
Dependabot offers its new versions.

## What Lunamill uses it for

The jobs that install your repository's dependencies, with `npm ci`, sign
in to your registry with a token you store, and Dependabot reads the
registry for your packages' new versions.

### Private npm packages

This page is for your repository's own private packages, the ones its
`package-lock.json` installs from a registry that needs a token. Lunamill itself needs none of it. It comes from the public npm
registry, onto each machine and each job, and a
[preset](../customize/presets.md#who-can-read-a-preset) comes from a repository on
your code host, read with the access you already have. A repository with
no `package-lock.json` at its root needs none of it either, since no job
runs `npm ci` there.

## You need

A `package-lock.json` at your repository's root, and a registry that can
make a token that only reads ([2. Make a read-only token](#2-make-a-read-only-token)).

## Set it up

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
variable can have any name; Lunamill stores the token as a secret of
the same name, so wherever this page says `NPM_TOKEN`, use yours. On
your machine, set the variable in your shell's profile, such as
`export NPM_TOKEN=...`. If the token line is only in your own
`~/.npmrc`, move it into this file with the variable in place of the
token: the workflows read only this one.

**It worked when** `npm ci` succeeds on your machine with the variable
set.

#### GitHub Packages

Read `${GITHUB_TOKEN}` in the token line. In the workflows' own steps it is
their own token, which can read the packages that give this repository
access, so there is no registry token to make or to store for Actions: skip
steps 2 and 3. On your machine, set `GITHUB_TOKEN` to a personal access
token with the `read:packages` scope. Dependabot has no token of its own for
it: where step 3 would have `init` store one, store that personal access
token yourself, with `gh secret set PACKAGES_TOKEN --app dependabot`, and in
step 4 name `PACKAGES_TOKEN` in place of `NPM_TOKEN`.

In the cloud, your default branch's packages are installed with that token
before the session starts, and the session can't install any others
([Limits that come from npm](#limits-that-come-from-npm)).

### 2. Make a read-only token

On your registry, make a token that can only read, and only the packages
this repository installs. Every session in the cloud can read it while it
works, and it reads tickets and pull requests that anyone with access to the
repository can write, so a read-only token is all that text could ever lead
one to give away.

### 3. Store it with `lunamill init`

```bash
lunamill init
```

Under "Found", `init` lists `.npmrc` and the variable it reads. Then it
asks you to paste the token, rewrites Lunamill's two workflow files
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

Run `lunamill doctor`. **It worked when** it shows:

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
branch of the pull request it opened. Commit `.npmrc` on that branch. A
session in the cloud installs the packages itself, so also list your
registry's host there, under [`builds.hosts`](../reference/settings/builds.md#builds)
in `.claude/lunamill.yaml`, and run `lunamill sync`:

```yaml
builds:
  hosts:
    - acme.jfrog.io
```

Push the branch, and merge the pull request as any other change. If `init`
printed `Nothing to commit: the files already match.`, it opened none:
commit these on a branch and open the pull request yourself. The last
check is the first session in the cloud after the merge, such as the
review of your next pull request or your next build: its "Install the
repository's dependencies" step passes once the job can sign in.

## What setup adds

The token, stored twice, as an Actions secret and a Dependabot secret, and
Lunamill's two workflow files rewritten to pass it to the jobs that
install ([3. Store it with `lunamill init`](#3-store-it-with-lunamill-init)).

## Tokens and secrets

### Replacing the token

When the token expires, the next job that installs your dependencies
fails at `npm ci` with a 401.
Store the new one in both places:

```bash
gh secret set NPM_TOKEN
gh secret set NPM_TOKEN --app dependabot
```

or run `lunamill init` and answer yes when it asks to replace the secrets
already set. An organization admin runs the two commands in step 3
again instead.

If you rename the variable in `.npmrc`, Lunamill's commands stop and
say to run `lunamill sync`, which rewrites the two workflow files for the
new name.

## What Lunamill can and cannot do there

It installs your packages, and nothing more: the token can only read.

## Limits that come from npm

- **With GitHub Packages, a session in the cloud can't install the
  packages of the branch it works on.** Your default branch's packages
  are installed with the workflow's own token before the session starts,
  but the session itself has no GitHub token, and its commands can't
  reach GitHub. When your gate needs the branch's packages, build that
  repository's tickets on your machine
  ([Limitations](../about/limitations.md#what-it-does-not-do)).

## When something goes wrong

A job that fails at `npm ci` with a 401: the token expired
([Replacing the token](#replacing-the-token)). An `.npmrc` that `init`
does not list under "Found" has no token line
([3. Store it with `lunamill init`](#3-store-it-with-lunamill-init)).

## By hand

Steps 1, 2, 4, and 5 under [Set it up](#set-it-up) are yours already.
Step 3 is `init`'s: to take it yourself, run the two `gh secret set`
commands under [Replacing the token](#replacing-the-token), then
`lunamill sync`, which rewrites the two workflow files for the variable
your `.npmrc` reads.
