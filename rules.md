# The factory's rules

The process rules that hold in any repository the factory builds.
`CLAUDE.md` imports this file, and says what is the repository's own under
a heading of the same name with ": this repository" added. Where the two
differ, `CLAUDE.md` wins.

Tickets are read and written only through `npx --no-install factory ticket`,
and a pull request's conversation comments and labels through
`factory pr`, so the rules and skills hold whatever the ticket system.

## Small changes

A change is small when it changes under about 30 lines outside tests,
specs, and content, and adds no component and no state, whether or not a
user sees it: a style tweak, a bug fix, a link, or a line of copy. Its
size decides, not its kind; content the repository reviews by what changed
instead is named in "Small changes: this repository" in `CLAUDE.md`. A
follow-ups build is sized by its lines: when every line is small, its one
review is a small one. The process around a small change has cost far
more than the change: on one ticket, under 20 changed lines took a 27
minute read by the UI reviewer and an 8 minute `factory-ticket-readiness`
read, and on another one link took an OpenSpec change, eight mutations, and
two reviewers.

This section is the one statement of the small path; other guides point
here rather than restate it.

- **Say the size first.** The first message of the work names the path,
  such as "small: one test, red first, one UI reviewer read", so the
  owner can overrule it before the work starts rather than halfway through.
- **No `spec` label**, even when a user sees it: the issue's acceptance
  criteria are the spec. No spec tool change either, unless the change
  makes a line of a spec `npx --no-install factory specs list` prints
  false, as renaming a label a spec quotes would. That issue also carries
  a Spec section of the changed line, and the build folds it into the
  specs in the same pull request, which then waits for the owner. A fix that restores what a spec says
  changes no line of it.
- **No `factory-ticket-readiness` read and no read by the test reviewers**
  (`npx --no-install factory plugins test-reviewer` lists them), with two
  exceptions that keep every test reviewer it prints whose `files`, if it
  has any, the change touches: a change to
  tests alone, the one kind they exist for, and code that builds what is
  sent to an outside service, which "Small changes: this repository" in
  `CLAUDE.md` names, since a broken payload loses data without a sound.
- **Tests.** A bug fix gets one test that reproduces the defect. A style
  tweak gets one only when it sets what a check in the repository's design
  guide measures, which "Small changes: this repository" in `CLAUDE.md`
  names, preferably as one assertion added to an existing test; any other
  look change gets no new test, and the review's screenshots are its
  check. Any other small change, such as a link or a script's behavior,
  gets one test that checks it.
- **One proof per test** that it can fail: its red run before the change,
  or for a test written after, one mutation, the edit that undoes the
  change, not one per way the code could break. A script proves each
  behavior this way: script defects here have been silent data loss.
- **Choices.** One that is not layout, such as which page, what label, or
  what it links to, is asked in plain English, saying what a user would
  see. A layout or style choice gets no mockup round: build the
  recommendation, put the UI reviewer's screenshots of it in the pull
  request body, and leave the pull request a draft for the owner to mark
  ready once they have seen it, since a page change can otherwise merge
  itself.
- For a visible change, a UI reviewer read pointed at the states the change
  touched, not every size and scheme, and told the change is small. The UI
  reviewer is `factory-ui-reviewer` where the repository lists it, and
  otherwise the repository's own, among its reviewer plugins
  (`npx --no-install factory plugins reviewer`).
- The gate and CI stay. The pull request says it took this path.

## Branching, pushing, and review

The default branch, whose name `npx --no-install factory default-branch`
prints, is protected: no direct pushes, no bypass, CI must pass, and every
review thread must be resolved before a merge. Work accordingly rather than
discovering it at push time.

- **Never commit on the default branch.** If it is checked out, create a
  branch from the latest copy of it on `origin` first and say which branch
  you made. Reuse the
  current feature branch when one is already checked out; a feature usually
  spans several commits.
