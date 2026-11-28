# Install

For anyone about to use kodor on a machine for the first time. At
the end the `kodor` command runs there, in every repository you use it
in. You need Node 22.18 or later.

```bash
npm install -g @kodor-ai/kodor
```

**It worked when** `kodor`, run in any folder, prints the list of its
commands. On a machine that is not yours, such as a hosted session, the
same line installs it.

## The `kodor` command on your machine

The command you installed above only starts the version each repository names
([Which version runs](#which-version-runs)), so it rarely needs
updating itself. It keeps each version it downloads in
`~/.cache/kodor/`, or under `$XDG_CACHE_HOME` when that is
set, and the folder is safe to delete. Update it when you set a new
repository up, since `kodor init` sets a repository up with the
version installed:

```bash
npm install -g @kodor-ai/kodor@latest
```

## Which version runs

The command you installed only starts kodor. Each repository names
the version it uses, in the `version:` line of `.claude/kodor.lock`,
and that is the one that runs there:

| Where you run `kodor`                                   | What runs                                                                         |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A repository whose `.claude/kodor.lock` names a version | That version. The first time, npm downloads it, and a line says so                |
| A repository not set up yet, or outside any repository  | The version installed on your machine                                             |
| When you run `kodor update`, in any directory           | The version installed on your machine, which hands the sync to the newest release |
| With `KODOR_VERSION` set to a release                   | That release, for that one command, whatever the lock names                       |

```text
Downloading kodor 0.3.0, which this repository names. This happens once.
```

`KODOR_VERSION=0.3.0 kodor init` runs that one `init` at 0.3.0.
`kodor update` sets the variable itself for its sync, and
[Naming every column](../maintain/upgrade-notes.md#naming-every-column), in the upgrade notes, uses it where a release needs
a setting before it can sync. A run in the cloud installs the version the
repository names:
[What a job installs](../integrations/github-actions.md#what-a-job-installs).

Each version it downloads is kept in `~/.cache/kodor/`, or
under `$XDG_CACHE_HOME` when that is set, and the folder is safe to
delete. When a version cannot be downloaded, the command stops, exits 1,
and ends its line with npm's own reason:

```text
✗ This repository names kodor 0.3.0, and it could not be downloaded: npm error 404 Not Found
```

A session's hooks run the same command. On a machine without it, they
stop each command the session tries to run, and print:

```text
kodor is not installed on this machine. Install it once: npm install -g @kodor-ai/kodor
```

Next: [Quick start](quick-start.md).
