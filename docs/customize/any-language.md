# Any language

For a repository written in PHP, Python, Go, or any language other than
JavaScript. At the end lunamill builds in it with your own commands,
and nothing of Node's is added to it.

## A repository that is not JavaScript

lunamill's tool runs on Node, whatever your project is written in,
and it is installed on each machine, not in your repository. In a PHP,
Python, or Go repository that means:

- **Nothing of Node's goes in the repository.** lunamill adds no
  `package.json`, no `package-lock.json`, and no `node_modules/`. The one
  exception is a spec tool that npm installs, such as
  [OpenSpec](../integrations/openspec.md), if you
  choose one ([`specs`](../reference/settings/specs.md#specs)): `lunamill init` then
  writes a small private `package.json` for it, and ignores
  `node_modules/`.
- **Everyone who runs an agent session in the repository needs Node
  22.18 or later,** and the `lunamill` command, installed once on their
  machine as [Install](../get-started/install.md) shows.
- **Your own CI does not change.** lunamill's cloud jobs install Node
  and lunamill for themselves. They run `npm ci` for your project only
  when its root has a `package-lock.json`, so in a repository without one
  they install nothing of yours. What a session in the cloud needs on its
  machine beyond that, such as a language, goes under
  [`commands.build-setup`](../reference/settings/commands.md#commandsbuild-setup). It
  installs your project's dependencies itself, from the registries you
  list under [`builds.hosts`](../reference/settings/builds.md#builds)
  ([What a session can use](../features/cloud-builds.md#what-a-session-can-use)).
- **Your commands stay yours.** The gate a build runs, and everything
  else under [`commands`](../reference/settings/commands.md#commands) in the settings, is
  whatever your project runs: `composer test`, `make check`,
  `go vet ./...`.

lunamill's hooks run the `lunamill` command, so they need nothing
beyond Node and its install. On a machine without the command, they stop a session's
commands and say how to install it. Someone who only writes code by
hand, and never runs an agent session in the repository, needs none of
this.

[Example settings files](../reference/settings/examples.md#a-project-that-isnt-javascript) has a
complete settings file for a PHP library.
