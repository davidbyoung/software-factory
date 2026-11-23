@.claude/factory/rules.md

This repository is the software factory itself: the npm package
`@davidbyoung/software-factory`, its docs, and its tests. It also uses the
factory on itself, so the skills, agents, rules, and workflows under
`.claude/` and `.github/` are copies of this repository's own source,
written by `factory sync`.

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
factory gate   # commands.gate in .claude/factory.yaml
```

The gate here is `npm run check`: format, types, specs, the factory's
files and settings, and the unit tests with coverage, which fail under
the coverage floors set in `vitest.config.ts`.

A hook runs the `commands.before-commit` commands in `.claude/factory.yaml`
before every `git commit` and blocks the commit if one fails.

The other commands the factory's skills run here:

```bash
factory test-one PATH "NAME"   # one unit test, by commands.test-one
factory specs check            # the spec check, after an OpenSpec change
npm run pack-check                              # pack, install into an empty repository, and run it there
npm run site-check                              # the site comparison against the sample sites, with a browser
```

CI runs the same checks on every pull request, in `ci.yml` (format, types,
specs, unit tests under the same coverage floors, `pack-check`, and
`site-check`, and uploads the coverage to Codecov) and the synced
`factory-check.yml` (the factory's files and settings). There is no
end-to-end suite.

## Rules by area

- `docs/developing.md`: how the package is laid out, how to run it from
  source, how to change a skill or add a ticket system, how a command's
  output reads, and how to release.
- `README.md` and `docs/`: "Writing for the factory" in
  `docs/developing.md`, read before changing a page.
- Tests follow "Small changes" and "Branching, pushing, and review" in
  `.claude/factory/rules.md`. A test is seen failing first, by its red run
  or one mutation, and a test that reads a workflow reads its YAML, as
  `tests/release-workflow.test.ts` does.

## Small changes: this repository

No change here sends anything to an outside service from a visitor, so no
small change keeps `factory-test-reviewer` for that reason. There is no
website and no design guide, so no style tweak needs a test, and there is
no UI reviewer: `docs-reader`, the one reviewer plugin, reads the docs.

- **The docs** (`README.md` and `docs/`) count toward a change's size:
  they are not content. Their reviewer is `docs-reader`, whose
  description says when it applies. A session the owner steers considers
  it as a build does, when a change that is not small touches them: if
  that description fits, it runs the reader before opening the pull
  request and fixes its findings, and the body says what the read found,
  or why it was skipped. A small change that touches only the docs, a
  line of a follow-ups build included, needs no new test: the docs tests
  in the gate are its check.
- **A dependency bump** is made by a session, by hand, since there is no
  Dependabot here yet. `package-lock.json` does not count toward a change's
  size, and the gate with `pack-check` is its check, with no new test.

## Branching, pushing, and review: this repository

- **The board**, https://github.com/users/davidbyoung/projects/1, is
  shared with the repository the factory was drawn out of. Each
  repository's sync and `factory status` read only its own cards.
- **Builds start from a session.** `builds.trigger` is `manual`, so moving a
  card to Ready starts nothing, and no poller runs for this repository.
  Wherever the rules or a skill say a card moved to Ready starts a build,
  or that the poller starts one, read it here as: the owner tells a session
  to work the ticket, and the session builds it. A finished refinement's
  report says so, not that Ready builds it. Blockers still matter:
  `factory ticket claim` stops on an open one.
- **A release is the owner's.** The owner runs **Release** on the Actions
  tab with patch, minor, or major, and `release.yml` raises the highest
  version tag, publishes once CI passes on `main`'s commit, and tags it
  last (`docs/developing.md`, "Releasing"). No pull request raises
  `version`: `package.json` keeps `0.0.0-development`.

## What merges without the owner: this repository

Nothing. There is no `auto-merge` in `.claude/factory.yaml`, so every pull
request waits for the owner, since every change here reaches every
repository that uses the factory. No merge-policy workflow runs, so no
pull request gets a `merge-automatic` or `merge-manual` label or a
`Who merges` status: where the rules or a skill name either, read it as
"waits for the owner".

## Spec track: this repository

`specs` is `openspec` here. A ticket gets the `spec` label when it changes
what a factory user sees: a command's output or exit, a setting, or which
files the factory writes into their repository and where. The text of
its skills, agents, rules, and review instructions is not spec-tracked,
since prose has no test to map a scenario to: a change to it goes through
the fresh-agent trace in "Changing the process" instead. `openspec/specs/` holds a spec for
each capability a ticket has changed, as `factory specs
list` prints them; behavior with none gets one when a ticket next changes
it. The docs stay the reader's guide, and a spec change updates them in
the same pull request. The factory's spec check,
`factory specs check`, sets `DO_NOT_TRACK=1` for OpenSpec
itself, and so does the `spec:validate` script the gate and CI run.

## Refining: this repository

**Draft the experience first.** Before step 1 of `factory-refine`, run
`/dx-first N`, the `dx-first` skill, on a ticket that adds or changes a
command, a command's output, a setting, a file the factory writes, or a
docs page, and whose body has no `## Proposed docs` yet. Each is what a
factory user meets, as "Spec track: this repository" reads them: the text
of a skill, agent, rule, or workflow is not one, nor is this repository's
own `.claude/factory.yaml`, and a docs page is `README.md` or one under
`docs/` other than `docs/developing.md`. Skip it for a small change
("Small changes" in `.claude/factory/rules.md`), a bug fix that restores
intended behavior, and the follow-ups ticket. When `dx-first` posts its
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
`<!-- dx-first: draft -->`. When `factory-build` folds an approved round
and that round is a draft, run `dx-first` to save the draft with the
approvers' replies folded in, then fold and check the body as
`factory-refine` does. When the owner asks a session to build a ticket
whose draft waits and whose body has no criteria yet, `factory-build`
runs refinement and stops, as it does for any such ticket: that request
is the owner saying to save, so `dx-first` saves the draft and refinement
carries on to its own end. The owner then approves the refined ticket as
usual.