- **Push the branch after each coherent change.** Small commits are the point;
  do not batch a session's work into one.
- **Open pull requests as drafts, and mark them ready once.** A draft gets
  no automated review, so it costs nothing while work continues. Every push
  to a PR that is marked ready triggers a billed review, so the session that
  built it, wherever it ran, marks it ready once: when the gate passes,
  everything is pushed, GitHub shows the pushed commit as the head, and
  every CI run on it has passed or been skipped
  (`npx --no-install factory pr wait-checks N`, then
  `npx --no-install factory pr ready N`).
  It stays a draft for the owner to mark ready in two cases: a small change
  whose build made a layout or style choice, with the UI reviewer's
  screenshots in the body ("Small changes" above), and a pull request the
  owner has said they want to see first. A skill that runs as parallel
  slices, which cannot stay to work a review, leaves its own a draft too.
  CI runs the full suite on a draft for free, so a session runs only the
  end-to-end specs it added or changed.
- **The session that built a PR watches it until it merges or closes.** It
  has the context to fix what comes in. The desktop app's PR monitor does not
  connect in local sessions here, so once the PR is ready, or left a draft
  for the owner to mark ready (above), a local session runs `npx --no-install factory pr watch N` in the background. That exits when a
  check fails, a review or comment lands, or a conflict appears, which wakes
  the session. Work what it reports, then run it again, until it prints
  `merged` or `closed`. A session that stops watching an open PR first runs
  it with `--release`. A run in GitHub Actions, which nothing can wake
  later, works its review under `factory-address-review`, waiting with
  `npx --no-install factory pr state N --wait`, and does not run it, since
  nothing can wake it once it stops.
- **A pull request that resolves an issue closes it.** When asked to open
  one, start the body with `Closes #N` for each issue the branch resolves,
  so the merge closes them. Check that GitHub registered the link.
- **After pushing, check for review automatically.** The `Claude review`
  workflow reviews every push to a PR. If an open PR exists for the branch,
  wait for the review of that push, then work it with the `factory-address-review` skill
  without being asked. If no PR exists yet, say so in one line: review begins
  when the user opens one.
- **A conflict with the default branch is fixed through the `factory-resolve-conflicts` skill.** Its
  sweep runs after each merge into the default branch and nightly, on every ready pull
  request that conflicts, and a session working a pull request with
  `factory-address-review` runs its conflict fix before anything else. When the two
  sides contradict, it pushes nothing, comments why, and opens an issue.
- **An issue is built in GitHub Actions by moving its card to Ready** on
  the board, the GitHub Project whose number
  `npx --no-install factory config get tickets.board` prints: the
  poller dispatches the "Factory build" workflow, within about a minute
  when you host it (`builds.trigger: own-server`) or at its next scheduled
  pass (`github-action`), the same run that
  `npx --no-install factory build N` starts by hand. A local build starts by telling a session to work the
  issue.
  The poller skips a card whose blocker is open and starts it at its first
  pass after the blocker closes. A card moves only forward on its own,
  except the follow-ups issue when a pull request merged part of it,
  which goes to Backlog: a
  build that ends without a merge stays In progress, and a finished
  refinement stays In refinement, both "Waiting on you", and nothing
  retries on its own. The board-sync workflow alone writes Status,
  Session, and Runs in, with one exception: a local session moves the
  card to Ready with `npx --no-install factory ticket ready N` when the
  owner asks it to. `npx --no-install factory status` shows the
  same in the terminal.
- **No thread stays unresolved.** The ruleset blocks a merge while any review
  thread is open. Each one ends fixed, or rejected with evidence, and
  resolved. After two rounds, whatever is still in dispute goes to the user
  rather than through another round.
- Report the branch, what was pushed, and the state of any threads. Never
  claim a review is clean when none has run yet.
- **Say where unfinished work lives.** When a turn ends with uncommitted
  changes, or commits on a branch with no open PR, the last line names the
  branch and says which. Work has been lost by sitting on a branch the user
  thought was already in a PR.

