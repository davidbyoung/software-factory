# `presets`

Settings shared by several repositories, each a folder in a repository
on your code host, listed in the order they apply: a later preset wins
over an earlier one, and your own settings in this file win over every
preset's.

```yaml
presets:
  - acme/kodor-config # what every Acme repository shares
  - acme/kodor-config//node # extra settings for its Node repositories
```

- **Default:** none.
- **A name is the repository that holds the preset,** written
  `OWNER/NAME`. A preset kept in a folder of that repository adds `//`
  and the folder: `OWNER/NAME//FOLDER`.
- **Add or remove one** with `kodor preset add NAME` or
  `kodor preset remove NAME`, which edit this list, pin the preset to
  one commit of its repository in `.claude/kodor.lock`, or drop that
  pin, and sync. A name written here by hand is not pinned, so the next
  sync stops and names the command that pins it.
- **A repository not set up yet** names its presets as `kodor init`
  sets it up: with `kodor init --preset NAME`, once for each, or from
  the list init offers ([Adding a preset](../../customize/presets.md#adding-a-preset)).
- **A preset for some folders** applies only there. Add one with:

  ```bash
  kodor preset add acme/kodor-config//python --in 'services/*'
  ```

  which writes:

  ```yaml
  presets:
    - name: acme/kodor-config//python
      in: services/*
  ```

  Each command it gives runs in each of those folders, and each path in
  it starts at each folder. A command list it gives is added after the
  one in your own `kodor.yaml`, where a preset without `in` would
  replace it. It can set only `commands`, `plugins`, `site`, and
  `approval-policies`.
  [Use a preset](../../customize/presets.md#how-presets-combine) says how it combines.

- **A preset can't set** `repository`, `auto-merge.allow`, or
  `auto-merge.commands`, and can't list other presets
  ([why](../../customize/writing-a-preset.md#what-a-preset-cant-set)).

[Use a preset](../../customize/presets.md) says how they combine, how to choose between two
that disagree, and how to write one.
