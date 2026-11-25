# Glossary

The words these docs use, in plain terms. The factory works through a few
kinds of tool, each behind one interface, and these pages name the kind,
not the tool. Where a word stands for a tool, its entry says which one it
is today.

## The tools

**Code host.** Where your repository lives, with its pull requests, their
reviews, the checks on each commit, and the secrets your CI reads. Today:
GitHub. [`code-host.type`](configuration.md#code-host) names it.

**Ticket system.** Where your tickets live. Today: GitHub Issues.
[`tickets.type`](configuration.md#tickets) names it.

**Board.** A view of every ticket's state, one column per state, which the
factory keeps up to date. Optional. Today: a GitHub Project.

**Cloud runner.** Where work runs with no one at a keyboard: cloud builds,
the automated review, the board sync, and the factory's other CI jobs.
Today: GitHub Actions. [`builds.runner`](configuration.md#builds) names it.

**Coding agent.** The AI tool that runs sessions: it reads your code,
follows the factory's skills, and writes the change. Today: Claude Code.

## The words

**Acceptance criteria.** The list in a ticket that says what "done" means,
written so each item can be checked. Refining a ticket produces it.

**Agent (reviewer).** A separate reviewer that a session launches to read
something and report back. It changes nothing. The factory brings four,
and you can add your own.

**Approver.** A person whose words a session treats as instructions:
anyone whose account can write to the repository. Who can approve a
ticket for building is whoever your board lets move it to Ready.

**Answer.** A [cloud run](builds.md#what-a-cloud-run-is) that works what
stands between a pull request and its merge: CI that failed, the automated
review, or a review you submit.

**Automated review.** A review of every pull request by the coding agent,
in a cloud run of its own, once the pull request is marked ready. It gives
what it finds and a verdict, which a job with no AI posts. Optional.

**Board sync.** The job that sets each ticket's column and fields on the
board. It is the only thing that writes to the board.

**Build.** One session taking one approved ticket to a pull request.

**Claim.** A comment a session posts on a ticket before it starts, so no
other session builds the same one.

**Cloud build.** A build that runs on the cloud runner instead of your
machine. You start one with a command, or by moving a ticket to Ready on
your board.

**Cloud run.** One of the five kinds of run that use the coding agent on
the cloud runner: Build, Review, Answer, Conflict, and Dependency. Each is
three jobs, Prepare, Session, and Publish
([What a cloud run is](builds.md#what-a-cloud-run-is)).

**Copied files.** The factory's skills, agents, and rules, written into
your repository by `factory sync`. You do not edit them. The same
command writes two short CI workflow files, which call the factory's own
jobs at the version your repository names.

**Default branch.** The branch your pull requests merge into, often
called `main`. The factory reads its name from your checkout or your code
host, and assumes none.

**Dependency bot.** A tool that opens pull requests when a dependency has
a new version.

**Follow-up.** Something a session noticed while doing other work, listed in
its pull request for you to [decide about](workflow.md#follow-ups).

**Gate.** The commands that must pass before a session calls a task done,
such as your tests and linter. Yours, listed under
[`commands.gate`](configuration.md#commandsgate) in your settings and run
by `factory gate`. A build cannot finish without one.

**Hook.** A command the coding agent runs at a set moment in a session on
a machine, such as before a shell command. The factory uses hooks to block
risky commits. None runs in the cloud.

**Local session.** A session on your own machine.

**Lock.** The file `.claude/factory.lock`, which `factory sync` writes:
the factory's version, each preset and the commit it is pinned to, every
setting in effect, and the files it copied. Every command reads its
settings from it, and the `factory` command runs the version it names.
You commit it and never edit it.

**Marker.** A hidden line in a comment the factory posts on a ticket,
recording what happened. The board is worked out from these.

**OpenSpec.** A tool that keeps a written description of what a project
does, in the repository. Optional.

**Plugin.** One of your own skills or agents, given a role in the work.

**Poller.** A small program that watches your board and starts a cloud
build for each ticket moved to Ready, on a server you host or on a
schedule in the cloud.

**Prepare.** The first job of a cloud run. It has the sign-in to the code
host and no AI, and hands the session what it works from, as files.

**Preset.** A folder of settings in a repository on your code host, with
any agents and skills they name, that several repositories share. A
repository lists it under [`presets`](configuration.md#presets), and
`factory sync` combines it with the repository's own settings.
[Presets](presets.md) says how.

**Publish.** The last job of a cloud run. It has the sign-in to the code
host and no AI, and checks what the session left before it does any of it.

**Refine.** To turn a ticket into acceptance criteria, settling the
decisions with you along the way.

**Review verdict.** A status on a pull request that says whether the
automated review of the newest commit found it ready.

**Role.** A job in the work that a plugin of yours can take on, such as
`reviewer`, an agent that reads a finished change, or `refiner`, a skill
that refines a ticket in place of the factory's own. There are seven.
[Plugins](plugins.md#the-roles) lists them.

**Session.** One conversation with the coding agent in your repository, on
your machine or in the cloud. In the cloud it is also the middle job of a
cloud run, and it has no sign-in to the code host.

**Skill.** A set of instructions a session follows, named `factory-...`
for the factory's own. You call one by typing its name as a slash command,
such as `/factory-refine 12`.

**Spec.** A written statement of what a change must do. A change your
users will see gets a Spec section of "When this, then that" lines in
its ticket; every other ticket has acceptance criteria. With OpenSpec
turned on, the Spec is also kept in the repository.

**Ticket.** One item in the ticket system: a piece of work, with what,
why, and when it is done.
