# `approval-policies`

Checks whose findings make a pull request wait until someone who can
write to the repository accepts them with the
[`policy-override`](code-host.md#code-hostlabels) label.
[Approval policies](../../features/approval-policies.md) says when to use one, what
each key means, what a check reads and prints, and what a pull request
shows while one waits. Lunamill adds one policy of its own,
`credentials` ([Lunamill's own policy](../../features/credentials-policy.md#lunamills-own-policy)),
which `off: true` turns off.

```yaml
approval-policies:
  - name: licenses # what the Approval policies status calls it
    run: node .claude/approval-policies/licenses/check.mjs # the check, from the root
    files: [package-lock.json] # the changed files that set it off
  - name: migrations
    agent: rollback-checker # an agent in .claude/agents/ checks it
    in: services/* # each folder under services/, checked on its own
    files: ["./db/migrations/**"]
```

[The settings](../../features/approval-policies.md#the-settings) there has a table of
the keys: `name`, `run`, `agent`, `in`, `files`, and `off`. Turning
off every policy, `credentials` included, or turning the first one back
on, changes `.github/workflows/lunamill.yml`, which `lunamill sync`
rewrites, so commit it from your computer.
