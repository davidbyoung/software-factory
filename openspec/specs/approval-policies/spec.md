# approval-policies Specification

## Purpose

Checks whose findings make a pull request wait until a person who can write accepts them with the `policy-override` label: which changes set a policy off, what its check reads and answers, the "Approval policies" status, how the label approves one commit, `factory approval-policies check`, and requiring the status.

## Requirements

### Requirement: Policies in the settings

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Policies in the settings

- **WHEN** `.claude/factory.yaml` or a preset sets `approval-policies`
- **THEN** it is a list of policies, each with a `name`, `run`, `agent`, or both, and `in`, `files`, or both; `factory config check` fails, naming the item and what it lacks, on an item without a `name`, without `run` or `agent`, or without `in` or `files`, on two items of one name in one file, and on an `agent` with no file in `.claude/agents/`.

### Requirement: Which changed files a policy selects

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Which changed files a policy selects

- **WHEN** a policy has `in` and `files`
- **THEN** they select a pull request's changed files as they do for a command for some folders, except that `*` in `in` also matches a folder only the pull request adds, a renamed file counts under its old path and its new one, and each folder of `in` is checked on its own, named in what it finds as `NAME in FOLDER`.

### Requirement: When policies run

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: When policies run

- **WHEN** a pull request that is not a draft is opened, reopened, pushed to, marked ready, or has its base branch changed
- **THEN** the factory runs each policy that applies to it, as the default branch's settings and lock give them, from the root of a checkout of the default branch; when one is opened as a draft or converted to a draft, the status is pending and reads `Checks when the pull request is marked ready`.

### Requirement: A policy's change comes from git

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A policy's change comes from git

- **WHEN** the factory builds a policy's input
- **THEN** `files` and `diff` come from git, comparing the pull request's head with its merge base, and hold only the files the policy applies to, and with `in`, only that folder's; `diff` is a unified diff, as `git diff` prints it.

### Requirement: A change git can't read

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A change git can't read

- **WHEN** git can't compare the head with the merge base
- **THEN** every policy waits, and the status reads `The change couldn't be read, so every policy waits for approval`.

### Requirement: What a check reads

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: What a check reads

- **WHEN** a check runs
- **THEN** it reads on standard input one JSON object with `version` (1), `repository`, `pull`, `base`, `head`, `files`, `diff`, `in` (null without it), and `ticket`: `{ id, text }`, where `id` is the ticket's key as the ticket system writes it, such as `74` or `ACME-12`, and `text` its body, for the first ticket the pull request's body closes, or else the first it is part of, as the merge policy reads them, or null when it names none. Its environment holds no GitHub token and its checkout no git credentials.

### Requirement: A check's answer

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A check's answer

- **WHEN** a check exits 0 and prints `{ "findings": [...] }`, each finding with a `file` from the root and a `title`, and optionally a `line` and a `why`
- **THEN** each finding waits for approval, and `{ "findings": [] }` means it found nothing.

### Requirement: A check that fails

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A check that fails

- **WHEN** a check, a command or an agent, exits with another code, answers with anything but that JSON, or has not answered after 30 minutes
- **THEN** everything its policy applies to waits, and the status names it as `NAME: the check failed, so everything it applies to waits for approval`.

### Requirement: How an agent runs

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: How an agent runs

- **WHEN** a policy has `agent`
- **THEN** the agent runs in a job of its own with no GitHub permissions, no persisted git credentials, no cache, tools that only read, and no web access, signs in with `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`, is handed the same object, and answers in the same shape.

### Requirement: A command and an agent together

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A command and an agent together

- **WHEN** a policy has both `run` and `agent`
- **THEN** the agent runs only when the command found something, is handed the command's findings with the object, and only what the agent reports waits.

### Requirement: An agent that can't run

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An agent that can't run

- **WHEN** a policy's agent can't run, on a pull request whose head is in another repository, on one Dependabot opened or last pushed to, or with neither secret set, as the job's condition tells from the event and from the secrets being empty
- **THEN** everything its policy applies to waits, and the status names it as `NAME: AGENT can't run here, so everything it applies to waits for approval`, whichever the cause.

### Requirement: Cleared by an agent

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Cleared by an agent

- **WHEN** an agent finds nothing, or clears everything its command found
- **THEN** the status names it as `NAME: cleared by AGENT, not a person`, and not as `Nothing to approve`.

### Requirement: The Approval policies status

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: The Approval policies status

- **WHEN** the factory posts the **Approval policies** status
- **THEN** it is pending while anything waits and a success otherwise, never a failure, and reads `Nothing to approve` when no policy applies or each one's command found nothing, `Checks when the pull request is marked ready` on a draft, `NAME: N waiting for approval. To accept it, add the policy-override label` when one policy waits, and `N policies waiting for approval: NAME, NAME in FOLDER. To accept them, add the policy-override label` when several do, or `N policies waiting for approval. To accept them, add the policy-override label` when naming them would pass GitHub's 140 characters, with the label's configured name.

