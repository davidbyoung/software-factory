# Adopting it in an existing repository

Most repositories already have a toolchain, a board, instructions for a
coding agent, or a team. This page says what the factory does in each case,
and what it leaves alone.

## Try it without committing to it

Do the [quick start](quick-start.md) on a branch and do not merge it. Start
an agent session on that branch and refine and build one ticket. If you
decide against it, delete the branch. [Removing it](removing.md) covers the
case where you have already merged.

## A repository that is not JavaScript

The factory's tool runs on Node and is installed with npm, whatever your
project is written in. In a PHP, Python, or Go repository that means:

- **A `package.json` appears**, holding one development dependency and
  nothing else. Make it yourself before installing, marked private so it
  can never be published:

  ```bash
  echo '{ "private": true }' > package.json
  ```

  Without one, npm installs into the nearest folder above that has a
  `package.json`, if there is one, rather than into your repository.

- **`package-lock.json` is committed.** It is what keeps everyone on the
  same version of the factory.
- **`node_modules/` is ignored.** `factory init` adds it
  to your `.gitignore`.
- **Everyone who works on the repository needs Node 22.18 or later**, and
  runs `npm ci` once after cloning.
- **Your own CI does not change.** The factory's cloud jobs install Node
  for themselves. If you turn on the automated review, how it installs your
  project, such as `composer install`, is yours to edit.
- **Your commands stay yours.**
  [`before-commit`](configuration.md#before-commit) in the settings takes
  any command: `composer lint`, `make check`, `go vet ./...`.

The factory's hooks run its own tool, so they need nothing beyond Node.
Someone who only writes code by hand, and never runs an agent session in
the repository, needs none of this.

[Configuration](configuration.md#a-repository-that-is-not-javascript) has a
complete settings file for a PHP library.

## You already have a board

`factory init` lists your boards to choose from, and gives
the one you choose any of the factory's six columns and three fields it
lacks. A column of yours whose name matches one of the six, whatever its
case, is used as it is; your other columns stay, after the six. It says
what it added:

```text
Added to board 3: Backlog, In refinement, Ready, In review, Session, Runs in, Cost.
```

- **It adds; it never renames or removes.** Your "Todo" column stays, with
  its cards.
- **A card in a column the factory does not know is ignored.** Nothing
  moves it, and nothing builds it. In this example that is everything in
  "Todo": move a card to Backlog when you want the factory to track it,
  or move them all once and retire the column.
- **The factory's fields are overwritten on every sync.** Do not type into
  Session, Runs in, or Cost. Your own fields are never touched.
- **Using your own column names** works today:
  [`tickets.columns`](configuration.md#ticketscolumns) in your settings
  says which of your columns shows each state, and `none` says your board
  has none. [Configuration](configuration.md#ticketscolumns) has the
  mapping for a board with Todo, In Progress, and Done. To see what the
  factory will do with your board, run:

  ```bash
  factory board check
  ```

- **Your board's own automations**, such as moving a closed ticket to
  Done, have not been tested alongside the factory. Turn them off if cards
  jump unexpectedly.

A board owned by an organization is read the same way as a person's, but
has not yet been run against a real one. A repository an organization owns
has one more gap: only the owner's comments count as answers, and the
owner is read from the repository's name, which there is the
organization's.

## You already have agent instructions, settings, or CI workflows

- **Your agent's instructions file:** one line is added at the end,
  importing the factory's rules. Nothing else in it changes. Your own rules
  win where the two disagree.
- **Your agent's settings:** a few hooks are added, and the agent's
  attribution lines are turned off, so a session's commits and pull
  requests carry no line naming an AI: they are yours. A cloud build's
  commits name the agent as their author instead
  ([Builds in the cloud](builds.md)). If your settings already
  say how to attribute, that stays. Your existing hooks, permissions, and
  settings stay as they are.
- **Your skills and agents:** untouched. Everything the factory adds is
  named `factory-...`, so nothing collides.
- **Your CI workflows:** untouched. The factory's are named `factory-...`.
- **`factory init` lists every file** it would write or
  change before it writes, and changes nothing if you say no.

On GitHub with Claude Code, [the reference](github/reference.md#what-setup-adds)
names each file.

## A team

- **A person's own session acts as that person.** A commit made by a
  teammate's session goes out under that teammate's account. A cloud build
  acts as the one account that owns its token: yours, or an account you
  create for the team's builds
  ([Secrets](github/by-hand.md#secrets)).
- **Say who approves.** By default only the repository's owner can approve
  a ticket for building or give a session instructions in a comment. List
  the others under [`approvers`](configuration.md#approvers), _[Planned](developing.md#what-is-built)_.
- **One version for everyone.** The version is pinned in
  `package-lock.json`. After an update merges, each person pulls and runs
  `npm ci`. `factory doctor` says so when the installed
  version and the repository's disagree.
- **One session per ticket.** A session claims a ticket before it starts,
  and a second one is told who holds it.
- **One person merges updates.** An update changes the instructions
  everyone's sessions follow, so it always waits for a person.
  [Updating](updating.md) describes it.
- **Check your coding agent's plan** covers the way your team would use
  this, including builds that run without anyone watching.

## What it does to your repository, in short

[What it changes](removing.md) says what kinds of things the factory adds,
and how to undo each. The short version:

- Files it owns, all named `factory-...`, and its rules.
- One line in your agent's instructions file, and a few hooks in your
  agent's settings.
- Hooks that stop a session committing on your main branch or force
  pushing, and that run your `before-commit` commands. They apply to agent
  sessions, not to your own terminal.
- Its CI workflows: one that checks the factory's files are in step, the
  ones that run a session in the cloud, and one more for each optional part
  you turn on. With a Dependabot configuration, two more complete
  Dependabot's pull requests, the factory's own updates among them.
- Comments on tickets it works, and one "Follow-ups" ticket.
