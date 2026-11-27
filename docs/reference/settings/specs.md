# `specs`

Which spec tool your project uses, if any. Either way, refinement writes
a [Spec, a design, and a list of tasks](../../features/specs.md#a-change-your-users-will-see)
into the ticket of each change your users will see. A spec tool also
keeps the Spec in your repository.

```yaml
# The default: refinement writes the Spec into the ticket, and nothing is
# kept in your repository. Leaving the line out means the same.
specs: none
```

```yaml
# Each build also writes the ticket's Spec into openspec/specs/.
specs: openspec
```

- **`none`,** the default: the ticket is the only place the Spec is
  written down.
- **`openspec`:** each build also writes the ticket's Spec into
  `openspec/specs/`, using [OpenSpec](https://github.com/Fission-AI/OpenSpec),
  so that folder always describes what your project does, readable
  without opening a ticket.

**`factory init` asks, and writes the answer here.** It asks "Which spec
tool do you use?" when `.claude/factory.yaml` has no `specs` line and no
[preset](../../customize/presets.md) sets one. With `openspec`, init installs OpenSpec as
a development dependency, `npm install --save-dev @fission-ai/openspec`,
whenever your `package.json` doesn't list it, and prints
`Installed @fission-ai/openspec.` In a repository with no
`package.json`, it writes a small private one first, and adds
`node_modules/` to your `.gitignore`. It worked when that line prints and
`package.json` lists the package. So to turn OpenSpec on later, write
`specs: openspec` and run `factory init` again. A re-run is safe: it
keeps every setting you have, asks again only which parts you want,
with yours already checked, and shows everything it will do before it
does it.

**Without OpenSpec installed,** a build stops at its first spec step and
says to run `factory init`.

`factory specs list` prints the specs your repository keeps, one per
line with its file, which is what to read before changing what a spec
describes. The build runs `factory specs new`, `check`, and `finish`
itself; [Your repository's commands](../cli.md#your-repositorys-commands)
says what each prints.

## `specs.check`

The command that checks your written specs are well formed, such as
that every requirement has a scenario. To set it, write `specs` as a
block: its `type` is the tool the one-line form names, so
`specs: openspec` and the block below make the same choice.
`factory specs check` runs it, and so does a build each time it writes a
spec. It belongs only with `type: openspec`.

```yaml
specs:
  type: openspec
  # Optional: this is the default.
  check: npx --no-install openspec validate --all --strict --no-interactive
```

- **Default:** the command above, so most repositories leave `check`
  out and write only `specs: openspec`.
- **It runs with `DO_NOT_TRACK=1` set,** so OpenSpec collects no usage
  statistics.
- **With `specs: none`** there is nothing to check, and a `check` line
  fails `factory config check`: delete it when you switch to `none`.

It worked when `factory specs check` ends with `✓ The specs check passed.`
