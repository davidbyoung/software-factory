@.claude/lunamill/rules.md

This repository is Lunamill itself: the npm package
`@lunamill-ai/lunamill`, its docs, and its tests. It also uses Lunamill on itself, so the skills, agents, rules, and workflows under
`.claude/` and `.github/` are copies of this repository's own source,
written by `lunamill sync`.

## Stack

- TypeScript run directly by Node 22.18 or later, with no build step except
  `prepack`, which compiles `src/` to `dist/` for the published package.
- Vitest for the unit tests, Prettier for formatting, and Playwright for
  the site comparison's check.
- Releases publish to npm from `.github/workflows/release.yml`.

## After every code change

Run the gate before reporting the task as done:

```bash
npm run format                  # auto-format with Prettier
lunamill gate   # commands.gate in .claude/lunamill.yaml
```

The gate here is `npm run check`: format, types, specs, Lunamill's
files and settings, and the unit tests with coverage, which fail under
the coverage floors set in `vitest.config.ts`.

A hook runs the `commands.before-commit` commands in `.claude/lunamill.yaml`
before every `git commit` on a person's machine and blocks the commit if
one fails.

The other commands Lunamill's skills run here:

```bash
lunamill test-one PATH "NAME"   # one unit test, by commands.test-one
lunamill specs check            # the spec check, after an OpenSpec change
npm run pack-check                              # pack, install into an empty repository, and run it there
npm run site-check                              # the site comparison against the sample sites, with a browser
```

CI runs the same checks on every pull request, in `ci.yml` (format, types,
specs, unit tests under the same coverage floors, `pack-check`, and
`site-check`, and uploads the coverage to Codecov) and the "Lunamill files
in step" job of the synced `lunamill-review.yml` (Lunamill's files and
settings, and that `lunamill.yml` is enabled). There is no end-to-end suite.

## Rules by area

- `docs/developing.md`: how the package is laid out, how to run it from
  source, how to change a skill or add a ticket system, how a command's
  output reads, and how to release.
- `README.md` and `docs/`: "Writing for Lunamill" in
  `docs/developing.md`, read before changing a page.
- Tests follow "Small changes" and "Branching, pushing, and review" in
  `.claude/lunamill/rules.md`. A test is seen failing first, by its red run
  or one mutation, and a test that reads a workflow reads its YAML, as
  `tests/release-workflow.test.ts` does.

## Small changes: this repository

No change here sends anything to an outside service from a visitor, so no
small change keeps `lunamill-test-reviewer` for that reason. There is no
website and no design guide, so no style tweak needs a test, and there is
no UI reviewer: `docs-reader`, the one reviewer plugin, reads the docs.

- **The docs** (`README.md` and `docs/`) count toward a change's size:
  they are not content. Their reviewer is `docs-reader`, whose
  description says when it applies. A session the owner steers considers
  it as a build does, when a change that is not small touches them: if
  that description fits, it runs the reader before opening the pull
  request and fixes its findings, and the body says what the read found,
  or why it was skipped. A small change that touches only the docs
  needs no new test: the docs tests
  in the gate are its check.
- **A dependency bump** is made by a session, by hand, since there is no
  Dependabot here yet. `package-lock.json` does not count toward a change's
  size, and the gate with `pack-check` is its check, with no new test.

## Branching, pushing, and review: this repository

- **The board** is https://github.com/orgs/lunamill-ai/projects/1, board 1
  of `lunamill-ai`, which owns this repository. The board at
  https://github.com/users/davidbyoung/projects/1 is the repository Lunamill was drawn out of, and no longer this one's.
- **Builds start from a session.** `builds.trigger` is `manual`, so moving a
  card to Ready starts nothing, and no poller runs for this repository.
  Wherever the rules or a skill say a card moved to Ready starts a build,
  or that the poller starts one, read it here as: the owner tells a session
  to work the ticket, and the session builds it. A finished refinement's
  report says so, not that Ready builds it. Blockers still matter:
  `lunamill ticket claim` stops on an open one.
- **A release is the owner's.** The owner runs **Release** on the Actions
  tab with patch, minor, or major, and `release.yml` raises the highest
  version tag, publishes once CI passes on `main`'s commit, and tags it
  last (`docs/developing.md`, "Releasing"). No pull request raises
  `version`: `package.json` keeps `0.0.0-development`.

## What merges without the owner: this repository

Nothing. There is no `auto-merge` in `.claude/lunamill.yaml`, so every pull
request waits for the owner, since every change here reaches every
repository that uses Lunamill. The merge policy does not run, so no
pull request gets a `merge-automatic` or `merge-manual` label or a
`Who merges` status: where the rules or a skill name either, read it as
"waits for the owner".

## Spec track: this repository

`specs` is `openspec` here. A ticket gets the `spec` label when it changes
what a Lunamill user sees: a command's output or exit, a setting, which
files Lunamill writes into their repository and where, or when a job
of the workflows their two files call runs, or of `poller.yml`, the
workflow an organization's `lunamill-poller.yml` calls. The text of
its skills, agents, rules, and review instructions is not spec-tracked,
since prose has no test to map a scenario to: a change to it goes through
the fresh-agent trace in "Changing the process" instead. `openspec/specs/` holds a spec for
each capability a ticket has changed, as `lunamill specs
list` prints them; behavior with none gets one when a ticket next changes
it. The docs stay the reader's guide, and a spec change updates them in
the same pull request. Lunamill's spec check,
`lunamill specs check`, sets `DO_NOT_TRACK=1` for OpenSpec
itself, and so does the `spec:validate` script the gate and CI run.

