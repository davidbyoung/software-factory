# Limitations

What the factory does not do, what it assumes that nobody has tested, and
the risks that come with it. Read this before relying on it.

The limits that come from today's tools rather than from the factory, such
as a code host's billing or what its workflows can see, are in
[the GitHub and Claude Code reference](github/reference.md#limits).

## What it does not do

- **One tool of each kind.** The factory reaches the code host, the ticket
  system, the board, and the cloud runner each through one interface, and
  the settings name which one you use
  ([`code-host.type`](configuration.md#code-host),
  [`tickets.type`](configuration.md#tickets), and
  [`builds.runner`](configuration.md#builds)). Each has one implementation
  today, GitHub's, and no other is planned. A ticket system or code host
  named by a package, for an adapter you write yourself, is not planned
  either; the design leaves room. The skills are written for one coding
  agent, Claude Code. [The glossary](glossary.md) says which tool each
  word means today.
- **It needs Node and a `package.json`,** even in a repository written in
  another language.
- **A build never changes the coding agent's settings files,** which hold
  the hooks that guard the run. It may write the factory's other files
  there. A change to those settings is a person's to make.
- **One ticket, one repository.** A change that spans repositories is two
  tickets.
- **It is written for one approver.** `approvers` lets a team list several
  people (_[Planned](developing.md#what-is-built)_), but review by teams, required reviewers per folder, and monorepos
  with several owners are not designed.
- **The order of the workflow is fixed.** A [plugin](plugins.md) of
  yours can replace how a ticket is refined, how a ticket with one of your
  labels is built, how a test is proved able to fail, which agents review
  the tests, and how a generated file is rebuilt after a conflict, and you
  can add reviewers and turn written specs off. The six states and their
  order still cannot change: you cannot add a state, leave one out, or
  reorder them ([why](design.md#the-order-of-the-workflow-is-fixed)).
- **A build needs a gate you wrote.** With nothing under
  [`commands.gate`](configuration.md#commandsgate), `factory gate` fails
  and a build stops there. The factory cannot guess how your repository is
  checked.
- **A renamed default branch is read under its old name** until
  `git remote set-head origin --auto` runs in the checkout, which keeps
  the name in `origin/HEAD`. The factory reads the name there before it
  asks the code host, so a stale one gives a stale answer: the commit hook
  then guards the old branch and not the new one. After the rename, run
  that command in each checkout, then `factory sync`, which writes the
  name into two workflows.
- **A private [preset](presets.md) works on your machine, not yet in the
  factory's workflows.** _[Planned](developing.md#what-is-built)_: the
  workflows can't install a private package yet.
- **One lock file is rebuilt for you after a conflict,** the one
  [`commands.relock`](configuration.md#commandsrelock) rebuilds, npm's by
  default. A second, such as another package manager's beside the
  factory's own, needs a [resolver](plugins.md#resolver) of yours.
- **On a board with no refining column, a ticket cannot be sent back to the
  backlog by moving its card.** The card already shows in the backlog column
  while a ticket is being refined, so the move says nothing.
- **The UI reviewer needs Playwright.** The repository installs it, and its
  browser.
- **It cannot see a page behind a sign-in.** It compares one site at one
  address.
- **What the measurements do not cover.** Elements that overlap or are cut
  off, and how far a page moves while it loads, are for the pictures and the
  agent. The contrast of a control's edge is not measured, since axe-core has
  no rule for it. Frames inside a page are left out, and so is a view whose
  pictures did not change. axe-core's target size is WCAG 2.5.8's 24 px, not a
  larger floor of your own.
- **A state that takes a click to reach is the agent's to drive,** not the
  command's.
- **No budgets.** What each ticket cost is recorded. Nothing caps it.
- **Nothing retries on its own.** A build that stops waits for you.
- **A cloud build's commits are unsigned unless you give it a signing
  key.** `factory init` makes one when you choose that part
  ([Setting up on GitHub](github/setup.md#run-factory-init)).
- **A cloud build cannot be steered.** You can read its log as it runs, and
  cancel it, but not answer it: where it would ask, it stops and reports.
- **Nothing watches a pull request after its cloud build ends.** Your own
  review comments are answered by a session you open, or by a cloud session
  started for your review, which has only the pull request and the ticket
  to go on.
- **A cloud build runs for up to 230 minutes by default**
  ([`session-minutes`](configuration.md#session-minutes)), and its minutes
  may cost money, depending on your cloud runner and plan.

## What nobody has tested

- **A board owned by an organization.** It is read the same way as a
  person's, but the factory has only run against a person's.
- **Your board's own automations,** such as moving a closed ticket to Done.
  They may fight the board sync.
- **A factory update reaching a repository through its dependency bot.**
- **Glob patterns standing in for today's regular expressions** in the
  merge policy. They could match differently. The switch compares the old and new
  decision on recent pull requests.
- **A scheduled job as the poller,** including what it costs.
- **A default branch not called `main`.** The name is read, never assumed,
  and the tests run with a branch called `develop`, but no repository with
  one has run the factory.
- **A refiner, a prover, or a resolver of your own.** The settings accept
  each and the skills call them, but no repository has run one.
- **Windows.** The tool and its hooks need only Node, but nothing here has
  been run on Windows.
- **Adding the factory's columns to a board you already have.**
- **Whether your coding agent's plan permits automated builds this way.**
  The automated review runs on a subscription token in the one repository
  that uses it. Check your plan's terms.

## What was tested, and found not to work

- **Node will not run TypeScript from inside `node_modules`.** A published
  package has to ship compiled JavaScript.

## Risks that do not go away

- **"Universal" is a guess until a second repository uses it.** Everything
  here was drawn out of one repository.
- **A session acts as you.** That is the design: your agent writes the
  commits, and they go out under your account. It also means the guard
  against a session approving its own work is a tripwire, not a lock. Your
  read of the pull request is the control.
- **The skills are prose, and prose is hard to test.** A change of wording
  changes behavior in every repository that updates. The checks are a traced
  read by a fresh agent, one real ticket, and your read of the update.
- **Rules that need judgment cannot be enforced.** CI can require that a
  reviewer ran or was skipped with a reason. It cannot check the reason was
  a good one.
- **It amplifies the checks it is given.** A repository with weak tests gets
  confident, wrong pull requests faster.
- **Ticket text, review comments, and changelogs are read by sessions.**
  Only an approver's comments are treated as instructions, and that rests on
  one account's login.
- **An update delivers instructions that run with your tokens.** Read update
  pull requests as carefully as code.
- **It sits on tools that change.** Several parts work around how today's
  coding agent and code host behave.
- **Publishing cannot be undone.** A public release needs a history and
  examples free of the host repository's private tickets first.
