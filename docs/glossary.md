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
something and report back. It changes nothing. The factory brings three,
and you can add your own.

**Approver.** A person whose comments a session treats as instructions,
and who can approve a ticket for building. By default, the repository's
owner.

**Automated review.** A review of every pull request by the coding agent,
run in CI once the pull request is marked ready. It comments on what it
finds and gives a verdict. Optional.

**Board sync.** The job that sets each ticket's column and fields on the
board. It is the only thing that writes to the board.

**Build.** One session taking one approved ticket to a pull request.

**Claim.** A comment a session posts on a ticket before it starts, so no
other session builds the same one.

**Cloud build.** A build that runs on the cloud runner instead of your
machine. You start one with a command, or by moving a ticket to Ready on
your board.

**Copied files.** The factory's skills, agents, rules, and CI workflows,
written into your repository by `factory sync`. You do not
edit them.

**Dependency bot.** A tool that opens pull requests when a dependency has
a new version.

**Follow-ups ticket.** One ordinary ticket whose body is a checklist of
small problems sessions noticed while doing other work.

**Gate.** The commands that must pass before a session calls a task done,
such as your tests and linter. Yours, named in your instructions for the
agent; without any, a session checks with the tests it wrote.

**Hook.** A command the coding agent runs at a set moment in a session,
such as before a shell command. The factory uses hooks to block risky
commits.

**Local session.** A session on your own machine.

**Marker.** A hidden line in a comment the factory posts on a ticket,
recording what happened. The board is worked out from these.

**OpenSpec.** A tool that keeps a written description of what a project
does, in the repository. Optional.

**Plug-in.** One of your own skills or agents that the factory calls at a
set moment.

**Poller.** A small program that watches your board and starts a cloud
build for each ticket moved to Ready, on a server you host or on a
schedule in the cloud.

**Refine.** To turn a ticket into acceptance criteria, settling the
decisions with you along the way.

**Review verdict.** A status on a pull request that says whether the
automated review of the newest commit found it ready.

**Session.** One conversation with the coding agent in your repository, on
your machine or in the cloud.

**Skill.** A set of instructions a session follows, named `factory-...`
for the factory's own. You call one by asking a session in plain words,
such as "refine ticket 12".

**Spec.** A written statement of what a change must do. For most tickets
that is the acceptance criteria. With OpenSpec turned on, a change your
users will see also gets its behavior recorded in the repository.

**Ticket.** One item in the ticket system: a piece of work, with what,
why, and when it is done.
