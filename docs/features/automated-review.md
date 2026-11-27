# The automated review

For someone who wants every pull request read by an agent before it
merges. At the end each pull request you mark ready gets a review, and a
verdict that a merge waits for.

## What you get

Once a pull request is marked ready, your coding agent reads it in the
cloud, comments on what it finds, and posts a verdict: the "Review
verdict" status, which passes the pull request or asks for changes. It is
separate from your own CI, which keeps running your tests as before. A
session that built the pull request answers the comments, as
[Review and answer](../workflow/review.md) says.

## What it needs

A cloud runner, and your coding agent's token stored where the runner
reads it. In an organization an owner has set up, the organization's token
is used.

## Turn it on

Run `factory init` and check "An automated review of every pull request".
It asks for the coding agent's token on your own account, stores it, and
opens a pull request with the change
([Set up a repository](../setup/repository.md)).

**It worked when** the next pull request you mark ready gets the review's
comments and a "Review verdict" status.

## How it works

- **The verdict is required** from the first run after the setup's pull
  request merges, where setup could make it required, so a pull request
  cannot merge until the review passes it. Where it could not, init lists
  the step under "Left to do"
  ([Set up a repository](../setup/repository.md#what-is-left-for-you)). While the review is off, the status passes, reading "The automated
  review is off".
- **Tell the reviewer about your project** in `.github/review-notes.md`,
  which you write and the factory leaves alone.
- **Override a verdict for one commit** with the `verdict-override`
  label, which only a person adds ([Merge](../workflow/merge.md)).
- **Each push to a pull request marked ready is reviewed again,** so a
  draft is where to keep pushing while work goes on. Each review is a
  session in the cloud ([What a run costs](cloud-builds.md#what-a-run-costs)).

## Its settings

```yaml
pr-review: true
```

`factory init` writes this line when you check the review. You can also
write [`pr-review`](../reference/settings/pr-review.md#pr-review)
yourself, or set it to `false` to turn the review off, and run
`factory sync`, which changes the workflow to match.

## When something goes wrong

A review that never starts, or stops at once, is usually the coding
agent's token: [Troubleshooting](../maintain/troubleshooting.md).

## On your tools

- [GitHub Actions](../integrations/github-actions.md)
- [Claude Code](../integrations/claude-code.md)
- [GitHub](../integrations/github.md)
- [GitHub organizations](../integrations/github-organizations.md)
