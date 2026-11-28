# GitHub

The code host: the repository, its pull requests, the checks on each
commit, and the secrets the cloud runner reads.

## What setup adds

| What                                                                                                                                                                                                                                                                    | Added when                                                                                                                                                                 | To undo                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Secrets and variables named `FACTORY_...`                                                                                                                                                                                                                               | You create them                                                                                                                                                            | Delete them                                                                               |
| `CLAUDE_CODE_OAUTH_TOKEN`                                                                                                                                                                                                                                               | You create it, for the automated review and builds in the cloud                                                                                                            | Delete it, unless another workflow uses it                                                |
| The secrets your `.npmrc` reads, such as `NPM_TOKEN`, for Actions and for Dependabot                                                                                                                                                                                    | `init`, when you paste them                                                                                                                                                | Leave them if your own CI uses them; otherwise delete both copies                         |
| Labels: `merge-automatic`, `merge-manual`, `verdict-override`, `policy-override`, `spec`, `factory`, or the names under [`tickets.labels`](../reference/settings/tickets.md#ticketslabels) and [`code-host.labels`](../reference/settings/code-host.md#code-hostlabels) | First use; `verdict-override`, the first time "Review verdict" is posted on a pull request with the review on                                                              | Delete them. Deleting a label removes it from every ticket                                |
| A CI check that the factory's files are in step                                                                                                                                                                                                                         | Setup                                                                                                                                                                      | Goes with `factory-review.yml`                                                            |
| An Actions policy named "Software factory", on a public repository, which lets `factory.yml` start on `pull_request_target`                                                                                                                                             | `init`, on a public repository; or you, [by hand](#a-public-repository-1)                                                                                                  | Delete it, under Settings, Actions, Policies                                              |
| A "Review verdict" required check, as the ruleset "Software factory"                                                                                                                                                                                                    | With the review on, the first workflow run after the setup's pull request merges; `init`, when your default branch already has `factory.yml`; or you, in your branch rules | Delete the ruleset, under Settings, Rules, **first**, or pull requests wait on it forever |
| Statuses on pull requests: "Who merges", "Review verdict"                                                                                                                                                                                                               | Each pull request                                                                                                                                                          | They stay in history                                                                      |
| A ticket for each [follow-up](../workflow/follow-ups.md) ticked in a pull request                                                                                                                                                                                       | The merge                                                                                                                                                                  |
| Comments on tickets the factory worked                                                                                                                                                                                                                                  | Each refinement and build                                                                                                                                                  | They stay. They hold the ticket's history                                                 |

In an organization's repository, the organization's own rule requires
"Review verdict" in place of that ruleset, and the secrets are the
organization's ([In an organization](github-organizations.md#what-setup-adds)).

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
"Left to do". [A public repository](#a-public-repository-1), under
"By hand", has each field to fill in.

## When the GitHub access token expires

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

## By hand

Every step `factory init` takes on GitHub, for someone who wants to take them without it.

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

### Checking it

```bash
factory doctor
```

**It worked when** every check shows ✓, or `-` for a part you left off.
[Changing it later](../setup/repository.md#changing-it-later) says what it checks.
