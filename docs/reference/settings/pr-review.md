# `pr-review`

An AI code review of every pull request. Once a pull request is marked
ready, the coding agent reads it, comments on what it finds, and posts a
verdict that [`auto-merge`](auto-merge.md#auto-merge) waits for. It is separate from
your own CI, which keeps running your tests as before.

```yaml
pr-review: true
```

- **Default:** off. `true` turns it on, and `lunamill sync` then turns the
  review's run on in `.github/workflows/lunamill.yml`. While it is off,
  each pull request's "Review verdict" status passes, reading "The
  automated review is off". `lunamill config get pr-review` prints `on`
  or `off`.
  [The automated review](../../features/automated-review.md) has what it
  needs.
- **The reviewer may run the pull request's own code** to confirm something
  it suspects, such as one test. It does so in
  [the session's sandbox](../../security/cloud-runs.md#what-a-cloud-run-is), with no sign-in
  to your code host. It doesn't run your tests on every pull request: your
  CI does that.
- **To turn it off,** set it to `false`, or delete it, and run
  `lunamill sync`, which turns the run off again. `false` also turns off a
  review a [preset](presets.md#presets) turns on.
- **An older file that says `pr-review: {}`,** or lists `commands` under
  it, fails `lunamill config check`. Write `pr-review: true` in its place.
