# `session-minutes`

How long each kind of unattended session may run, in minutes, before the
cloud runner stops it. Raise one if your tests or your build are slow
enough that sessions are cut off mid-task.

```yaml
session-minutes:
  build: 300
```

| Setting        | Limits the session that is                                  | Default |
| -------------- | ----------------------------------------------------------- | ------- |
| `build`        | Building a ticket                                           | `230`   |
| `conflicts`    | Fixing a pull request's conflicts with the default branch   | `110`   |
| `review`       | Reviewing a pull request, or answering its review or its CI | `50`    |
| `dependencies` | Working through dependency updates                          | `50`    |

- **Each is a whole number above zero.**
- **Run `lunamill sync` after changing one,** since it writes them into
  `.github/workflows/lunamill.yml`. `lunamill config check` fails until
  you do.
- **The cloud runner may stop a job sooner:** see
  [its limits](../../integrations/github-actions.md#limits-that-come-from-github).
