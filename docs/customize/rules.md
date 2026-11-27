# Tune the rules

For someone who wants one of the factory's rules to read differently in
their repository. At the end the rule reads your way, and you have
checked what the change does.

## `factory-trace`

**What it does.** A rule written for one kind of change can be wrong for
every other kind. Before a change to the rules, a skill, an agent, or a
workflow that alters what triggers a step, who runs, or when is marked
ready, this has a fresh agent trace each kind of change your
repository gets through the rules as they would stand, and report any kind
that got heavier, lighter, or ambiguous, and any two rules that now
disagree.

**What it reads.** `.claude/change-types.md`, your list of the kinds of
change your repository gets, each with a real example.

**What it writes.** The fresh agent's report: on the pull request when the
branch has one, and otherwise in the session.

**When it stops.** Before starting an agent, when `.claude/change-types.md`
is missing. The pull request stays a draft, and a comment on it shows the
file's shape for you to write.
