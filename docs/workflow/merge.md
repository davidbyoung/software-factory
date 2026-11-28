# Merge

For someone deciding whether a pull request merges. At the end you know
who merges each pull request, and why it waits for you or merges itself.
Letting some merge without you is
[Pull requests that merge themselves](../features/auto-merge.md).

## Who merges

Every pull request gets one of two labels, which you can rename under
[`code-host.labels`](../reference/settings/code-host.md#code-hostlabels):

- **`merge-automatic`**: every file is allowed by your
  [`auto-merge`](../reference/settings/auto-merge.md#auto-merge) settings, and none of the
  commands you listed there held it. It merges itself once every check
  passes.
- **`merge-manual`**: anything else. It waits for a person to merge it,
  and a "Who merges" status on the pull request says what held it and
  why.

Three more things guard a merge:

- **"Review verdict"** is a status, which you can make required on your
  default branch, that passes only when the automated
  review of the newest commit said it is ready, or an approver overrode it
  with the `verdict-override` label. It goes by the review's own run, and
  by no comment, whoever posted it. Sessions never add that label.
- **"Approval policies"** is a status, which `factory init` requires
  beside it once your settings have an
  [approval policy](../features/approval-policies.md), that waits while a policy's
  check found something until a person who can write adds the
  `policy-override` label. Sessions never add that label either. Since an
  agent can be talked out of a finding, a pull request a policy with an
  agent applies to is `merge-manual`.
- **Every review thread must be resolved.** A session answers each one,
  fixed or rejected with evidence, before resolving it.

The labeling, the verdict, and the approval policies run from your
default branch's copy of the rules, so a pull request cannot change how
it is judged.

A session never merges, never turns auto-merge on, never overrides a
verdict, and never approves what an approval policy found.