## What merges without the owner

A pull request merges itself only when the merge-policy workflow labels it
`merge: automatic` and every gate passes on its newest commit,
`Review verdict` included. The agents' own rules always wait for the
owner. Its `Who merges` status in the checks list says which, and why.

Agents never merge, enable auto-merge, or add the `verdict: override`
label, the owner's pass of the verdict for one commit; `factory pr label`
and `factory ticket label` refuse it, and the guard hook stops the ordinary
ways of adding it around them. Both workflows run from the default branch's copy,
so a pull request cannot change how it is judged, and changes to them are
always the owner's.

## Spec track

The GitHub issue is the spec: `factory-refine` writes it, the owner
approves it by moving its card to Ready or telling a session to build
it, and `factory-build` builds it. A change that adds or alters behavior
a user can see carries the `spec` label, which `factory-refine` adds,
unless it is small ("Small changes" above), whatever spec tool the
repository uses. Its issue holds "Decisions", numbered "Spec" lines, and
"For the builder" with a design and tasks, so a build needs nothing
else.

Everything else, such as copy, bug fixes that restore intended behavior,
style tweaks, tooling, CI, and docs, builds from the issue's "Acceptance
criteria" with no spec files and no "For the builder" section, since the
area's `CLAUDE.md` says how it is built. A small change that makes a
spec line false is the one exception ("Small changes" above). Neither
skill removes `spec` or adds it back once the owner removed it: both act
through the owner's GitHub account, so a label already decided is the
owner's call.

A spec tool, which `npx --no-install factory config get specs` names,
also keeps each Spec in the repository: `factory-build` starts it with
`npx --no-install factory specs new N` and folds it in with
`npx --no-install factory specs finish N`, in the same pull request.
`npx --no-install factory specs list` prints the specs the repository
keeps, its current description of what it does; a change to one starts
by reading it. With `specs: none` each of these says each ticket holds
its own spec, and the issue is the only copy. No skill, agent, rule, or
workflow runs a spec tool's own commands: the `factory specs` commands
reach it.

## Issues that wait on another

A build order stated only in prose is one nothing reads: the poller starts
a build within minutes of a card moving to Ready, and it and `factory-build`
stop only on a recorded relationship. So whoever opens or refines an issue records each
blocker as a blocked-by relationship, and says why in the issue's
body (under Decisions, for a refined issue).

An issue is blocked by another when building it first would break it, or
would mean redoing work. Touching the same file does not count: that is a
merge conflict, and the `factory-resolve-conflicts` conflict sweep resolves those.

To record that issue N is blocked by issue M, list what N waits on, and
remove one, in any session:

```bash
npx --no-install factory ticket block N --by M
npx --no-install factory ticket blockers N
npx --no-install factory ticket unblock N --by M
```

`blockers` prints one line per ticket N waits on, its number and whether
it is open. A ticket system without blockers says so: check with
`npx --no-install factory ticket supports blockers`.

## Follow-ups

A follow-up is something noticed while doing other work: a reviewer finding
the builder left for the owner, a defect spotted out of scope, a symptom
from a review session, or a check to run later. One issue per follow-up once
sent twenty of them through the full refine, label, build, and merge path
in one day, while one follow-ups build made eight of them one pull request.

So a follow-up is a line on the open follow-ups issue, not an issue of its
own. There is at most one open follow-ups issue, titled "Follow-ups" and
labeled `follow-up`, holding a checklist. A line leads with the file or
page it is about:

```
- [ ] <file or page>: <what is wrong, as a user or a maintainer sees it>. Found by <who> while building #N. <The rule it breaks, by its section in the guide that states it (an area's guide under "Rules by area" in CLAUDE.md, CLAUDE.md, or this file), or "Needs a decision: <the question>".>
```

It is added with the file and the rest of the line as two arguments, and
the script opens the issue when none is open:

```bash
npx --no-install factory follow-up FILE "What is wrong. Found by WHO while building #N. The rule it breaks."
```

A reviewer that does not know the issue or pull request number writes
`#N` as it stands, and whoever appends the line fills it in.

A placeholder or tag name in issue or comment text, such as `<slug>` or
`<code>`, goes in backticks: GitHub drops an unknown tag and renders a
real one. `factory ticket edit`, `comment`, and `open`, and
`factory pr comment`, refuse a body that has one bare, and name it. A
hook refuses the same in text sent to GitHub directly, as the
`factory guard ticket-text` command describes.

- A line whose fix the guides determine, such as a target under its floor,
  a contrast failure, a test that cannot fail, or a stale sentence, needs
  no refinement: it is buildable as written.
- A line whose fix the guides do not determine says "Needs a decision:"
  with the question, and `factory-refine` asks only about those lines. A
  builder that meets such a line without the phrase adds it and leaves
  the line unchecked.
- A follow-up gets its own issue only when it would need the `spec` label,
  because it adds or alters behavior a user can see, or would make a
  line of a spec `factory specs list` prints false. A request from the
  owner is always its own issue.
- The `factory-resolve-conflicts` conflict stop keeps opening its own issue: which side
  wins is the owner's decision, and nothing else records it.

The follow-ups issue builds as one branch and one pull request, one commit
per line, once the owner approves it, by moving its card to Ready or
telling a session to build it. The pull request closes it with `Closes #N`
only when every line is checked; otherwise it starts with `Part of #N`,
and the unchecked lines wait there. The sync reads `Part of #N` as a
partial build, so any other link to the follow-ups issue words it
differently. It has no spec tool change. `factory-build` appends a line and
builds the issue; `factory-refine` refines it per line. Its lines can be
about anything, so the one pull request waits for the owner when any line
touches a file that does, and gets the fresh-agent trace ("Changing the
process") when any line edits a rule.

**Not everything noticed is a follow-up.** What breaks no rule in the
guides, and what a user or a maintainer would not notice without
measuring, gets no line and no fix. Once, every line left on a follow-ups
issue came from reviewing the previous batch's fixes, including a 1 px
jump, and each line's fix was reviewed in turn, so the list kept refilling
itself. A Low review
finding the builder left undone is not a follow-up either.

## Changing the process

The factory's skills, agents, rules, review instructions, and workflows
under `.claude/` and `.github/` are copies, written by `factory sync` from
the factory's package. Change the source in the package, run
`npx --no-install factory sync`, and commit both: the gate and CI fail
when a copy differs from what `sync` writes from its source and the
settings.

A rule written for the change in front of its author can be wrong for
every other kind. Once, the step that adds the `spec` label kept adding
it to small changes after the table that defines the label stopped, and
"content is never small" would have sent a typo fix through two reviewer
agents. So a change to `CLAUDE.md`, this file, a skill, an agent,
`.github/factory-review.md`, `.github/review-notes.md`, a workflow,
`openspec/config.yaml`, the settings in `.claude/factory.yaml`, or the
code that decides what runs and who merges (the factory's own commands,
and the scripts "Changing the process: this
repository" in `CLAUDE.md` names)
that alters what triggers a step, who runs or when,
is traced with the `factory-trace` skill before its pull request is
marked ready: a fresh agent walks each kind in `.claude/change-types.md`
through the rules as they will stand, and reports a kind that got heavier,
lighter, or ambiguous, and any two rules that now disagree. Fix what holds
up. A change to wording alone needs no trace.

## Stepping back from a rabbit hole

When one function or file has taken three or more rounds of corrective
work for the same class of defect, stop fixing it. Write down what the
custom code does that matters, which maintained library covers it, and
what that library would not cover, and whether that gap is still the
reason for the custom code, before touching it again. Re-read a "we had
to build this" comment before trusting it.