### Requirement: Where findings are kept

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Where findings are kept

- **WHEN** the status has findings
- **THEN** its link opens the run's summary, which lists each finding by policy and folder with its file, line, title, and why, and the run keeps every policy's answer as the artifact `approval-policies-PR-HEAD-BASE`, named by the pull request's number, its head commit, and its base branch, for the longest the repository allows.

### Requirement: Approving with the label

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Approving with the label

- **WHEN** someone adds the `policy-override` label, and GitHub's labeled event names someone who can write to the repository, and the head commit in the event's payload is the pull request's head when the job runs
- **THEN** the findings in the artifact `approval-policies-PR-HEAD-BASE` for that commit, from a run of `.github/workflows/factory.yml` started by `pull_request_target`, are approved, the approval is kept as the artifact `approval-policies-approved-PR-HEAD-BASE`, the status reads `Approved by @LOGIN at SHORT-SHA`, and the factory comments the approved findings, by policy, for people to read.

### Requirement: A label that approves nothing

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A label that approves nothing

- **WHEN** the labeled event names someone who can't write, or its payload's head commit is no longer the pull request's, or no finished run for that commit has the artifact
- **THEN** the factory takes the label off and approves nothing, with a comment saying why: who may add it, that a newer commit is unread, or that the checks run again first.

### Requirement: A push or a base change

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A push or a base change

- **WHEN** a push lands or the base branch changes
- **THEN** the factory takes `policy-override` off and checks again.

### Requirement: Overlapping runs

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Overlapping runs

- **WHEN** runs for one pull request overlap
- **THEN** the checks for one head and base run one at a time, and so do the label's runs; a run waiting behind another may be replaced by a newer one for the same head, base, or label, and each run decides from the pull request as it stands, so a check that finishes on a commit already approved, with nothing beyond what was approved, leaves `Approved by` standing.

### Requirement: An approving review

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: An approving review

- **WHEN** someone submits an approving review while a policy waits
- **THEN** the factory comments once, on that pull request, that the policy still waits and the label accepts it.

### Requirement: Creating the label

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Creating the label

- **WHEN** a policy first waits in a repository
- **THEN** the factory creates the `policy-override` label if the repository has none.

### Requirement: A pull request that changes a policy

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A pull request that changes a policy

- **WHEN** a pull request adds, changes, or turns off a policy, or its script or a preset's version
- **THEN** it is checked by the policies on the default branch, and the change applies from the next pull request.

### Requirement: Neither override passes the other

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Neither override passes the other

- **WHEN** `verdict-override` is on a pull request
- **THEN** it passes no policy, and `policy-override` passes no Review verdict; Dependabot's pull requests and a repository with `pr-review` off are checked like any other.

### Requirement: Checking locally

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Checking locally

- **WHEN** `factory approval-policies check` runs
- **THEN** it reads the policies from the working folder's settings and files, runs them against the working folder's changes, committed or not, untracked files included, since its merge base with the default branch on `origin`, with `pull` null, `base` that merge base, `head` the checked-out commit, `ticket` the one the branch is named for or null, and the person's own sign-in for an agent, posts nothing, and prints `approval-policies: N apply, for the N files changed since origin/BRANCH`, then a `✓ NAME: nothing to approve` or `? NAME: N waiting for approval` line for each policy, each finding under its policy as `FILE[:LINE]  TITLE`.

### Requirement: Checking a past pull request

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Checking a past pull request

- **WHEN** `factory approval-policies check --pull N` runs
- **THEN** it fetches `refs/pull/N/head`, checks that commit against its merge base with pull request N's base, with the ticket its body names as line 6 reads it and `pull` N, and its first line reads `for the N files #N changed`.

### Requirement: No policy applies locally

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: No policy applies locally

- **WHEN** no policy applies to the change
- **THEN** the command prints `- No approval policy applies to this change`.

### Requirement: A check that fails locally

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: A check that fails locally

- **WHEN** a check fails
- **THEN** the command prints `✗ NAME: COMMAND failed (exit N). Fix it, then run: factory approval-policies check` with the check's standard error after it, and exits 1; it exits 0 when policies wait for approval.

### Requirement: Doctor reports the status

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Doctor reports the status

- **WHEN** the settings have a policy and `factory doctor` runs
- **THEN** it prints `✓ "Approval policies" is required before a merge to BRANCH`, or `? "Approval policies" is not required before a merge to BRANCH` with what requires it, and, where a policy has `agent`, whether `CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY` is set.

### Requirement: Requiring the status

The factory SHALL behave as the scenario below says, in the Spec line's own words.

#### Scenario: Requiring the status

- **WHEN** the settings have a policy
- **THEN** `factory init` requires **Approval policies** on the default branch beside **Review verdict**, and on a push to the default branch the "Require the verdict" job requires it where its token can, whether or not `pr-review` is on, adding it to the factory's existing ruleset.
