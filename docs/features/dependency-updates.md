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
anything it cannot fix.

**When to use it.** When dependency pull requests are stuck. A run in the
cloud also uses it, one run for each of the dependency bot's open pull
requests, three times a day. An update of the factory itself, or of a
preset, is not the dependency bot's: the factory's own update job opens it
([Updating](../maintain/updating.md)).

**What it never does.** Merge. Make only the changes CI caught when a
migration guide calls for more.

## What it needs

A dependency bot that opens pull requests in your repository, with its
settings file there.

## Turn it on

Add your dependency bot's settings file to your repository. `factory-deps`
is written, and its jobs run, only in a repository that has one; a
dependency pull request in a repository without it waits for you, and
nothing moves it along or lets it merge itself.
[GitHub](../integrations/github.md#what-the-factory-can-and-cannot-do-there)
names the file.

## How it works

### Dependency bots

Your dependency bot does not update the factory, or a
[preset](../customize/presets.md). Nothing of the factory's is in
`package.json`, and the factory's own update job opens those pull requests
([Updating](../maintain/updating.md)). So the bot's settings need nothing
for the factory, and an entry an earlier version had can go
([GitHub](../integrations/github.md#by-hand) says which).

If your dependency bot updates your workflow files, have it leave the
factory's alone. The update job raises the version in the two workflow
files together with the files that version writes, and a pull request of
the bot's that raised the version alone would fail the "Factory files in
step" check. [GitHub](../integrations/github.md#by-hand) has the entry
that does it.

The factory's auto-merge job for the dependency bot's pull requests never
turns auto-merge on for one that names the factory, so one that slips
through waits for you whatever its size.

## Its settings

Nothing to set in `.claude/factory.yaml`: the dependency bot's own
settings file decides which pull requests it opens.

## When something goes wrong

What `factory-deps` cannot fix becomes a ticket for you.

## On your tools

- [GitHub Actions](../integrations/github-actions.md)
- [GitHub](../integrations/github.md)
