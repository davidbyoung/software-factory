# Proposal

From [davidbyoung/software-factory#82](https://github.com/davidbyoung/software-factory/issues/82). The ticket's "Proposed docs" are the approved design and docs.

## What and why

The factory has no security review in its process. Refinement, the readiness read, the test reviewer, the docs reader, and the process trace each look for something else. The first reader that looks at security is the automated review, which runs once a pull request is marked ready, when everything is already built.

On #74 that cost an evening. The design kept a GitHub App's private key beside an unattended agent, and the automated review of davidbyoung/software-factory#80 was the first step that stopped it, after the whole ticket had been refined, built, and tested.

The owner asked on 2026-11-24 for a ticket "to get security review into my factory where appropriate", with the acceptance criteria to be decided: "we need to figure out when to run this, when not to, and whether this only applies to my factory itself or to consumers of the factory."

## Done when

- Every repository has the approval policy `credentials` with nothing to write, as a default `factory config explain` shows, its rule and reader written by `factory sync`, and `off: true` turns it off.
- A pull request that adds a credential's name, a secret passed to a workflow, write access for a workflow, a workflow file, or a `pull_request_target` trigger, outside tests, specs, and docs, is read by a separate agent with Opus, handed only those lines, and a High it finds waits for a person's `policy-override`.
- Any other pull request takes no new step for a session, and its status reads `Nothing to approve`.
- Refining a ticket that names a credential the default branch doesn't have, outside docs and tests, or write access for a workflow, needs a `## Threats` section, which `factory ticket refined` checks.
- Approval policies' five defects the review of this ticket found are fixed before their first release: an agent's prompt goes on standard input; the agent can't read `/proc`; a `run`-and-`agent` policy holds the merge only when its command found something; a cleared change's Details list what was read; and a commit's review runs are found by `head_sha`.
- The docs say what the policy reads, what to do when it waits, what it costs, what it misses, and how to turn it off.

## Settled in the docs-first draft

- **When it runs:** on the design, as a `## Threats` section refining writes for a ticket that names a new credential, and on the pull request, on every push.
- **When it does not:** when `find.mts` picks nothing, which is most pull requests; the reader never runs.
- **Whom it is for:** every repository that uses the factory, on by default, with `off: true` as for any policy.
- **What it reads for:** credentials and what a workflow may do. A site's own logins, forms, or payments are a repository's own policy or reviewer.
- **Who decides a finding:** a person, with `policy-override`. Only a High waits.
- **What it costs:** no step for a session; three Actions jobs per push to a ready pull request; about a minute and a few cents where the reader runs.
- **What already exists:** none fits, as round 3 measured: Claude Code's `/security-review` dropped #74's hole as Medium, the Actions security review and Code Review bill outside the subscription, scanners such as zizmor, gitleaks, and CodeQL don't follow a credential to an AI, and CodeQL costs per seat on a private repository.

## Taken in from #83

#83 was closed in favor of this ticket on 2026-11-24, with the owner's agreement. What it asked for that can be enforced comes here:

- **A High holds the work.** A High finding is never deferred or built around without the owner's answer, whether the session is attended or not. Open: whether that holds every High, or only one whose fix is a trade-off. Ten of the 232 pull requests in this repository and the other repository had a High; most were plain bugs.
- **A script decides what is sensitive, from the diff.** A change is sensitive when, outside tests, specs, and docs, it adds a credential's name the repository did not have, passes a secret to a workflow, or gives a workflow write access. Run over the 254 changes on both repositories' `main`, that rule picked 24 (9 of 47 here, 15 of 207 in the other repository), the smallest 101 lines. Matching words such as "token" instead picked 57. It is a match on text, so an unusual form can get past it.
- **The review runs on each later change to those lines,** not only on the design. #74's hole was not in the design: a token's renewal was added mid-build.
- **The threats of a credential change, and the established ways to handle them, are in front of the owner before code is written.**
- **A small change takes no new step and no measurable extra time,** and a test in the gate keeps it that way. A one-sentence edit to a site is the test case, timed before and after.
- **What can be a script that refuses is one.** On a person's machine a session acts as that person, so a refusal there stops a careless session, not one working around it.

**Accepted, and not to be built here:** between reviews, a session can still overrule a risk an agent reports, when the change touches no credential and the review does not rate it High. Having agents flag such a risk in their reports was drafted and dropped, since it rests on the agent and the session keeping an agreement.

## Related

#74, the change that prompted this. #83, closed in favor of this. #104, approval policies (named guards when this was written), merged 2026-11-26: the owner decided on 2026-11-25 to build it first and this as the first policy the factory ships, so its hold, its reader, and how a person answers are built once. This also fixes five of #104's defects before its first release.

## Decisions

- **What #82 is:** the first approval policy the factory ships, `credentials`, written exactly as a repository would write one (`run`, `agent`, `files`), in every repository by default. Agreed 2026-11-26, after #104 merged.
- **No hold on a session's commit** (round 3's Q4): it holds on the pull request, as every policy does. #104's later decision wins, since building #82 as its first policy was the point of building #104 first.
- **`off: true` turns it off,** as for any policy (round 3's Q3 said no off, for not adding a setting; `off` is no new setting).
- **Only Highs wait** (round 3's Q2): the reader reports only Highs. Mediums are dropped, as #104 dropped warnings.
- **`## Threats` at refinement** (round 3's Q1) stays: the one part outside approval policies, since no pull-request check sees a design, and #104 left it to #82.
- **The rule's script is TypeScript,** `find.mts`, run by Node as the factory's own code is; a repository's own example stays JavaScript.
- **The reader runs with Opus,** named in its agent file: on #74, Opus found five Highs and Sonnet two.
- **Five fixes to approval policies are folded in** (owner, 2026-11-26), found by a review of round 4 and confirmed against the code, so approval policies are fixed before their first release: the prompt on standard input (one argument over 128 KiB fails with `E2BIG`), no `Read` of `/proc`, the merge hold only when a `run`-and-`agent` policy's command found something, a cleared change's Details listing what was read, and review runs found by `head_sha` (a scratch repository showed a `pull_request_target` run's `head_sha` is the pull request's head).
- **The widened rule** adds the forms the review found missed: `secrets['X']`, `toJSON(secrets)`, `secrets: inherit`, quoted and inline `write` permissions, a new or moved workflow, a `pull_request_target` trigger, and names ending `KEY`, `PAT`, or `AUTH`. The build measures it over the last 257 changes, and the docs give the counts.
- **The example policy in the docs is renamed** from `credentials` to `raw-sql`, so copying it can't replace the factory's own.
- **Release waits for this:** `main` holds #104's defects until #82 merges.
- **Settled while refining, from the code and earlier decisions:**
  - **What the reader sees:** the default branch's code, checked out, and the change as its input's diff, never the pull request's own code checked out, which `workflows.test.ts` keeps any job from doing. Its wording says so in place of round 3's "the folder is the whole repository after it".
  - **A credential's name** is an uppercase whole word matching `[A-Z][A-Z0-9_]*_(TOKEN|SECRET|PASSWORD|KEY|PAT|AUTH|CREDENTIALS?)`, `GITHUB_TOKEN` aside. "New" is a whole-word miss in the default branch's files outside docs and tests. The underscore keeps `COMPAT`, `HOTKEY`, and `OAUTH` out.
  - **The Threats check** reads the owner's text only: the body's lines before its first `## ` heading, outside code fences, for `spec` and other tickets alike. It prints one line naming every name it found, and needs only the heading.
  - **A `run`-and-`agent` policy's command that fails in the merge policy holds the pull request,** as a failed check waits in the approval jobs; with `in`, it runs once for each folder, as in the jobs.
  - **A cleared change's Details** list the command's findings, `file:line` and title, under a heading `NAME: cleared by AGENT, not a person`.
  - **Workflow files** are those under `.github/workflows/`. A workflow this repository writes from TypeScript is picked once `factory sync` writes its file into the same pull request.
  - **From #83:** "A High holds the work" is the policy itself, and "every High or only a trade-off" is round 3's Q2. "A small change takes no new step" is a test: a one-sentence docs change runs no agent and gives a session no new step. The timing is that test, since no step means no time.
  - **Which ref `find.mts` searches:** the input's `base` commit where the checkout has it, as on a person's machine, and the checkout's `HEAD`, the default branch's tip, where it doesn't, as in the jobs' shallow checkout. The input needs no new field.
  - **Finding titles and lines:** `Write access: contents: write`, the matched pair or `write-all`; a `pull_request_target` trigger is that word as a YAML key or list item on an added line, outside a `#` comment; a rename from one workflow to another under `.github/workflows/` is not new. Each finding carries its added line's number in the new file, and a new or moved workflow carries line 1.
  - **Turning it off** removes both files, as `factory sync` already deletes a file its lock lists and no longer writes.
  - **The Threats check's lines:** a ticket with both a new name and write access gets two `missing:` lines, after the others, credential first.
  - **No window during the update:** the default policy and `find.mts` arrive in the same commit, the update's pull request, so no merge policy runs a missing command.
  - **Built on a person's machine:** it edits `.github/workflows/`, and `builds.trigger` is `manual` here, so the owner tells a local session to build it.
  - **The measurement's bar** (owner, 2026-11-26): if the widened rule picks more than 40 of the 257, the build narrows `_KEY` to `_API_KEY`, `_PRIVATE_KEY`, `_ACCESS_KEY`, and `_SECRET_KEY`, measures again, and puts both counts in the pull request for the owner.
  - **The measurement** reads the merged pull requests of this repository up to #109, and the other repository's merged by 2026-11-26, with `gh`, read-only, on the builder's machine, the same set the review of round 4 read; where the other repository can't be read, the docs say the counts are this repository's.
