# GitHub

The code host: the repository, its pull requests, the checks on each
commit, and the secrets the cloud runner reads.

## What the factory uses it for

Your repository is on GitHub. A build opens its pull request there, the
review's verdict and who merges are statuses on each commit, labels mark
each ticket and pull request the factory handles, and the secrets the
cloud runner reads are stored there. On your machine the factory reaches
GitHub through the GitHub CLI you signed in with.

## You need

- **A GitHub repository, with Issues on.** Check that the repository has
  an Issues tab. If it has none, turn Issues on: on GitHub, Settings,
  General, Features, check "Issues".
- **The GitHub CLI, signed in.** Check it with `gh auth status`, which
  names the account you are signed in as. If it is not installed or not
  signed in, install it from [cli.github.com](https://cli.github.com) and
  run `gh auth login`. Your sessions use its sign-in, so a teammate who
  joins the repository needs it too.

## Set it up

`factory init` sets the repository up
([Run `factory init`](../setup/repository.md#run-factory-init)). A public
repository needs one more thing of GitHub, which `init` also adds.

### A public repository

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
"Left to do". [A public repository](#a-public-repository-1), under
"By hand", has each field to fill in.

## What setup adds

| What                                                                                                                                                                                                                                                                    | Added when                                                                                                                                                                 | To undo                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Secrets and variables named `FACTORY_...`                                                                                                                                                                                                                               | When you turn on a part that reads one: `init` stores the token you paste, or you run `gh secret set`                                                                      | Delete them                                                                               |
| `CLAUDE_CODE_OAUTH_TOKEN`                                                                                                                                                                                                                                               | When you turn on the automated review or builds in the cloud: `init` stores the token you paste, or you run `gh secret set`                                                | Delete it, unless another workflow uses it                                                |
| The secrets your `.npmrc` reads, such as `NPM_TOKEN`, for Actions and for Dependabot                                                                                                                                                                                    | `init`, when you paste them                                                                                                                                                | Leave them if your own CI uses them; otherwise delete both copies                         |
| Labels: `merge-automatic`, `merge-manual`, `verdict-override`, `policy-override`, `spec`, `factory`, or the names under [`tickets.labels`](../reference/settings/tickets.md#ticketslabels) and [`code-host.labels`](../reference/settings/code-host.md#code-hostlabels) | First use; `verdict-override`, the first time "Review verdict" is posted on a pull request with the review on                                                              | Delete them. Deleting a label removes it from every ticket                                |
| A CI check that the factory's files are in step                                                                                                                                                                                                                         | Setup                                                                                                                                                                      | Goes with `factory-review.yml`                                                            |
| An Actions policy named "Software factory", on a public repository, which lets `factory.yml` start on `pull_request_target`                                                                                                                                             | `init`, on a public repository; or you, [by hand](#a-public-repository-1)                                                                                                  | Delete it, under Settings, Actions, Policies                                              |
| A "Review verdict" required check, as the ruleset "Software factory"                                                                                                                                                                                                    | With the review on, the first workflow run after the setup's pull request merges; `init`, when your default branch already has `factory.yml`; or you, in your branch rules | Delete the ruleset, under Settings, Rules, **first**, or pull requests wait on it forever |
| Statuses on pull requests: "Who merges", "Review verdict"                                                                                                                                                                                                               | Each pull request                                                                                                                                                          | They stay in history                                                                      |
| A ticket for each [follow-up](../workflow/follow-ups.md) ticked in a pull request                                                                                                                                                                                       | The merge                                                                                                                                                                  | Close the ticket, as you would any other                                                  |
| Comments on tickets the factory worked                                                                                                                                                                                                                                  | Each refinement and build                                                                                                                                                  | They stay. They hold the ticket's history                                                 |

In an organization's repository, the organization's own rule requires
"Review verdict" in place of that ruleset, and the secrets are the
organization's ([In an organization](github-organizations.md#what-setup-adds)).

## Tokens and secrets

Every secret the factory reads is listed in
[Secrets](../security/credentials.md#secrets).

In an organization, the factory acts as the organization's GitHub App,
which makes a fresh token for each run
([In an organization](github-organizations.md#tokens-and-secrets)). A
repository on your own account has no App, and could not use one, since
a board a person owns refuses an App's token. So there you make a GitHub
access token on your own account, which expires on a day you choose
([When the GitHub access token expires](#when-the-github-access-token-expires)).

### When the GitHub access token expires

For you, on your own GitHub account. In an organization the App makes a
token for each run, and nothing here applies.

The GitHub access token is the one `factory init` asked you to make on
GitHub's page. It stores it as `FACTORY_BOARD_TOKEN`, or
`FACTORY_BUILD_TOKEN` without a board, and as `FACTORY_AUTOMERGE_TOKEN`
when pull requests merge themselves, so a repository has one or two of
these ([Secrets](../security/credentials.md#secrets)). It expires on the day you chose on
that page, where GitHub suggests 30 days; 90 days is a good balance. When
it expires, the board sync, builds in the cloud, and merges stop, and
their runs fail with GitHub's `Bad credentials`.

**To see when it expires,** run `factory doctor`. Under `GitHub Actions`
it prints a line about the token, after the lines for the secrets that
hold it:

```text
✓ The GitHub access token in FACTORY_BOARD_TOKEN and FACTORY_AUTOMERGE_TOKEN expires on 2027-01-01
```

It reads the day from your machine, where `factory init` writes it when
you paste the token ([The file on your machine](../security/credentials.md#the-file-on-your-machine)).
So a teammate, whose machine holds no token of yours, sees no such line.
A token you made with no expiry gets `has no expiry date` in its place,
and the file on your machine holds `expires: never` for it.

In its last 30 days, `factory doctor` and `factory status` print it with
a `?`, and a session shows it to you when it starts. For a token that
expires on 2026-12-10:

```text
? The GitHub access token expires on 2026-12-10, in 13 days. Run factory init to replace it
```

Once the day has passed, `factory doctor` marks the line ✗ and fails.

**To replace it,** run `factory init` in the repository that printed the
line. It asks its other questions as when you set the repository up,
each offering what the repository has now, so Enter keeps it. Before the
secrets, it asks
`Make a new one now?`. Press Enter, and it opens GitHub's page with the
scopes ticked, or prints its address for you to open on a machine with
no browser. Choose an expiry, generate the token, copy it, and paste it
at the prompt `factory init` is waiting on. **It worked when** it prints
`It belongs to sam. Stored for sam/api, and on this machine for your next repository.`,
where `sam` is the GitHub account the token acts as.

Each of your other repositories still holds the old token, and stops
when it expires. In each of them `factory doctor` and `factory status`
say so:

```text
? FACTORY_BOARD_TOKEN here is older than the GitHub access token on this machine. Run factory init to store that one in its place
```

Run `factory init` there. It asks
`Store the one on this machine in its place?`: press Enter, and it
stores the token you just made, with nothing to paste. **It worked
when** it prints `✓ Stored 2 secrets for sam/blog from this machine.`,
counting each name the token is stored under.

`factory init` never copies a token from your machine into a repository
once it expires in 30 days or fewer. It has you make a new one, with the
steps above.

**A run that failed** because the token expired passes once the new one
is stored: re-run it from its page on the Actions tab.

## What the factory can and cannot do there

It opens pull requests, labels them, and posts their statuses. A session
never merges a pull request, nor adds the `verdict-override` or
`policy-override` label, which are a person's. A pull request merges
itself only when [the merge policy](../features/auto-merge.md) turns on
its auto-merge, and every other one waits for you.

For certain people to review every change to certain files, use a
`CODEOWNERS` file, with "Require review from Code Owners" in your branch
rules: GitHub waits for one of them, and the factory isn't involved
([Is it an approval policy?](../features/approval-policies.md#is-it-an-approval-policy)).
[Waiting for you on every change to a workflow](#waiting-for-you-on-every-change-to-a-workflow)
uses one for the workflow files.

### Dependabot

The dependency bot is Dependabot, and its settings file is
`.github/dependabot.yml`. The
[`factory-deps`](../features/dependency-updates.md#factory-deps) skill is
written, and its jobs run, only in a repository that has that file. A
security update GitHub opens in a repository without it waits for you:
nothing moves it along or lets it merge itself.

## Limits that come from GitHub

- **GitHub never lets a secret be read back,** so `factory doctor` checks
  only that each secret your parts read is set, not what it holds. A
  wrong one shows when the first run that needs it fails, naming it.
- **A workflow that a Dependabot pull request starts can read only
  Dependabot's secrets,** so it has no Claude token, as a fork's
  pull request has none. An approval policy's agent, such as
  `factory-credentials-reader`, can't run on either: you read the lines
  the **Approval policies** status's Details lists yourself, then add
  `policy-override`
  ([When `credentials` makes a pull request wait](../features/credentials-policy.md#when-credentials-makes-a-pull-request-wait)).
- **GitHub Free can't require a status on a private repository.** There,
  a waiting approval policy shows on the pull request, but nothing stops a
  merge past it. Making the repository public, or moving to a paid plan,
  lets the **Approval policies** status be required.
- **GitHub won't let you approve a pull request of your own,** so where
  you are the only writer, the `policy-override` label is how you approve
  what an approval policy found
  ([When a pull request waits](../features/approval-policies.md#when-a-pull-request-waits)).
- **A session in the cloud can't reach GitHub at all.** A repository
  whose PHP dependencies come through Composer feels this most, since
  GitHub serves most of Composer's packages, so the session can't
  download them. Install them in
  [`commands.build-setup`](../reference/settings/commands.md#commandsbuild-setup)
  instead, as that setting's entry shows for `composer install`.

The limits of the factory's workflows are under
[Limits that come from GitHub](github-actions.md#limits-that-come-from-github)
on the GitHub Actions page.

## When something goes wrong

Run `factory doctor`, which marks what is wrong with ✗
([Checking it](#checking-it)). Runs that fail with GitHub's `Bad credentials`
usually mean the access token expired
([When the GitHub access token expires](#when-the-github-access-token-expires)).

## By hand

Every step `factory init` takes on GitHub, for someone who wants to take them without it, and the steps on GitHub it leaves to you.

### Choose what you want

The basics are all the [quick start](../get-started/quick-start.md) needs. Everything
else is optional, and each part stands alone. You need the tools under
[What you need](../setup/repository.md#what-you-need), and the `factory` command
[installed on your machine](../get-started/install.md). Nothing is
installed in the repository.

| Part                                                                               | What it takes                                                      |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [The basics](#the-basics)                                                          | A settings file and one command                                    |
| [A public repository](#a-public-repository-1)                                      | One Actions policy, which a private repository does not need       |
| [The automated review](github-actions.md#the-automated-review)                     | A workflow file and your Claude token                              |
| [A board](github-projects.md#a-board)                                              | A Project, one setting, and a GitHub token                         |
| [Builds in the cloud](github-actions.md#builds-in-the-cloud)                       | Your Claude token and a GitHub token                               |
| [Pull requests that merge themselves](#pull-requests-that-merge-themselves)        | A list of files, one repository setting, and a second GitHub token |
| [Signed commits on the factory's updates](#signed-commits-on-the-factorys-updates) | A signing key                                                      |

[Run `factory init`](../setup/repository.md#run-factory-init) says what each part gives
you. Every part's secrets are gathered in [Secrets](../security/credentials.md#secrets), so you can
make them all at once.

### The basics

If you followed the quick start, this is done.

1. Write `.claude/factory.yaml`, with your repository's owner and name:

   ```yaml
   version: 2
   repository: your-name/your-repo
   code-host:
     type: github
     branch-name: "{ticket}"
   ```

2. Write the factory's files:

   ```bash
   factory sync
   ```

   It writes the skills, agents, and rules Claude Code loads, under
   `.claude/`; adds hook entries to `.claude/settings.json`; adds one line
   to `CLAUDE.md`; and writes its two workflow files under
   `.github/workflows/`. [What setup adds](claude-code.md#what-setup-adds), on the Claude Code page, names each.

3. List the commands that check a change, such as your tests and linter,
   under [`commands.gate`](../reference/settings/commands.md#commandsgate). A build runs
   them, and cannot finish without them:

   ```yaml
   commands:
     gate:
       - npm test
       - npm run lint
   ```

4. Optionally, list commands to run before every commit a session on your
   machine makes, under
   [`commands.before-commit`](../reference/settings/commands.md#commandsbefore-commit),
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
the part lists, and merge what `sync` wrote. The two workflow files are
always there, and a part's [job](github-actions.md#the-jobs) is skipped until
its settings turn it on.

### A public repository

Skip this for a private repository.

From December 2, 2026, GitHub blocks the `pull_request_target` event in
a public repository unless one of its Actions policies allows it, and
`.github/workflows/factory.yml` starts on that event
([A public repository](#a-public-repository) says why). Add the
policy in your repository's Settings, under Actions, Policies:

1. **Create a policy** named "Software factory", with its enforcement
   set to Active.
2. **Target one workflow file,** by its path:
   `.github/workflows/factory.yml`. A policy with no path covers every
   workflow in the repository, and would stop your own.
3. **Add a rule that restricts events,** and list all five the file
   starts on: `pull_request_target`, `pull_request_review`, `push`,
   `schedule`, and `workflow_dispatch`. The rule lets through only the
   events it lists, so listing `pull_request_target` alone would stop the
   file's other jobs.

**It worked when** `factory doctor` shows
`✓ pull_request_target is allowed for .github/workflows/factory.yml`.

### Pull requests that merge themselves

A pull request that touches only files you listed as safe merges once
every check passes. Everything else still waits for you. Turn this on
last: it is only as safe as your tests and the review. Start with a short
list, such as documentation.

1. **List the files** under
   [`auto-merge.allow`](../reference/settings/auto-merge.md#auto-merge), with exceptions
   under `deny`:

   ```yaml
   auto-merge:
     allow:
       - docs/**
   ```

   Then run `factory sync`, which turns on the job that says who
   merges. It labels each pull request `merge-automatic` or
   `merge-manual` and says why.

2. **Allow auto-merge** on the repository: Settings, General, "Allow
   auto-merge".
3. **Store a GitHub token** as `FACTORY_AUTOMERGE_TOKEN` ([Secrets](../security/credentials.md#secrets)).

**It worked when** a pull request that touches only files you listed gets
the `merge-automatic` label.

### Signed commits on the factory's updates

Without a key, the commits of the pull requests that update the factory
are unsigned. A session's own commits in the cloud are unsigned whatever
key you store. In a repository whose updates act as an organization's App
([Who a cloud session acts as](github-actions.md#who-a-cloud-session-acts-as)),
so are the updates', so skip this part there.

1. Make a key for this and nothing else, with no passphrase:

   ```bash
   ssh-keygen -t ed25519 -N "" -C "factory updates" -f factory-signing-key
   ```

2. Add `factory-signing-key.pub` to the GitHub account whose token the
   updates use: Settings, "SSH and GPG keys", "New SSH key", key type
   "Signing Key".
3. Store the private half, then delete both files:

   ```bash
   gh secret set FACTORY_SIGNING_KEY < factory-signing-key
   rm factory-signing-key factory-signing-key.pub
   ```

Only the updates' job reads the key. Anything that can run a workflow in
the repository can read it too, as it can the build token. Removing the
public key from the account ends its use.

**It worked when** the commits of the next update's pull request show as
"Verified".

### Waiting for you on every change to a workflow

Where several people can write to your repository, have GitHub wait for
you on every change to a workflow:

1. Add a `CODEOWNERS` file, such as `.github/CODEOWNERS`, with this line,
   with your own username:

   ```text
   /.github/ @your-username
   ```

2. Turn on "Require review from Code Owners" in your branch rules:
   Settings, then Rules or Branches.

**It worked when** a pull request that changes a file under `.github/`
lists you as a required reviewer.

### Dependabot and the factory's updates

`.github/dependabot.yml` needs no group for the factory
([Dependency bots](../features/dependency-updates.md#dependency-bots) says
why). If yours has one from an earlier version, delete it, with its name
in any other group's `exclude-patterns`.

If Dependabot updates your workflow files, have it leave the factory's
alone, with this entry in `.github/dependabot.yml`:

```yaml
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    ignore:
      - dependency-name: "davidbyoung/software-factory*"
```

### Dependabot and the poller's image

A host that builds the poller from a Dockerfile in your repository, such
as `poller/Dockerfile`
([Hosting the poller](../features/hosting-the-poller.md#hosting-the-poller-own-server)),
gets a pull request for each new version of the image from this entry in
`.github/dependabot.yml`. That pull request waits for you, as the
factory's own [update](../maintain/updating.md) does:

```yaml
- package-ecosystem: docker
  directory: /poller
  schedule:
    interval: weekly
```

### Checking it

```bash
factory doctor
```

**It worked when** every check shows ✓, or `-` for a part you left off.
[Changing it later](../setup/repository.md#changing-it-later) says what it checks.
