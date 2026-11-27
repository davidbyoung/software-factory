# Dependency updates

For a repository whose dependency bot opens pull requests. At the end
you know how the factory moves them toward merged, and why the factory's
own updates come another way. A job in the cloud runs it three times a
day; to run it yourself, type `/factory-deps` in a session.

## `factory-deps`

**What it does.** Moves every open dependency pull request one step closer
to merged: resolves a conflict with your default branch, fixes failing checks,
does the migration a major version asks for, and opens a ticket for
anything it cannot fix.

**When to use it.** When dependency pull requests are stuck. A run in the
cloud also uses it, one run for each of Dependabot's open pull requests,
three times a day. It is written, and its jobs run, only in a repository
that has a `.github/dependabot.yml`. A security update GitHub opens in a
repository without that file waits for you: nothing moves it along or lets
it merge itself. An update of the factory itself, or of a preset, is not
Dependabot's: the factory's own update job opens it
([Updating](../maintain/updating.md)).

**What it never does.** Merge. Make only the changes CI caught when a
migration guide calls for more.

## Dependency bots

Dependabot does not update the factory, or a [preset](../customize/presets.md).
Nothing of the factory's is in `package.json`, and the factory's own
update job opens those pull requests ([Updating](../maintain/updating.md)). So
`.github/dependabot.yml` needs no group for the factory. If yours has
one from an earlier version, delete it, with its name in any other
group's `exclude-patterns`.

If Dependabot updates your workflow files, have it leave the factory's
alone. The update job raises the version in the two workflow files
together with the files that version writes, and a pull request of
Dependabot's that raised the version alone would fail the "Factory files
in step" check:

```yaml
updates:
  - package-ecosystem: github-actions
    directory: /
    schedule:
      interval: weekly
    ignore:
      - dependency-name: "davidbyoung/software-factory*"
```

Dependabot's auto-merge job never turns auto-merge on for a pull request
that names the factory, so one that slips through waits for you whatever
its size.

## On your tools

- [GitHub Actions](../integrations/github-actions.md)
- [GitHub](../integrations/github.md)
