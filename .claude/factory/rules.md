# The factory's rules

The process rules that hold in any repository the factory builds.
`CLAUDE.md` imports this file, and says what is the repository's own under
a heading of the same name with ": this repository" added. Where the two
differ, `CLAUDE.md` wins.

Tickets are read and written only through `factory ticket`,
and a pull request's conversation comments and labels through
`factory pr`, so the rules and skills hold whatever the ticket system.

A label is named here by its key under `tickets.labels` or
`code-host.labels`, such as `spec` or `verdict-override`, and those
commands take the key; `factory ticket view` shows the key beside a label
the repository renamed, as `needs-spec (spec)`.

## Small changes

A change is small when it changes under about 30 lines outside tests,
specs, and content, and adds no component and no state, whether or not a
user sees it: a style tweak, a bug fix, a link, or a line of copy. Its
size decides, not its kind; content the repository reviews by what changed
instead is named in "Small changes: this repository" in `CLAUDE.md`. The
process around a small change has cost far more than the change: on one ticket, under 20 changed lines took a 27
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
  makes a line of a spec `factory specs list` prints
  false, as renaming a label a spec quotes would. That issue also carries
  a Spec section of the changed line, and the build folds it into the
  specs in the same pull request, which then waits for the owner. A fix that restores what a spec says
  changes no line of it.
- **No `factory-ticket-readiness` read and no read by the test reviewers**
  (`factory plugins test-reviewer` lists them), with two
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
  (`factory plugins reviewer`).
- The gate and CI stay. The pull request says it took this path.

## Branching, pushing, and review

The default branch, whose name `factory default-branch`
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
  (`factory pr wait-checks N`, then
  `factory pr ready N`).
  It stays a draft for the owner to mark ready in three cases: a small change
  whose build made a layout or style choice, with the UI reviewer's
  screenshots in the body ("Small changes" above), a pull request the
  owner has said they want to see first, and, in the cloud, one that needs
  an earlier repository's pull request of the same ticket changed. A skill that runs as parallel
  slices, which cannot stay to work a review, leaves its own a draft too.
  CI runs the full suite on a draft for free, so a session runs only the
  end-to-end specs it added or changed.
