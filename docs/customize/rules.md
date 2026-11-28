# Tune the rules

For someone who wants one of the factory's rules to read differently in
their repository. At the end the rule reads your way, and you have
checked what the change does.

## Change a number

Two of the factory's rules hang on a number: how many changed lines still
count as a small change, and how many rounds of review comments a session
answers before it hands the rest to you. Set either under
[`rules`](../reference/settings/rules.md#rules) in `.claude/factory.yaml`:

```yaml
rules:
  small-change-lines: 40
```

Then run `factory sync`, which writes the number into the rules and skills
that use it.

**It worked when** `factory config explain` shows your number beside the
setting.

## Change anything else

Say it in your own instructions for the coding agent, such as `CLAUDE.md`,
which win over the factory's rules. A section headed with the rule's own
heading and ": this repository", such as "Small changes: this repository",
is where the factory's rules look for yours.

## Check the change

Run `/factory-trace` in a session before you rely on a change to a rule,
as below.

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
