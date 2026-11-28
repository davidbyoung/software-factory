# `code-host`

Where your repository and its pull requests live. It also sets what
every [build](README.md#words-this-page-uses) names the branch it pushes, in a
session on your machine and in the cloud alike, and what the labels on
pull requests are called.

```yaml
code-host:
  type: github
  branch-name: "feature/{user}/{ticket}"
```

- **`type`** is the code host. `github`, for
  [GitHub](../../integrations/github.md), is the only one so far, and it
  is the default.
- **`branch-name`** is the pattern for the branch's name. It has no
  default: [`kodor init`](../../setup/README.md) asks for it and offers
  `{ticket}`, so ticket 12 is built on a branch named `12`. A
  [preset](presets.md#presets) can set it for every repository that follows it,
  and in an organization `kodor init --org` asks for it once and
  writes it in the preset.
- **`labels`** renames the labels on pull requests: see
  [`code-host.labels`](#code-hostlabels). Most repositories leave it out.

Without `branch-name`, `kodor config check` stops:

```text
.claude/kodor.yaml: code-host.branch-name: is required. Run kodor init to set it, or add it, such as branch-name: "{ticket}"
```

A pattern uses these placeholders. It must have `{ticket}`; `{user}` is
for a convention that names who did the work, and a pattern can leave
it out:

| Placeholder | What it becomes                           | For ticket 12 |
| ----------- | ----------------------------------------- | ------------- |
| `{ticket}`  | The ticket's key, without `#`             | `12`          |
| `{user}`    | The code host's account the build runs as | `octocat`     |

In a session, `{user}` is the account
[GitHub's command-line tool](../../integrations/github.md#you-need) is signed in as, exactly as the code host spells it, so the same ticket
built by two people gets two branches. On the cloud runner, it is the owner of
the [token the build runs with](../../integrations/github-actions.md#workflows), not
whoever approved the ticket, so with a shared bot account every branch
built in the cloud carries the bot's name. Where a build acts as an
organization's App, `{user}` is the App's name as the code host writes it
in an address, such as `kodor-acme`.

Keep the quotes, as in the examples. YAML reads an unquoted
`branch-name: {ticket}` as a map rather than as text, and
`kodor config check` stops and says to quote it.

`{ticket}` gives each ticket its own branch, and the same branch every
time. So a ticket built a second time, such as a
reopened ticket, or one whose first build stopped, finds its earlier branch still on the code host, unless the code
host deleted it when its pull request merged. What the build does depends on
that branch's newest pull request:

- **Merged, with nothing pushed to the branch since:** the build deletes
  the old branch and starts fresh, since its work is already merged.
- **Open:** the build stops before it starts and names the pull request.
  Work that one instead, with `/kodor-address-review N` for pull
  request N.
- **Anything else:** closed without merging, no pull request at all, or
  merged with commits pushed since. The build stops before it starts, so
  no work is lost:

  ```text
  Branch 12 is already on origin, with work no pull request merged. Open a pull request from it to keep that work, or delete it with: git push origin --delete 12
  ```

  A build that stopped partway pushes its branch so its work is kept. To
  keep it, open a pull request from the branch on the code host. Otherwise
  delete the branch, and build the ticket again with `/kodor-build 12`.

Once you change the pattern, run `kodor config check`, then
`kodor sync` (every setting needs it, as
[How the file works](README.md#how-the-file-works) says), then see what the
pattern gives one ticket:

```console
$ kodor config check
✓ The settings are valid.
$ kodor ticket branch 12
feature/octocat/12
```

`kodor config check` stops on a placeholder it doesn't know, a pattern
without `{ticket}`, and a pattern git can't use as a branch name. Git
refuses a name that:

- has a space, a control character, `..`, `//`, or `@{`
- has any of `~`, `^`, `:`, `?`, `*`, `[`, or `\`
- starts with `-` or `/`, or ends with `/`, `.`, or `.lock`
- has a part between slashes that starts with `.` or ends with `.lock`

Anything else is fine, `#` and `_` included. The check names the first
fault it finds:

```text
.claude/kodor.yaml: code-host.branch-name: feature//{ticket} can't be a git branch name: it has //
```

Commit `.claude/kodor.yaml` and `.claude/kodor.lock`. The next build
uses the new pattern; branches already pushed keep their names.

## `code-host.labels`

The names of the four labels on pull requests. They stay on your code
host whatever ticket system you use. Most repositories never set them:
leave the block out, and each label's name is its key.

```yaml
code-host:
  branch-name: "{ticket}"
  labels:
    merge-automatic: auto-merge
    merge-manual: needs-owner
    verdict-override: owner-pass
    policy-override: owner-accepts
```

| Key                | What the label marks                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merge-automatic`  | The pull request [merges itself](../../workflow/merge.md#who-merges) once every check passes                                                       |
| `merge-manual`     | The pull request [waits for a person](../../workflow/merge.md#who-merges) to merge it                                                              |
| `verdict-override` | A person passed the automated review's verdict on the newest commit, its ruling on whether it is ready. Sessions never add it, under any name      |
| `policy-override`  | A person accepted what an [approval policy](../../features/approval-policies.md) found on the newest commit. Sessions never add it, under any name |

- **The two merge labels appear only if you use
  [`auto-merge`](auto-merge.md#auto-merge)**, with a pattern under `auto-merge.allow`.
  Otherwise no pull request gets either, whatever you name them.
- **The override matters only with [`pr-review`](pr-review.md#pr-review) on**, since
  that review gives the verdict, and `policy-override` only with
  [`approval-policies`](approval-policies.md#approval-policies).
- **You don't create these labels either.** kodor creates each merge
  label the first time it adds it, and `verdict-override` the first time
  it posts "Review verdict" on a pull request, and `policy-override` the
  first time an approval policy waits. Only a person adds either to one.
- **Naming a label doesn't turn on `auto-merge` or `pr-review`.**
- **New names take effect once they are on your default branch**, the
  one pull requests merge into, since the workflows that add and read
  these labels run from its copy. On a branch of its own, a rename
  changes nothing yet, and pull requests keep getting the old names.

The rules under [`tickets.labels`](tickets.md#ticketslabels) hold here too: write
only the keys you change, give each label its own name, quote a name
with `: ` in it, and rename the label you have on the code host yourself.
Do that before the new name merges: after it, kodor creates a label
of that name, and the code host won't give a second one the same name. Then check
the file and sync:

```console
$ kodor config check
✓ The settings are valid.
$ kodor sync
wrote .claude/kodor.lock
wrote .github/workflows/kodor.yml
```

The second `wrote` line appears only when you rename `verdict-override`:
that workflow file names the label, so the sync rewrites it.
Commit `.claude/kodor.yaml`, the lock, and any workflow `kodor sync`
wrote, and merge them.

**It worked when** `kodor config explain` shows your names under
`code-host.labels`, without `# default` after them, and once merged, the
next pull request the merge policy labels gets your name.
