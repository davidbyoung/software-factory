# Updating

**When a new version is released, a pull request appears in your
repository. You read it and merge it.** That is all you have to do.

## What happens

1. Dependabot's weekly run finds the new version and opens one pull
   request for it, as it does for any package. Its group for the factory
   ([on GitHub](github/reference.md#dependency-bots)) keeps the pull
   request to the factory alone.
2. `factory-deps`, which already looks after Dependabot's pull requests,
   runs `factory sync` on its branch and adds what it wrote as a second
   commit. Until it has, CI's `factory sync --check` fails.
3. You read it and merge it. It never merges itself, whatever your
   `auto-merge` settings allow.
4. Everyone working on the repository, you included, pulls and runs
   `npm ci`, as after any dependency change.

## What the pull request holds

- **The new version**, in `package.json`, the lockfile, and
  `.claude/factory.lock`.
- **The factory's files, rewritten.** Its skills, agents, rules, and CI
  workflows live in your repository, so the diff shows exactly which
  instruction changed.
- **A comment from `factory-deps`** listing the files the sync changed,
  and anything the release notes say to do by hand, first.

An update changes the instructions your sessions follow and the code that
runs with your tokens. Read it as carefully as you would read code.

## Doing it yourself

To update now instead of waiting for Dependabot:

```bash
npm install --save-dev @davidbyoung/software-factory@latest
factory sync
```

Commit both on a branch and open a pull request. To see whether you are
behind without changing anything:

```bash
factory doctor
```

## Staying on a version, or going back

- **To stay where you are,** close the update pull request. Dependabot
  opens a new one for the next release.
- **To go back,** revert the update's pull request. The version and the
  files go back together.

## Without Dependabot

Update by hand as above. `factory-deps` and its workflows are written only
once `.github/dependabot.yml` exists.

## The commands

| Command          | When                                                       |
| ---------------- | ---------------------------------------------------------- |
| `factory sync`   | After you edit `.claude/factory.yaml`, to apply the change |
| `factory doctor` | To see whether you are behind, or why something is off     |

`factory sync` rewrites the factory's files to match your
settings and the installed version.

## On a team

Decide who merges updates, and tell them these pull requests are theirs.
An update changes how everyone's sessions behave, so one person should
read each one. After it merges, everyone pulls and runs `npm ci`. Until
they do, `factory doctor` and the start of each session
tell them their installed version is behind the repository's; the
session's start also says so, naming `npm ci`, when `node_modules` does
not match `package-lock.json`.

## When something goes wrong

| What you see                                                                | What happened                                                         | What to do                                                                 |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| CI fails with "the factory's files are out of sync"                         | A factory file was edited by hand, or settings changed without a sync | Run `factory sync` and commit the result                                   |
| `factory doctor` says your installed version is older than the repository's | You pulled an update and have not installed it                        | Run `npm ci`                                                               |
| The update pull request conflicts with your main branch                     | Something else changed the same file                                  | `factory-deps` resolves it on its next run, or close it and update by hand |

## Never edit a factory file

Every file named `factory-...`, and the factory's rules, are written by
the factory. An edit made to one would be lost on the next update, so CI
fails when one differs from what the installed version would write.

To change what the factory does:

- **For your repository only:** say so in your own instructions for the
  agent, which win over the factory's rules, or, _[Planned](developing.md#what-is-built)_, change the value under
  [`rules`](configuration.md#rules) in your settings.
- **For everyone:** change it in the factory, and it reaches you as an
  update.

[Why it works this way](design.md) explains why the files are copied in
and what the three version numbers are.