## Issues that wait on another: this repository

**A new ticket gets its blockers checked.** A session the owner steers
that opens issues, by any command, runs the `ticket-order` skill on them
once before finishing, as `/ticket-order N M ...`, so the links in both
directions are proposed in one question while the owner is there to
approve them. The follow-ups issue is not one of them: its lines are
built as one pull request, not ordered. A run in GitHub Actions skips it,
since nobody can answer its question.
Refinement's own check of the build order is unchanged. The owner runs
`/ticket-order` for the order of every open ticket.

## Changing the process: this repository

The source of every factory file is in this repository: `skills/`,
`agents/`, `rules.md`, `review.md`, `workflows/`, and `actions/`. Change
the source, run `node bin/factory.js sync`, and commit both; CI's
`Factory files in step` fails when a copy differs from its source. Never
edit the copy under `.claude/` or `.github/`.
`.claude/agents/docs-reader.md`, this repository's own reviewer, and
`.claude/skills/dx-first/` and `.claude/skills/ticket-order/`, its own
skills, are not copies: they have no source elsewhere and are edited
where they are.

The code that decides what runs and who merges, which the trace also
covers, is everything under `src/` that a workflow, a hook, or a skill's
gate runs: in particular `merge-policy.mts`, `review-verdict.mts`,
`review-tools.mts`, `poller.mts`, `parts.mts`, `sync.mts`, `board.mts`,
`ticket.mts`, which starts the board sync,
the `guard*.mts` files, `lib/work-status.mts`, `commands.mts`,
`lib/default-branch.mts`, `lib/refined-check.mts`, `specs/`, whose
adapters name the files the merge policy holds, and `config.mts`'s
`pluginsOf`.

A change here reaches every repository that uses the factory, through its
next release, so the fresh-agent trace in "Changing the process" in
`.claude/factory/rules.md` reads `.claude/change-types.md` here and asks,
for each kind, both how it goes here and how it would go in a repository
that installs the factory.

## Stepping back from a rabbit hole: this repository

No case here yet. The first one to meet the rule's three rounds is
recorded here, with the custom code, the library that replaced it, and the
size before and after.
