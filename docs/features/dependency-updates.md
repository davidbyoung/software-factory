# Dependency updates

For a repository whose dependency bot opens pull requests. At the end
you know how the factory moves them toward merged, and why the factory's
own updates come another way. A job in the cloud runs it three times a
day; to run it yourself, type `/factory-deps` in a session.

## What you get

### `factory-deps`

**What it does.** Moves every open dependency pull request one step closer
to merged: resolves a conflict with your default branch, fixes failing checks,
does the migration a major version asks for, and opens a ticket for
anything it cannot fix. For a major version it makes every change the
migration guide calls for, not only the ones that broke a check.

**When to use it.** When dependency pull requests are stuck. A run in the
cloud also uses it, one run for each of the dependency bot's open pull
requests, three times a day. An update of the factory itself, or of a
preset, is not the dependency bot's: the factory's own update job opens it
([Updating](../maintain/updating.md)).

**What it never does.** Merge, approve, or turn auto-merge on. Weaken
a check to make it pass: it never pins or downgrades the dependency,
skips or loosens a test, lowers a coverage threshold, relaxes a lint rule
or type setting, or lets a CI step fail without failing the run. When
that is the only fix, it opens a ticket instead.

## What it needs

A dependency bot that opens pull requests in your repository.

## Turn it on

Add your dependency bot's settings file to your repository
([GitHub](../integrations/github.md#dependabot) names the file), then run
`factory sync` and commit what it changed with the file. `factory-deps`
is written, and its jobs run, only in a repository that has the file; a
dependency pull request in a repository without it waits for you, and
nothing moves it along or lets it merge itself.

**It worked when** `factory sync` writes `.claude/skills/factory-deps/`.
Once that is merged, a run in the cloud looks after the bot's open pull
requests three times a day.

## How it works

### Dependency bots

Your dependency bot does not update the factory, or a
[preset](../customize/presets.md). Nothing of the factory's is in
`package.json`, and the factory's own update job opens those pull requests
([Updating](../maintain/updating.md)). So the bot's settings need nothing
for the factory. A group for the factory, which an earlier version had
you add, can go
([GitHub](../integrations/github.md#dependabot-and-the-factorys-updates) says how).

If your dependency bot updates your workflow files, have it leave the
factory's alone. The update job raises the version in the two workflow
files together with the files that version writes, and a pull request of
the bot's that raised the version alone would fail the "Factory files in
step" check. [GitHub](../integrations/github.md#dependabot-and-the-factorys-updates) has the entry
that does it.

The factory has a job of its own that turns auto-merge on for each of
the dependency bot's pull requests, so a minor or patch update merges by
itself once its checks pass
([GitHub Actions](../integrations/github-actions.md#the-jobs) lists it).
It never turns it on for a major version, whose migration you read
first, or for one that names the factory, so one of those that slips
through waits for you whatever its size.

## Its settings

Nothing to set in `.claude/factory.yaml`: the dependency bot's own
settings file decides which pull requests it opens.

## When something goes wrong

What `factory-deps` cannot fix becomes a ticket for you.

## On your tools

- [GitHub Actions](../integrations/github-actions.md)
- [GitHub](../integrations/github.md)
