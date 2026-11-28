# Pull requests that merge themselves

For someone who wants some changes, such as to the docs, to merge without
reading each one. At the end a pull request that changes only files you
listed merges once its checks pass, and every other one waits for you.

## What you get

The merge policy reads each pull request's changed files. When every file
matches a pattern you allow, and no check holds it, it turns on the pull
request's own auto-merge, and the pull request merges once every check
passes, the automated review's verdict included where the review is on.
Otherwise it waits for you, and its "Who merges" status says why.

## What it needs

The patterns, and a token for your code host that can turn auto-merge on
([GitHub](../integrations/github.md#tokens-and-secrets) says which). In an
organization an owner has set up, the organization's App is used.

## Turn it on

Run `factory init` and check "Pull requests that merge themselves". It
asks which files may merge without you: type their patterns, such as
`docs/**`, and start with a short list.

**It worked when**, once the setup's pull request has merged, the next
pull request that changes only those files has the `merge-automatic` label and merges once its checks pass.

## How it works

- **Some files always wait for you,** whatever you allow: the factory's
  own files, every `CLAUDE.md` and `AGENTS.md`, and the spec tool's
  settings. A change to how the factory works is a person's call.
- **`deny` carves exceptions out of `allow`,** and always wins.
- **Your own check can hold one,** as a command that exits other than 0.
- **The merge policy runs from your default branch,** so a pull request
  cannot change how it is judged. [Merge](../workflow/merge.md) says who
  merges what.

## Its settings

```yaml
auto-merge:
  allow:
    - docs/**
  deny:
    - docs/legal/**
  commands:
    - node scripts/public-api-changed.mjs
```

A command under [`auto-merge.commands`](../reference/settings/auto-merge.md#auto-merge) is your own check: it exits 0 to let the pull
request merge, and anything else to hold it.

Every key, the command it can run, and each reason a held pull request
gives, are on [`auto-merge`](../reference/settings/auto-merge.md#auto-merge).

## When something goes wrong

A pull request you expected to merge waits: its
["Who merges"](../workflow/merge.md#who-merges) status names each file or
command that held it, and why.

## On your tools

- [GitHub Actions](../integrations/github-actions.md)
- [GitHub](../integrations/github.md)
