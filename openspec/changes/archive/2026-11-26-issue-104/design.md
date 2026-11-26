# Design

## Where it goes

- `src/config.mts`: `approval-policies` in `SETTINGS_KEYS` and the schema, parsed as a list of command items for some folders (reuse the `in`/`files` parsing of #75) with `name` and `agent`; validation for line 1; layering by `name` with `off: true` as plugins have it (`pluginsOf`).
- `src/preset.mts` and `src/sync.mts`: copy `approval-policies/NAME/` as `agents/` is copied, record it in the lock, and the `--in` scoping as for commands.
- `src/approval-policies.mts` (new): which policies apply to a set of changed files (lines 2 and 21), building each policy's input from git (4 to 6), running a `run` check with a scrubbed environment and a 30-minute limit (6 to 8), reading the answer, and deciding the status (12 and 13). Pure functions over their inputs, tested without GitHub.
- `src/approval-policies-check.mts` (new): the command, lines 23 to 26, through `src/lib/output.mts`; added to `src/commands-list.mts` as a person's command.
- `src/approval-verdict.mts` (new), the job's entry: reads the event, the labeler (`labeledBy`, as it is), write access, and the findings, decides lines 15 to 20, and posts the status, its summary, and comments. Mirror `src/review-verdict.mts`'s shape, with one difference: the commit approved is the labeled event's payload `pull_request.head.sha`, compared with the head read when the job runs, never the head alone.
- **Where findings live between runs:** the status job uploads every policy's answer as the artifact `approval-policies-PR-HEAD`, with the longest retention the repository allows. A labeled event's run finds it by name through the artifacts API (`actions: read`), and trusts it only when its run's workflow path is `.github/workflows/factory.yml` and its event `pull_request_target`, which a pull request can't change, since that event runs the default branch's file. A run's `head_sha` is the base branch's under `pull_request_target`, so runs are never matched by it. With no such artifact, the label approves nothing (line 16), and the checks run again. An approval is kept the same way, as `approval-policies-approved-PR-HEAD`, so a later run on that commit (line 18) can leave it standing.
- **Concurrency:** the checks' jobs in the group `factory-approval-PR-HEAD-BASE`, the label's in `factory-approval-label-PR`, both `cancel-in-progress: false`. GitHub keeps one waiting run per group and replaces it with a newer one, which line 18 allows.
- **When an agent can't run:** the job's condition checks `pull_request.head.repo.full_name != github.repository`, Dependabot as the review job does (`run.yml`), and `secrets.claude-token == '' && secrets.claude-api-key == ''`, as `run.yml` checks secrets today.
- **The draft status** is posted on `opened` as a draft and on `converted_to_draft`, which `factory.yml` already starts on (line 3).
- **Edits to the ticket or the body** don't check again: a push, a base change, or **Re-run** does. The ticket is input the author controls either way.
- **The ticket:** the job with a token reads it with `tickets.linksIn` on the pull request's body, as `src/merge-policy.mts` does, and the ticket system's `read`.
- **The change:** a first job, with `contents: read` and `pull-requests: read`, fetches `refs/pull/N/head`, which reaches a fork's commits, builds each policy's input from git and the ticket, and uploads it as an artifact; the check jobs download it through the run's own artifact token, check out the default branch with `persist-credentials: false`, and hold no GitHub token. The builder confirms on a scratch repository that a fork's pull request and a private repository both work.
- **An agent's run:** `src/agent/claude-code-session.mts`, with tools `Read`, `Grep`, and `Glob` only, no Bash, and no web tools. Its instructions are the agent's own file, as for a plugin; the factory adds the input JSON, the command's findings when there are any, and the answer's shape, in `src/approval-policies.mts`.
- `.github/workflows/run.yml`: three jobs in one concurrency group per pull request, `cancel-in-progress: false` (line 18): checks with `run` (permissions `contents: read`, `persist-credentials: false`, no token in the step's environment); one job per agent policy that applies (`permissions: {}`, `persist-credentials: false`, the session's sandbox settings with read-only tools, `cache-mode: none`); and the job that posts the status from their JSON (`statuses: write`, `pull-requests: write`, `issues: write`). Triggers: `pull_request_target` opened, reopened, synchronize, ready_for_review, `edited` with `changes.base`, and labeled or unlabeled with the label's name; `pull_request_review` submitted.
- `src/workflow-files.mts`: the `approval-policies` part, the label's name, and `edited` in `TARGET_ACTIONS` (line 33).
- `src/labels.mts`: `policy-override` in `PR_LABELS`. `src/pr.mts`, `src/ticket.mts`, and `src/guard-commit.mts`: refuse it as `verdict-override` is refused.
- `src/merge-policy.mts`: line 29, from the default branch's settings.
- `src/enroll.mts`, `src/code-host/github.mts` (`requireCheck` adds a check to the existing ruleset instead of returning when the rule exists), `src/init.mts`, `src/doctor.mts`: lines 27 and 28. `src/parts.mts`: the agent token's need for a policy with `agent`.
- `src/explain.mts`: line 35.
- The docs pages, line 39, from "Proposed docs", and the `docs/cli.md` rows.
- `openspec`: `factory specs new 104`, then `factory specs finish 104` in the same pull request.

## Contracts

- Status context `Approval policies`; descriptions as lines 5, 8, 11 to 13, and 15, each kept under GitHub's 140 characters by naming policies, not findings.
- Check input: the JSON of line 6. Output: `{ "findings": [{ "file", "title", "line"?, "why"? }] }`.
- Label key `policy-override`; merge reason as line 29.
- Concurrency group `factory-approval-${{ pull_request.number }}`, `cancel-in-progress: false`.

## States

The status, per pull request head: `draft` → (marked ready) → `checking` → `nothing` (success), `cleared` (success, line 12), or `waiting` (pending; findings, a failed check, an agent that can't run, or an unreadable change) → (label by a writer on this head) → `approved` (success). A push or a base change returns to `checking` and takes the label off.

## Edge cases

- A renamed file matched under either name; a folder only the pull request adds under `in: services/*`.
- A label added on a draft approves nothing, since nothing waits yet.
- A label added by someone without write access, or on a head that is no longer the pull request's.
- More than 3000 changed files: git, not the API.
- A fork's pull request: `run` checks run; agents can't (line 11).
- A check that prints to standard error and exits 0 with valid JSON is an answer.

## Risks and rollback

- A broken check makes every matching pull request wait: turn it off with `off: true`, which applies from the next pull request, or approve with the label.
- A broken job makes the required status pend everywhere: an admin removes **Approval policies** from the factory's ruleset while it is fixed.
- This changes what decides a merge (`merge-policy.mts`, `workflow-files.mts`, `enroll.mts`, the workflows), so the build runs `factory-trace` before the pull request is marked ready.

## Dependencies

- #82 is blocked by this, recorded.
- No owner-only steps: this repository has no policy of its own, and the tests use one that lives only in the tests.
