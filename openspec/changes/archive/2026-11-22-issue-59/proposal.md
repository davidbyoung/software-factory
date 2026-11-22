# Make factory-generated labels configurable

From [#59](https://github.com/davidbyoung/software-factory/issues/59).

## Why

#### What and why

Today, labels like "spec", "factory", and even PR labels have sensible defaults. however, these should be overridable in the factory.yaml (likely not worth prompting them during `factory init` as it starts to get too cumbersome to spell out). These label configs should be under the appropriate top-level config values already existing today - avoid adding new top-level config values unless it's truly the right course.

#### Done when

- Users can customize the labels they use for tickets and PRs
- The factory respects those labels and does not hard-code them
- New config values are nested under an appropriate top-level config value wherever possible

#### Where

_No response_

## What Changes

- **Where the names go:** ticket labels under `tickets.labels`, pull request labels under `code-host.labels`, each keyed by role. No new top-level key. Putting the pull request labels under `auto-merge` or `pr-review` was rejected, since writing either block turns that part on.
- **Which labels:** `spec` and `follow-up` on tickets; `merge-automatic`, `merge-manual`, and `verdict-override` on pull requests. The `factory` label is not built yet: #61 adds it as a third key under `tickets.labels`.
- **The pull request labels get new default names:** `merge: automatic`, `merge: manual`, and `verdict: override` become `merge-automatic`, `merge-manual`, and `verdict-override`, so every default name equals its key, has no space or colon, and needs no quotes. The table in Proposed docs shows each tool's documented rules.
- **Existing repositories:** nothing migrates their labels, and `factory doctor` does not warn about an old name, the earlier defaults included. A pull request labeled before the update keeps its old label.
- **`factory init`** neither asks about labels nor writes a `labels` block. `factory sync` writes all five names into `.claude/factory.lock`, defaults included.
- **Skills, rules, agents, and workflow prompts name a label by its key,** and the `factory` commands translate a key to the configured name. `factory sync` does not rewrite names into the copied files: `spec` is also a spec tool, a `tickets.fields` key, and an ordinary word, so a rewrite could not find each label mention reliably.
- **Checking a name** belongs to each tool's adapter. GitHub's docs set no rule beyond a name not being empty, so GitHub's check refuses only an empty name. No length limit is checked: the 50-character figure often quoted has no GitHub source.
- **Two roles can't share a name,** compared ignoring case, which is stricter than GitHub documents. When the ticket system and the code host are the same tool (`github` and `github`), the five names are compared together, since one repository's labels serve both.
- **A builder plugin's `labels`** may name a factory label, such as `spec`: no check.
- **The "shortest file" docs** show every required setting: `commands.gate` (added by the owner, which init lists under "Left to do"), and with a board, `tickets.board` and all six `tickets.columns`.
- **Build order:** #61 waits on this ticket, since building #61 first would hard-code the `factory` label's name that this ticket makes a setting. #14, which touched `src/review-verdict.mts`, is closed, so nothing here waits.
