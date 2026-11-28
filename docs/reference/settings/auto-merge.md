# `auto-merge`

Which pull requests may merge without you reading them.

```yaml
auto-merge:
  allow:
    - docs/**
    - src/components/**
    - tests/**
  deny:
    - src/components/checkout/**
  commands:
    - node scripts/public-api-changed.mjs
```

A pull request merges itself only when **all** of these hold:

1. every file it changes matches a pattern under `allow`;
2. no file it changes matches a pattern under `deny`;
3. every command under `commands` exits 0;
4. CI passes. With [`pr-review`](pr-review.md#pr-review) on, that includes the
   automated review finding it ready.

Otherwise it waits for you, and the pull request says why.

- **By default every list is empty, so nothing merges without you.**
- **`deny` carves exceptions out of `allow`,** and always wins.
- **Some files always wait for you,** whatever `allow` says: Lunamill's own, which are everything under `.claude/` and `.github/`,
  every `CLAUDE.md` and `AGENTS.md`, and `openspec/config.yaml`.
- **Start with a short `allow` list** and add to it. Too wide a list
  merges changes you meant to read.
- **`lunamill config check` warns about a pattern that matches no file,**
  since a stale pattern is how a policy quietly stops meaning anything.

**A command under `commands`** is your own check. It runs once for each
pull request, from a checkout of your default branch, never the pull
request's, and reads one JSON object on its standard input:

```json
{
  "repository": "harbor-goods/storefront",
  "pull": 42,
  "base": "the commit the pull request branched from",
  "head": "the pull request's newest commit",
  "files": [
    {
      "filename": "src/a.ts",
      "previous_filename": "src/b.ts",
      "status": "renamed"
    }
  ]
}
```

It exits 0 to let the pull request merge, and anything else to hold it for
you. Each line it prints is shown as a reason.

What a held pull request says, one line for each file or command that held
it:

| The status says                        | Why                                             |
| -------------------------------------- | ----------------------------------------------- |
| `PATH: Lunamill's own files`           | The file is one of Lunamill's, listed above     |
| `PATH: held by auto-merge.deny`        | The file matches `deny`                         |
| `PATH: not in auto-merge.allow`        | The file matches nothing in `allow`             |
| What your command printed              | Your command exited with something other than 0 |
| `held by COMMAND`                      | The same, and the command printed nothing       |
| `held by COMMAND: it could not be run` | The command was not found or could not start    |
| `no changed files`                     | The pull request changes nothing                |
| `the changed files could not be read`  | The change could not be read from git           |

A renamed file is checked under both its old and new names.
