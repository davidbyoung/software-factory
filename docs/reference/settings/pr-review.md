# `pr-review`

An AI code review of every pull request. Once a pull request is marked
ready, the coding agent reads it, comments on what it finds, and posts a
verdict that [`auto-merge`](auto-merge.md#auto-merge) waits for. It is separate from
your own CI, which keeps running your tests as before.

```yaml
pr-review: {}
```

- **Default:** off. Writing `pr-review` turns it on, even with nothing
  under it (`pr-review: {}`), and `factory sync` then turns the review's
  run on in `.github/workflows/factory.yml`. While it is off,
  each pull request's "Review verdict" status passes, reading "The
  automated review is off". `factory config get pr-review` prints `on`
  or `off`.
  [Which setup is yours](../../setup/README.md) has what it needs there.
- **The reviewer may run the pull request's own code** to confirm something
  it suspects, such as one test. It does so in
  [the session's sandbox](../../security/cloud-runs.md#what-a-cloud-run-is), with no sign-in
  to your code host. It doesn't run your tests on every pull request: your
  CI does that.
- **`commands` does nothing today, so leave it out.** It once listed what
  the reviewer could run. The sandbox now confines it instead, and it may
  run any command there. A list already in your settings is still checked:
  a command in it can't contain a comma, a parenthesis, or a quote.
- **To turn it off,** delete `pr-review` and run `factory sync`, which
  turns the run off again.
