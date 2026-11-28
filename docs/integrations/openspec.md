# OpenSpec

The spec tool: it keeps each ticket's Spec in your repository, as well as
in the ticket. It is optional ([Specs](../features/specs.md)).

## What the factory uses it for

Each build writes the ticket's Spec into `openspec/specs/`, using
[OpenSpec](https://github.com/Fission-AI/OpenSpec), so that folder always
describes what your project does, readable without opening a ticket.

## You need

Node, which the factory needs anyway. Your repository can be in any
language.

## Set it up

`factory init` asks "Which spec tool do you use?". Choose OpenSpec. To
turn it on later, write
[`specs: openspec`](../reference/settings/specs.md#specs) in your
settings and run `factory init` again.

**It worked when** init prints `Installed @fission-ai/openspec.` and your
`package.json` lists the package.

## What setup adds

- OpenSpec as a development dependency, through
  `npm install --save-dev @fission-ai/openspec`, when `package.json`
  doesn't list it.
- In a repository with no `package.json`, a small private one first, and
  `node_modules/` in your `.gitignore`.
- The folder `openspec/`, which the builds fill.

## Tokens and secrets

Nothing: OpenSpec needs no token.

## What the factory can and cannot do there

A build runs `factory specs new`, `check`, and `finish` itself.
`factory specs list` prints the specs your repository keeps, which is what
to read before changing what one describes
([Your repository's commands](../reference/cli.md#your-repositorys-commands)).

OpenSpec collects usage statistics unless `DO_NOT_TRACK=1` is set, so the
factory sets it whenever it runs
[`specs.check`](../reference/settings/specs.md#specscheck).

## Limits that come from OpenSpec

None the factory adds to.

## When something goes wrong

A build that stops at its first spec step, saying to run `factory init`:
OpenSpec is not installed. Run `factory init` again.

## By hand

Install it with `npm install --save-dev @fission-ai/openspec` and write
`specs: openspec` in your settings.