## Refining: this repository

**Draft the experience first.** Before step 1 of `lunamill-refine`, run
`/dx-first N`, the `dx-first` skill, on a ticket that adds or changes a
command, a command's output, a setting, a file Lunamill writes, or a
docs page, and whose body has no `## Proposed docs` yet. Each is what a
Lunamill user meets, as "Spec track: this repository" reads them: the text
of a skill, agent, rule, or workflow is not one, nor is this repository's
own `.claude/lunamill.yaml`, and a docs page is `README.md` or one under
`docs/` other than `docs/developing.md`. Skip it for a small change
("Small changes" in `.claude/lunamill/rules.md`), and a bug fix that restores
intended behavior. When `dx-first` posts its
draft as a comment and waits, refinement stops there too.

**Refine from `## Proposed docs`.** Each behavior it shows, in a
transcript, a file, a diagram, or the docs page, becomes a Spec line, or
an acceptance criterion on a ticket without `spec`. A draft line that
would be expensive to build is put to the owner as a question, not
reworded: the owner approved the draft as written. `## Proposed docs`
stays in the body, after the owner's text and before `## Decisions`, as
part of §1 when refinement writes the body. A fix `dx-first` made to a
fact in the owner's text, and named, is not a change to §1.

**An approved draft is saved first.** The newest round waiting on the
owner is a `dx-first` draft when its comment ends
`<!-- dx-first: draft -->`. When `lunamill-build` folds an approved round
and that round is a draft, run `dx-first` to save the draft with the
approvers' replies folded in, then fold and check the body as
`lunamill-refine` does. When the owner asks a session to build a ticket
whose draft waits and whose body has no criteria yet, `lunamill-build`
runs refinement and stops, as it does for any such ticket: that request
is the owner saying to save, so `dx-first` saves the draft and refinement
carries on to its own end. The owner then approves the refined ticket as
usual.

## Issues that wait on another: this repository

**A new ticket gets its blockers checked.** A session the owner steers
that opens issues, by any command, runs the `ticket-order` skill on them
once before finishing, as `/ticket-order N M ...`, so the links in both
directions are proposed in one question while the owner is there to
approve them. A run in GitHub Actions skips it,
since nobody can answer its question.
Refinement's own check of the build order is unchanged. The owner runs
`/ticket-order` for the order of every open ticket.

## Changing the process: this repository

The source of every Lunamill file is in this repository: `skills/`,
`agents/`, `approval-policies/`, `rules.md`, and `review.md`, and, for
the two workflow files a repository gets, `src/workflow-files.mts`. Change the source, run
`node bin/lunamill.js sync`, and commit both; CI's `Lunamill files in step`
fails when a copy differs from its source. Never edit the copy under
`.claude/` or `.github/`.
These are not copies: they have no source elsewhere and are edited where
they are.

- `.github/workflows/run.yml`, the three groups it calls
  (`run-pull-request.yml`, `run-tickets.yml`, and
  `run-default-branch.yml`), `review.yml`, and `session.yml`, the
  workflows every repository's two files call. Here those two files,
  `lunamill.yml` and `lunamill-review.yml`, call the copies in the same
  commit, so a pull request's own `review.yml` runs on it, and `run.yml`
  runs from `main`.
- `.github/workflows/poller.yml`, the workflow an organization's
  `lunamill-poller.yml` calls. No file here calls it.
- `.claude/agents/docs-reader.md`, this repository's own reviewer.
- `.claude/skills/dx-first/` and `.claude/skills/ticket-order/`, its own
  skills.

The code that decides what runs and who merges, which the trace also
covers, is everything under `src/` that a workflow, a hook, or a skill's
gate runs, and the commands a person runs to set a repository or an
organization up: in particular `merge-policy.mts`, `review-verdict.mts`,
`poller.mts`, `parts.mts`, `sync.mts`, `board.mts`,
`ticket.mts`, which starts the board sync, `approval-job.mts`,
`approval-policies.mts`, `approval-agent.mts`, and
`approval-policies/credentials/find.mts`, which decide what waits for a
person,
the `guard*.mts` files, `lib/work-status.mts`, `commands.mts` and the
`lib/plan.mts`, `lib/changes.mts`, and `lib/paths.mts` it and the commit
guard decide what runs with,
`workflow-files.mts`, `session.mts` and the `session-*.mts` files,
`handoff/`, `agent/claude-code-session.mts`, `review-record.mts`,
`enroll.mts`, `follow-ups.mts`,
`init.mts`, `init-org.mts`, `setup.mts`, `code-host/github-app.mts`,
which holds the App's permissions, `update.mts`,
`lib/default-branch.mts`, `lib/refined-check.mts`, `specs/`, whose
adapters name the files the merge policy holds, and `config.mts`'s
`pluginsOf`.

A change here reaches every repository that uses Lunamill, through its
next release, so the fresh-agent trace in "Changing the process" in
`.claude/lunamill/rules.md` reads `.claude/change-types.md` here and asks,
for each kind, both how it goes here and how it would go in a repository
that installs Lunamill.

## Stepping back from a rabbit hole: this repository

- **Reading what GitHub would close** (#74, 2026-11-24). A matcher of closing
  words in a cloud build's text was got past in three rounds, each by a form
  it did not read, and by the third it refused honest text. No library was
  tried, since one reads words too, and does not ask GitHub. It went back to
  the forms GitHub documents, in one expression, and Publish asks GitHub
  itself what the pull request would close. What is left is in "What a
  hijacked session could still do" in `docs/security/risks.md`: do not extend
  the matcher for it.
