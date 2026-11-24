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
- **It needs Node on each machine,** 22.18 or later, even for a
  repository written in another language. Nothing of Node's goes in the
  repository
  ([A repository that is not JavaScript](existing-repo.md#a-repository-that-is-not-javascript)).
- **A session your coding agent's vendor hosts is a machine too.** One
  such as Claude Code on the web, which is not the factory's session in the
  cloud, starts without the factory, and the
  factory's hooks stop its commands until it is there. Put the install
  line in the setup of the environment the session runs in:
  `npm install -g @davidbyoung/software-factory`. The hooks then run,
  and the commands that read only the repository work. On GitHub,
  [the reference](github/reference.md#limits) says what still does not
  work there.
- **A preset names no versions of the factory.** A preset has no version
  of its own, and says nowhere which factory it was written for. One
  that uses a setting your version does not know stops
  `factory preset add`, and fails the check on its update's pull
  request, with that setting's name
  ([Writing a preset](presets.md#making-the-repository)).
- **An organization is set up on github.com only.** GitHub Enterprise
  Server is not supported: its servers cannot call the factory's
  workflows on github.com. `factory init --org` refuses any other
  address.
- **Your own account gets no app.** `factory init --org` is for an
  organization. On your own account, builds act with one access
  token of yours, since a board a person owns refuses an app's token
  ([Where your tokens are kept](credentials.md#on-github)).
- **An organization's poller runs only on a schedule,** in its
  `factory-config` repository. Nobody can host one for a whole
  organization. A repository in an organization that is set up keeps its
  tickets from that poller by setting `builds.trigger: manual` in its
  own settings.
- **No command replaces the key of an organization's app, or takes an
  organization's setup out.** GitHub makes a new key only on the app's
  own page: [Replacing the App's key](credentials.md#replacing-the-apps-key)
  has the steps, and
  [Taking an organization's setup out](removing.md#taking-an-organizations-setup-out)
  lists what an owner deletes.
- **`factory doctor` does not check the two tokens `factory init` keeps
  on your machine** on your own account, the code host's access token
  and the coding agent's
  ([The file on your machine](credentials.md#the-file-on-your-machine)).
  Init checks them itself, the next time it would store them.
- **A session in the cloud can't install from GitHub Packages itself.** Your
  default branch's packages are installed before it starts, and after that it
  has no GitHub token and its commands can't reach GitHub
  ([GitHub Packages](github/setup.md#github-packages)).
- **Dependabot's pull requests do not merge themselves under an
  organization's app, as set up.** The job that turns auto-merge on for
  one reads Dependabot's secrets, not the Actions ones, and
  `factory init --org` stores the app's key for Actions alone. An owner
  who wants it makes a new key, as
  [Replacing the App's key](credentials.md#replacing-the-apps-key)
  shows, and stores it a second time for Dependabot, with
  `--app dependabot` added to that page's `gh secret set` line.
- **No hook runs in a session in the cloud.** The hooks that guard a session
  on your machine, and
  [`commands.before-commit`](configuration.md#commandsbefore-commit), are
  off there. A build may change the coding agent's settings in its pull
  request, hooks included. Nothing in the cloud follows the change until it
  merges, and no [`auto-merge`](configuration.md#auto-merge) rule allows it,
  so a person reads it first.
- **One ticket, one repository.** A change that spans repositories is two
  tickets.
- **Review by teams is your code host's to enforce.** A session obeys
  anyone who can write to the repository. Required reviewers for a
  folder, and a number of approvals before a merge, are rules you set on
  the code host, and the factory's pull requests are held by them like
  any other.
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
  the name in `origin/HEAD`. Where the remote whose address is your
  `repository` line's has another name, such as `upstream`, write that
  name in place of `origin`. The factory reads the name there before it
  asks the code host, so a stale one gives a stale answer: the commit hook
  then guards the old branch and not the new one. After the rename, run
  that command in each checkout, then `factory sync`, which writes the
  name into `.github/workflows/factory.yml`.
- **One lock file is rebuilt for you after a conflict,** the one
  [`commands.relock`](configuration.md#commandsrelock) rebuilds, npm's by
  default. A second, such as another package manager's beside npm's,
  needs a [resolver](plugins.md#resolver) of yours.
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
- **A cloud session's commits are never signed,** on your own account or
  in an organization. No job that runs a session holds a signing key. The
  pull requests that update the factory can be signed, on your own account
  ([Setting up on GitHub](github/setup.md#run-factory-init)). Verified
  commits under an app are _[Planned](developing.md#what-is-built)_, as
  ticket 77. A repository whose rules require signed commits on every
  branch cannot use cloud builds.
- **Under an organization's app, `{user}` in a branch name is the app's
  name,** such as `software-factory-for-acme`, not a person's: an app's
  token names no user
  ([`code-host`](configuration.md#code-host)).
- **A cloud build cannot be steered.** You can read its log as it runs, and
  cancel it, but not answer it: where it would ask, it stops and reports.
- **Nothing watches a pull request after its cloud build ends.** What comes
  next starts runs of their own
  ([What a cloud run is](builds.md#what-a-cloud-run-is)), and each has only
  the ticket, the pull request, and its threads to go on. No conversation
  is carried from one run to the next.
- **A cloud build's pull request gets two rounds of review and four
  answers,** then waits for a person.
  [`rules.review-rounds`](configuration.md#rules) changes the first. The
  four is fixed.
- **A round of review in the cloud is slow.** Each answer is a new run on
  new machines, which installs everything again.
- **A cloud build runs for up to 230 minutes by default**
  ([`session-minutes`](configuration.md#session-minutes)), and its minutes
  may cost money, depending on your cloud runner and plan. Its last job
  waits for CI for an hour at most, and the wait is billed.
- **A ticket that changes a file under `.github/workflows/` is built on
  your machine.** A build in the cloud that could push one could read your
  repository's secrets
  ([A change to a workflow file](builds.md#a-change-to-a-workflow-file)).
- **No Docker in a cloud session, and a browser needs `--no-sandbox`**
  ([What a session can use](builds.md#what-a-session-can-use)).
- **A cloud session reaches only the npm registry and the hosts under
  [`builds.hosts`](configuration.md#builds).** It has no web search, and
  it can't reach your code host at all. So a package your code host
  serves, as GitHub does most of Composer's, can't be installed in a
  session ([`commands.build-setup`](configuration.md#commandsbuild-setup)
  says what to do instead).
- **A cloud session reads only what the job before it handed over:** its own ticket and
  pull request, their threads and check results, up to 20 tickets its
  ticket names, and, for a Conflict, the pull requests merged since its
  branch left the default branch, up to 30.
- **A cloud session hands over at most 20 MB of commits,** and it can't
  attach a picture to a ticket or a pull request, or add a label.
- **A cloud build's pull request is marked ready once CI passes,** whatever
  it changed. A change whose look you want to see first is better built on
  your machine.
- **A pull request from a fork starts no run in the cloud,** and its review
  verdict waits for a person. So does one that goes into a branch other
  than your default branch, once it is marked ready.
- **One of Dependabot's pull requests gets the verdict's pass only while
  every commit on it is Dependabot's own.** Once a session or a person
  pushes to it, its verdict waits, since the automated review does not run
  on Dependabot's pull requests. Override it, with
  [`verdict-override`](configuration.md#code-hostlabels), after reading it.
- **A secret your own CI gives a branch is not protected from code in a
  pull request.** A build's commits run in your CI as anyone's do. The
  same is true of the repository's own secrets that a session's commands
  read, such as the one your `.npmrc` names: make each read-only.
- **A team's cloud builds share one credential for the coding agent,** an
  owner's choice: a subscription by default, or an API key, which the
  agent's own documentation advises for a secret that several repositories
  share.
- **In a public repository, what a run hands over can be downloaded.**
  Anyone signed in to the code host can download a run's artifacts: for a
  day, what the session read, which holds the ticket and any
  [preset](presets.md) the repository follows, and for seven days, what it
  left. Keep builds in the cloud off in a public repository whose tickets
  are kept somewhere private, or that follows a private preset: leave
  "Builds in the cloud" unchecked in `factory init`. Nothing checks this
  for you.

## What nobody has tested

- **A board owned by an organization.** It is read the same way as a
  person's, and `factory init --org` has given one its columns, but the
  board sync and the poller have only run against a person's.
- **The factory's own skills in a cloud run, end to end.** A real Claude
  session has built, reviewed, and answered tiny tickets as the three jobs
  in a scratch repository, with a short prompt of its own in place of the
  skills.
- **A Conflict run and a Dependency run,** with a real session.
- **A cloud run of hours,** such as one that waits out a token.
- **A determined attacker.** Known ways to steal the agent's credential and
  the job's own token were tried against the sandbox and failed, and a pull
  request written to talk the review into "ready" failed too. Nobody has been
  asked to break it. Claude Code's documentation says of its sandbox:
  "Sandboxing reduces risk but is not a complete isolation boundary."
- **A browser in a cloud session,** and a cloud build of a repository that
  is not JavaScript, whose dependencies are copied or installed as
  [`commands.build-setup`](configuration.md#commandsbuild-setup) says.
- **Parts of an organization's setup, against a real one.** These have
  run on GitHub, once each, in an organization on the Free plan:
  `factory init --org` from start to finish; a job making a token from
  the app, with that job's own permissions; signing the code host's
  command-line tool in with such a token, and a push and a pull request
  made through that sign-in; and `factory enroll`, with the
  organization's property and without it. These have not: the
  organization-wide rule, which needs GitHub's Team plan; the poller in
  `factory-config`, which needs a release of the factory to call; and a
  whole cloud build as the app.
- **Whether `claude setup-token` ends the coding agent's own sign-in.**
  Once, Claude Code's sign-in on the machine expired within an hour of
  `claude setup-token`, which both setup commands run when a
  subscription pays for sessions. Claude Code's documentation does not
  say whether one affects the other. If a later step says the session
  expired, run `claude` and sign in again.
- **Your board's own automations,** such as moving a closed ticket to Done.
  They may fight the board sync.
- **A factory update reaching a repository through the update job.**
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
  Only an approver's words are treated as instructions, and that rests on
  who your code host says can write to the repository. Give write access
  as carefully as you would give a session its orders.
- **An update delivers instructions that run with your tokens.** Read update
  pull requests as carefully as code.
- **It sits on tools that change.** Several parts work around how today's
  coding agent and code host behave.
- **Publishing cannot be undone.** A public release needs a history and
  examples free of the host repository's private tickets first.