- **The session that built a PR watches it until it merges or closes.** It
  has the context to fix what comes in. The desktop app's PR monitor does not
  connect in local sessions here, so once the PR is ready, or left a draft
  for the owner to mark ready (above), a local session runs `factory pr watch N` in the background. That exits when a
  check fails, a review or comment lands, or a conflict appears, which wakes
  the session. Work what it reports, then run it again, until it prints
  `merged` or `closed`. A session that stops watching an open PR first runs
  it with `--release`. A session in the cloud watches nothing ("A session in
  the cloud" below). A pull request `factory update`
  opened was built by no session: its review waits for the owner, who
  merges it or tells a session to work it with `factory-address-review`.
  So does the pull request `factory init` opens, which a person's command
  opens ready, not as a draft.
- **A pull request that resolves an issue closes it.** When asked to open
  one, start the body with the line `factory ticket link N`
  prints for each issue the branch resolves, so the merge closes them. Check that `factory pr closes PR`
  prints each one. For a ticket that names several repositories the line
  says `Part of`, and what merges first: it closes by itself when the last
  of their pull requests merges, where each has a board or builds in the
  cloud set up, so `factory pr closes PR` prints nothing
  for it.
- **After pushing, check for review automatically.** Where the automated
  review is on, which is where `factory config get pr-review` prints `on`,
  it reviews every push to a PR that is marked
  ready. If an open PR exists for the branch, wait for the review of that
  push, then work it with the `factory-address-review` skill
  without being asked. If no PR exists yet, say so in one line: review begins
  when the user opens one. Where the review is off, none comes: a push is
  done once its checks pass.
- **A conflict with the default branch is fixed through the `factory-resolve-conflicts` skill.** Its
  sweep runs after each merge into the default branch and nightly, on every ready pull
  request that conflicts, and a session working a pull request with
  `factory-address-review` runs its conflict fix before anything else. When the two
  sides contradict, it pushes nothing, comments why, and opens an issue.
- **An issue is built in GitHub Actions by moving its card to Ready** on
  the board, the GitHub Project whose number
  `factory config get tickets.board` prints: the
  poller starts a build, a run of the "Factory" workflow, within about a minute
  when you host it (`builds.trigger: own-server`) or at its next scheduled
  pass (`github-action`), the same run that
  `factory build N` starts by hand. A local build starts by telling a session to work the
  issue. Where `factory config get builds.trigger` prints
  `manual`, no poller runs and a card moved to Ready starts nothing: a
  build starts only when the owner tells a session to work the issue or
  runs `factory build N`, so wherever these rules or a skill say Ready
  starts a build, read it as that.
  The poller starts only a ticket with the factory label, which refinement
  and `factory ticket ready` add. It skips a card whose blocker is open
  and starts it at its first pass after the blocker closes. A card moves only forward on its own: a
  build that ends without a merge stays In progress, and a finished
  refinement stays In refinement, both "Waiting on you", and nothing
  retries on its own. The board sync alone writes Status,
  Session, and Runs in, with one exception: a local session moves the
  card to Ready with `factory ticket ready N` when the
  owner asks it to. `factory status` shows the
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

## A session in the cloud

A run that starts a session in the cloud is three jobs: one hands over what
the session works from, the session has no sign-in of any kind, and a third,
with no AI, checks what it left and does it. The skills are the same there
as on a person's machine, with these differences, and no skill restates
them.

- **The folder it starts in is the default branch,** with the rules, skills,
  and settings it follows, and it cannot change it. The branch it works on is
  in `../work`, already checked out. Every command runs there, after
  `cd ../work`, and every change is made there. A file under `.claude/` is
  written by a command, since the file tools refuse it.
- **A ticket across repositories is built one repository at a time,** each
  in a run of its own. `factory workspace N` prints the others, which are
  in `../others` to read, and nothing there can be changed.
- **It is claimed and branched already.** A skill's steps that claim a
  ticket, name a branch, look for an earlier one, or check one out are done.
- **A `factory` command that reads** answers from what was handed over. One
  that says something `was not handed to this run` is not retried: go on
  without it, or stop as it says.
- **A `factory` command that writes** prints `Asked:`. It is done after the
  session ends, if it is one this run may make, so nothing waits for its
  result. A number that is not known yet, such as the pull request's after
  `factory pr open`, is left out. The pull request is marked ready once CI
  has passed. One its owner marks ready is opened with
  `factory pr open --draft` in place of skipping that step.
- **Commits are handed over with `factory pr push`,** once, at the end.
  Nothing is pushed, fetched, or pulled with git, and nothing is signed. A
  commit that changes a file under `.github/workflows/`, other than a merge
  that brings in the default branch's own change, is refused, with the
  rest of the session's work. A setting whose `factory sync` rewrites one
  needs such a commit too. When a ticket needs one, stop and say it is built
  on a person's machine.
- **Where a skill waits** for checks or a review, the session ends with its
  report. What comes next starts a run of its own, which remembers nothing
  but the ticket, the pull request, and its threads.
- **No hook runs,** `commands.before-commit` included. The gate is what
  checks a commit.
- **A picture can't be attached.** The pull request says so in place of a
  screenshot, and one whose look the owner picks is opened with `--draft`.
- **What comes before "marked ready" comes before `factory pr open`,** the
  fresh-agent trace included, since nobody marks it ready by hand. A
  follow-up alone comes right after it, since it is listed there.
- **The report** is asked for with `factory ticket comment N`, or on an
  answer with `factory pr comment N`, and is the final message too.

## What merges without the owner

A pull request merges itself only when the merge policy labels it
`merge-automatic` and every gate passes on its newest commit,
`Review verdict` included. The agents' own rules always wait for the
owner. Its `Who merges` status in the checks list says which, and why.
Where `.claude/factory.yaml` lists no file under `auto-merge.allow`, the
merge policy does not run: no pull request gets either label or a `Who merges`
status, and every one waits for the owner, so wherever these rules or a
skill name them, read it as "waits for the owner".

Agents never merge, enable auto-merge, or add the `verdict-override`
label, an approver's pass of the verdict for one commit, which does not
pass what it waits for in another repository; `factory pr label`
and `factory ticket label` refuse it, and the guard hook stops the ordinary
ways of adding it around them. The merge policy and the verdict run from
the default branch's copy, so a pull request cannot change how it is judged,
and changes to them are always the owner's.

## Spec track

The ticket is the spec: `factory-refine` writes it, the owner
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
through the owner's GitHub account, or through the organization's app in
an organization's cloud build, and either way a label already decided is
the owner's call.

A spec tool, which `factory config get specs` names,
also keeps each Spec in the repository: `factory-build` starts it with
`factory specs new N` and folds it in with
`factory specs finish N`, in the same pull request.
`factory specs list` prints the specs the repository
keeps, its current description of what it does; a change to one starts
by reading it. With `specs: none` each of these says each ticket holds
its own spec, and the issue is the only copy. No skill, agent, rule, or
workflow runs a spec tool's own commands: the `factory specs` commands
reach it.

## Issues that wait on another

A build order stated only in prose is one nothing reads: a build starts
whenever the owner approves it, within minutes of a card moving to Ready
where a poller runs, and the poller and `factory-build` stop only on a
recorded relationship. So whoever opens or refines an issue records each
blocker as a blocked-by relationship, and says why in the issue's
body (under Decisions, for a refined issue).

An issue is blocked by another when building it first would break it, or
would mean redoing work. Touching the same file does not count: that is a
merge conflict, and the `factory-resolve-conflicts` conflict sweep resolves those.

To record that issue N is blocked by issue M, list what N waits on, and
remove one, in any session:

```bash
factory ticket block N --by M
factory ticket blockers N
factory ticket unblock N --by M
```

`blockers` prints one line per ticket N waits on, as the ticket system
writes it, and whether it is open. A ticket system without blockers says so: check with
`factory ticket supports blockers`.

## Follow-ups

A session building one ticket, or answering a review of it, often notices something else: a reviewer
finding it left for the owner, a defect out of scope, or a check to run
later. What it does depends on what it noticed:

- **Small, and part of what it is building:** it fixes it in the same pull
  request, and the body says so. What would add or alter behavior a user
  can see that the ticket does not ask for is not this: it is the next.
- **Something else that a user or a maintainer would run into:** it lists
  it in its pull request, as a follow-up.
- **Anything else,** such as what breaks no rule in the guides, what nobody
  would notice without measuring, or a Low review finding it left undone:
  it leaves it alone, and does not list it.

It opens no ticket for any of them. The owner decides about each follow-up
on the pull request: one whose box is ticked when the pull request merges
becomes a ticket, one a review says to fix is fixed there, and any other is
dropped. A session never ticks a box.

```bash
factory follow-up "TITLE" "WHAT IS WRONG"
```

It adds the follow-up to the open pull request of the branch, so it runs
once that is open. TITLE says what is wrong in a few words, and WHAT IS
WRONG as a user or a maintainer sees it, with the file or page it is in. The
ticket it may become has nothing else to go by, so together they stand
without the pull request. A pull request lists three at most: with more
than three, list the three that matter most. Neither may link a ticket.

- A finding in a review thread is answered there, as
  `factory-address-review` says, and is not listed too.
- A build that ends with no pull request lists nothing. A run in the cloud
  that resolves a conflict or works a dependency lists nothing either.
- A session with no pull request, such as a refinement, says what it noticed
  in its report, and opens a ticket only when the owner asks for one.
- A request from the owner is a ticket of its own.
- The `factory-resolve-conflicts` conflict stop keeps opening its own
  ticket: which side wins is the owner's decision, and nothing else records
  it.

A placeholder or tag name in issue or comment text, such as `<slug>` or
`<code>`, goes in backticks: GitHub drops an unknown tag and renders a
real one. `factory ticket edit`, `comment`, and `open`,
`factory pr comment`, and `factory follow-up` refuse a body that has one
bare, and name it. A hook refuses the same in text sent to GitHub directly,
as the `factory guard ticket-text` command describes.

## Changing the process

The factory's skills, agents, rules, and review instructions under
`.claude/` and `.github/` are copies, and its two workflow files are
written from the settings, all by `factory sync` from the factory's
package. Change the source in the package, run `factory sync`, and commit
both: the gate and CI fail when a file differs from what `sync` writes
from its source and the settings.

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
