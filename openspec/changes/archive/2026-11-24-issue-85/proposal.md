# Proposal

From [davidbyoung/software-factory#85](https://github.com/davidbyoung/software-factory/issues/85).

## Why

`factory init --org` does not ask how builds name their branches, and the preset it writes (`factory-preset.yaml`, by `presetText` in `src/init-org.mts`) has no `code-host` block. `code-host.branch-name` is required and has no default, so the first `factory init` in each repository that follows the preset asks:

```text
? How should a build name its branch? Use {ticket}, and {user} for the GitHub account: {ticket}
```

The answer goes into that repository's `.claude/factory.yaml`. So every developer who sets up a repository answers a question the organization should answer once, and two repositories can end up with different patterns.

#74 reads as if the organization's preset answers this: its draft shows `Branch names     {user}/{ticket}` under `From the presets, so not asked`, and says the preset answers the branch name. Nothing in `init --org` was built to write it.

An admin can add the block to the preset by hand, and `factory init` then skips the question. Neither the command nor "Set an organization up, once" in `docs/github/setup.md` says so.

Decisions:

1. **The question** is the one `factory init` asks, with two lines before it: that every repository that follows the preset uses the answer, and whose name `{user}` is. The second names no example, since the owner can still change the App's name when it is registered, which comes later (owner).
2. **It falls** right after the board and its columns, since those and this are what the preset holds, and before what pays for the cloud and the poller's interval (owner).
3. **The spec tool is not asked** by `factory init --org`. OpenSpec adds a folder to the repository, so it stays that repository's choice (owner).
4. **An organization set up already** adds the block by hand, as `docs/updating.md` says. A run again leaves the preset alone, since the file is the owner's to edit (owner).
5. **`factory preset check` passing a value that is not valid** is #86, and not part of this ticket. This ticket does not wait on it: the pattern is checked before it is written (owner).
6. **Track: `spec`.** An owner sees a new question, and with the docs the change is over the 30 lines of a small one.

## What Changes

- When `factory init --org` is about to write the preset, it asks for the branch name pattern, offers `{ticket}`, and refuses a pattern `factory config check` would refuse, as `factory init` does.
- The preset it writes holds the answer:

  ```yaml
  code-host:
    type: github
    branch-name: "{ticket}"
  ```

- Run again where the preset already exists, it does not ask and does not change the preset, as for the board today.
- `factory init` in a repository that follows that preset does not ask, and lists the pattern as `Branch names` under `From the presets, so not asked`.
- "Set an organization up, once" in `docs/github/setup.md` says the question is asked, and that the pattern is in the preset. The line of the README beside the preset that says what the preset holds (`readme` in `src/init-org.mts`) names it too.

## Capabilities

### Modified Capabilities

- `org-setup`
- `docs`
