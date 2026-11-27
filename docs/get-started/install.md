# Install

For anyone about to use the factory on a machine for the first time. At
the end the `factory` command runs there, in every repository you use it
in. You need Node 22.18 or later.

```bash
npm install -g @davidbyoung/software-factory
```

**It worked when** `factory`, run in any folder, prints the list of its
commands. On a machine that is not yours, such as a hosted session, the
same line installs it.

## The `factory` command on your machine

The command you installed once, in the [quick start](quick-start.md#1-install),
only starts the version each repository names
([Which version runs](#which-version-runs)), so it rarely needs
updating itself. It keeps each version it downloads in
`~/.cache/software-factory/`, or under `$XDG_CACHE_HOME` when that is
set, and the folder is safe to delete. Update it when you set a new
repository up, since `factory init` sets a repository up with the
version installed:

```bash
npm install -g @davidbyoung/software-factory@latest
```

## Which version runs

The command you installed only starts the factory. Each repository names
the version it uses, in the `version:` line of `.claude/factory.lock`,
and that is the one that runs there:

| Where you run `factory`                                   | What runs                                                                         |
| --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| A repository whose `.claude/factory.lock` names a version | That version. The first time, npm downloads it, and a line says so                |
| A repository not set up yet, or outside any repository    | The version installed on your machine                                             |
| When you run `factory update`, in any directory           | The version installed on your machine, which hands the sync to the newest release |
| With `FACTORY_VERSION` set to a release                   | That release, for that one command, whatever the lock names                       |

```text
Downloading the factory 0.3.0, which this repository names. This happens once.
```

`FACTORY_VERSION=0.3.0 factory init` runs that one `init` at 0.3.0.
`factory update` sets the variable itself for its sync, and
[Updating](../maintain/upgrade-notes.md#naming-every-column) uses it where a release needs
a setting before it can sync. A run in the cloud installs the version the
repository names:
[What a job installs](../integrations/github-actions.md#what-a-job-installs).

Each version it downloads is kept in `~/.cache/software-factory/`, or
under `$XDG_CACHE_HOME` when that is set, and the folder is safe to
delete. When a version cannot be downloaded, the command stops, exits 1,
and ends its line with npm's own reason:

```text
✗ This repository names the factory 0.3.0, and it could not be downloaded: npm error 404 Not Found
```

A session's hooks run the same command. On a machine without it, they
stop each command the session tries to run, and print:

```text
The factory is not installed on this machine. Install it once: npm install -g @davidbyoung/software-factory
```
